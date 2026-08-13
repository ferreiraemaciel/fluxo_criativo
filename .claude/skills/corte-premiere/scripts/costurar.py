# -*- coding: utf-8 -*-
"""
costurar.py — Costura VÁRIAS entrevistas/sequências numa timeline única.

Igual ao conformar.py, mas a EDL puxa trechos de MAIS DE UMA fonte (ex: duas
entrevistas com câmeras/arquivos diferentes), intercalando pelos pontos de
encaixe. Cada segmento diz de qual fonte vem (campo "src"). Os ids de arquivo e
de masterclip são isolados por fonte (namespacing) pra não colidir. Saída:
1 trilha de vídeo + N trilhas de áudio, com vídeo e áudio linkados, marcadores
por trecho e mapa .md.

Uso: python3 costurar.py --edl caminho/edl.json

Formato da EDL:
{
  "sources": {"E01": "/.../Entrevista 01.xml", "E02": "/.../Entrevista 02.xml"},
  "out_xml": "...", "out_mapa": "...", "sequence_name": "...",
  "abertura": {"name": "...", "nota": "..."},                 # opcional (marcador em 0)
  "blocks": [ {"name": "BLOCO ...", "segments": [
      {"src":"E01","id":"S35","in":"00:23:06,518","out":"00:24:26,448","uso":"...","nota":"..."},
      {"src":"E02","id":"T12","in":"00:01:22.459","out":"00:02:20.449","uso":"...","nota":"..."},
  ]}],
  "excluidos": [ ... ]                                        # opcional
}
Todas as fontes precisam ter a mesma taxa (timebase/ntsc) e as mesmas trilhas de
áudio populadas.
"""
import xml.etree.ElementTree as ET
import argparse, json, io, sys

PPRO_TICKS_PER_SEC = 254016000000

def parse_rate(el):
    r = el.find('rate')
    if r is None: return 30, False
    return int(r.findtext('timebase')), (r.findtext('ntsc') or 'FALSE').upper() == 'TRUE'

def fps_of(tb, ntsc): return tb * 1000.0 / 1001.0 if ntsc else float(tb)
def ticks_per_frame(tb, ntsc):
    return (PPRO_TICKS_PER_SEC * 1001) // (tb * 1000) if ntsc else PPRO_TICKS_PER_SEC // tb

def to_seconds(v):
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace(',', '.')
    if s.count(':') == 2:
        h, m, sec = s.split(':'); return int(h)*3600 + int(m)*60 + float(sec)
    return float(s)

def ratexml(tb, ntsc):
    return '<rate><timebase>%d</timebase><ntsc>%s</ntsc></rate>' % (tb, 'TRUE' if ntsc else 'FALSE')
def xesc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def load_source(path, key, file_def_xml, masterclip):
    """Carrega uma fonte, isola ids por fonte (key). Retorna (tiling_video1,
    audio_idx, TB, NTSC)."""
    seq = ET.parse(path).getroot().find('sequence')
    media = seq.find('media')
    TB, NTSC = parse_rate(seq)

    def first_nonempty(tracks):
        for tr in tracks:
            if tr.findall('clipitem'): return tr
        return None

    vtr = first_nonempty(media.find('video').findall('track'))
    if vtr is None: sys.exit('ERRO: fonte %s sem clipes de vídeo.' % key)

    def nid(fid): return '%s_%s' % (key, fid)
    tiling = []
    for ci in vtr.findall('clipitem'):
        fe = ci.find('file'); fid = fe.get('id'); ns = nid(fid)
        if len(list(fe)) > 0 and ns not in file_def_xml:
            s = ET.tostring(fe, encoding='unicode')
            file_def_xml[ns] = s.replace('id="%s"' % fid, 'id="%s"' % ns, 1)
            masterclip[ns] = '%s_%s' % (key, ci.findtext('masterclipid') or ('masterclip-' + fid))
        tiling.append(dict(start=int(ci.findtext('start')), end=int(ci.findtext('end')),
                           in_=int(ci.findtext('in')), out=int(ci.findtext('out')),
                           fid=ns, name=ci.findtext('name')))
    for c in tiling:
        masterclip.setdefault(c['fid'], '%s_masterclip' % key)

    audio_idx = []
    for tr in media.find('audio').findall('track'):
        cis = tr.findall('clipitem')
        if not cis: continue
        st = cis[0].find('sourcetrack')
        audio_idx.append(int(st.findtext('trackindex')) if st is not None else len(audio_idx) + 1)
    if not audio_idx: audio_idx = [1]

    vformat = ET.tostring(media.find('video').find('format'), encoding='unicode') \
        if media.find('video').find('format') is not None else ''
    aformat_el = media.find('audio').find('format')
    aformat = ET.tostring(aformat_el, encoding='unicode') if aformat_el is not None else ''
    return dict(tiling=tiling, audio_idx=audio_idx, TB=TB, NTSC=NTSC,
                vformat=vformat, aformat=aformat)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--edl', required=True)
    a = ap.parse_args()
    edl = json.load(io.open(a.edl, encoding='utf-8'))

    file_def_xml, masterclip = {}, {}
    sources = {}
    for key, path in edl['sources'].items():
        sources[key] = load_source(path, key, file_def_xml, masterclip)

    # taxa e trilhas de áudio têm que ser iguais entre as fontes
    rates = set((s['TB'], s['NTSC']) for s in sources.values())
    if len(rates) > 1:
        sys.exit('ERRO: fontes com taxas diferentes: %s. Reexporte na mesma timebase.' % rates)
    aidxs = set(tuple(s['audio_idx']) for s in sources.values())
    if len(aidxs) > 1:
        sys.exit('ERRO: fontes com trilhas de áudio diferentes: %s.' % aidxs)

    TB, NTSC = next(iter(rates))
    FPS = fps_of(TB, NTSC); TPF = ticks_per_frame(TB, NTSC)
    audio_idx = list(next(iter(aidxs)))
    first = next(iter(sources.values()))
    vformat, aformat = first['vformat'], first['aformat']

    def sec_to_frame(s): return int(round(s * FPS))

    def pieces_for(tiling, ti, to):
        out = []
        for c in tiling:
            s, e = max(c['start'], ti), min(c['end'], to)
            if e <= s: continue
            out.append(dict(fid=c['fid'], name=c['name'],
                            src_in=c['in_'] + (s - c['start']),
                            src_out=c['in_'] + (e - c['start']), length=e - s))
        return out

    def clip(cid, name, mclip, length, sin, sout, fid, first_use, tl_start,
             mediatype, sourceindex, links):
        fb = file_def_xml[fid] if first_use else '<file id="%s"/>' % fid
        p = ['<clipitem id="%s"%s>' % (cid, ' premiereChannelType="stereo"' if mediatype == 'audio' else '')]
        p.append('<masterclipid>%s</masterclipid>' % mclip)
        p.append('<name>%s</name>' % xesc(name))
        p.append('<enabled>TRUE</enabled><duration>%d</duration>' % length)
        p.append(ratexml(TB, NTSC))
        p.append('<start>%d</start><end>%d</end>' % (tl_start, tl_start + length))
        p.append('<in>%d</in><out>%d</out>' % (sin, sout))
        p.append('<pproTicksIn>%d</pproTicksIn><pproTicksOut>%d</pproTicksOut>' % (sin * TPF, sout * TPF))
        if mediatype == 'video':
            p.append('<alphatype>none</alphatype><pixelaspectratio>square</pixelaspectratio><anamorphic>FALSE</anamorphic>')
        p.append(fb)
        if mediatype == 'audio':
            p.append('<sourcetrack><mediatype>audio</mediatype><trackindex>%d</trackindex></sourcetrack>' % sourceindex)
        for lk in links:
            p.append('<link><linkclipref>%s</linkclipref><mediatype>%s</mediatype><trackindex>%d</trackindex><clipindex>%d</clipindex></link>' % lk)
        p.append('</clipitem>')
        return ''.join(p)

    v_clips, a_clips = [], [[] for _ in audio_idx]
    markers, mapa_rows = [], []
    seen = set(); pos = 0; n = 0

    if edl.get('abertura'):
        ab = edl['abertura']
        markers.append((ab.get('name', 'ABERTURA'), ab.get('nota', ''), 0, -1))

    for blk in edl['blocks']:
        for seg in blk['segments']:
            key = seg['src']
            tiling = sources[key]['tiling']
            ti, to = sec_to_frame(to_seconds(seg['in'])), sec_to_frame(to_seconds(seg['out']))
            seg_start = pos
            for pc in pieces_for(tiling, ti, to):
                n += 1
                fu = pc['fid'] not in seen
                vid = 'ci-v%d' % n
                aids = ['ci-a%d_%d' % (ti_, n) for ti_ in audio_idx]
                links = [(vid, 'video', 1, n)] + [(aids[k], 'audio', ti_, n) for k, ti_ in enumerate(audio_idx)]
                v_clips.append(clip(vid, pc['name'], masterclip[pc['fid']], pc['length'],
                                    pc['src_in'], pc['src_out'], pc['fid'], fu, pos, 'video', None, links))
                seen.add(pc['fid'])
                for k, ti_ in enumerate(audio_idx):
                    a_clips[k].append(clip(aids[k], pc['name'], masterclip[pc['fid']], pc['length'],
                                           pc['src_in'], pc['src_out'], pc['fid'], False, pos, 'audio', ti_, links))
                pos += pc['length']
            markers.append(('%s · %s/%s' % (blk['name'], key, seg.get('id', '')), seg.get('nota', ''), seg_start, pos))
            mapa_rows.append(dict(block=blk['name'], src=key, id=seg.get('id', ''),
                                  IN=seg['in'], OUT=seg['out'], uso=seg.get('uso', ''),
                                  nota=seg.get('nota', ''), ts=seg_start, te=pos))
    TOTAL = pos

    def track(clips, extra=''): return '<track>%s%s</track>' % (extra, ''.join(clips))
    x = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE xmeml>', '<xmeml version="4">',
         '<sequence id="seq-costura" explodedTracks="true">',
         '<name>%s</name>' % xesc(edl.get('sequence_name', 'FILME')),
         '<duration>%d</duration>' % TOTAL, ratexml(TB, NTSC), '<media><video>']
    if vformat: x.append(vformat)
    x.append(track(v_clips))
    x.append('<track></track><track></track>')  # V2,V3 p/ b-roll
    x.append('</video><audio>')
    if aformat: x.append(aformat)
    for k in range(len(audio_idx)):
        x.append(track(a_clips[k], '<outputchannelindex>%d</outputchannelindex>' % (k + 1)))
    x.append('</audio></media>')
    for name, comment, mi, mo in markers:
        x.append('<marker><name>%s</name><comment>%s</comment><in>%d</in><out>%d</out></marker>'
                 % (xesc(name), xesc(comment), mi, mo))
    df = NTSC and TB in (30, 60, 120, 240); sep = ';' if df else ':'
    x.append('<timecode>%s<string>00%s00%s00%s00</string><frame>0</frame><displayformat>%s</displayformat></timecode>'
             % (ratexml(TB, NTSC), sep, sep, sep, 'DF' if df else 'NDF'))
    x.append('</sequence></xmeml>')
    io.open(edl['out_xml'], 'w', encoding='utf-8').write('\n'.join(x))

    def f2tc(fr):
        t = fr / FPS
        return '%02d:%02d:%05.2f' % (int(t//3600), int((t % 3600)//60), t % 60)
    md = ['# Mapa de Montagem — %s\n' % edl.get('sequence_name', 'FILME'),
          'Duração total: **%s** (%d quadros a %.2f fps). Fontes: %s.\n'
          % (f2tc(TOTAL), TOTAL, FPS, ', '.join(edl['sources'].keys())),
          'Arquivo para importar no Premiere: `%s`\n' % edl['out_xml'].split('/')[-1]]
    cur = None
    for r in mapa_rows:
        if r['block'] != cur:
            cur = r['block']
            md.append('\n## %s\n' % cur)
            md.append('| Pos. no corte | Fonte/Trecho | Orig. IN→OUT | Uso | Nota / B-roll |')
            md.append('|---|---|---|---|---|')
        md.append('| %s → %s | %s/%s | %s → %s | %s | %s |'
                  % (f2tc(r['ts']), f2tc(r['te']), r['src'], r['id'], r['IN'], r['OUT'],
                     r['uso'], str(r['nota']).replace('|', '/')))
    if edl.get('excluidos'):
        md.append('\n## Fora do filme\n')
        for e in edl['excluidos']:
            md.append('- %s/%s [%s→%s] — %s' % (e.get('src', ''), e.get('id', ''), e.get('in', ''),
                                                e.get('out', ''), str(e.get('nota', '')).replace('|', '/')))
    io.open(edl['out_mapa'], 'w', encoding='utf-8').write('\n'.join(md))

    print('OK | fps=%.3f | fontes=%s | clips_video=%d | trilhas_audio=%s | duracao=%d (%s) | marcadores=%d'
          % (FPS, list(edl['sources'].keys()), len(v_clips), audio_idx, TOTAL, f2tc(TOTAL), len(markers)))
    print('XML :', edl['out_xml'])
    print('MAPA:', edl['out_mapa'])

if __name__ == '__main__':
    main()
