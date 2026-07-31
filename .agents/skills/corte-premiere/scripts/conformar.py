# -*- coding: utf-8 -*-
"""
conformar.py — Motor de conformação de corte para Adobe Premiere.

Recebe uma EDL (lista de decisao de edicao) em JSON, produzida pela cabeca
(o modelo, lendo a transcricao), + o Final Cut Pro XML (xmeml) exportado da
sequencia bruta. Emite um XML novo, cortado no frame certo, que o Premiere
importa e relinka sozinho, com marcadores de b-roll. Gera tambem um mapa .md.

Generico: detecta fps/timebase/ntsc, numero de arquivos e numero de trilhas de
audio sozinho. Nao e preso a nenhum projeto.

Uso:
    python3 conformar.py --edl caminho/edl.json

Formato da EDL (JSON):
{
  "source_xml": "/.../Entrevista 01.xml",
  "out_xml":    "/.../Entrevista 01 - CORTE FMN v1.xml",
  "out_mapa":   "/.../MAPA_CORTE_FMN_v1.md",
  "sequence_name": "Entrevista 01 - CORTE FMN v1",
  "abertura": {"name": "ABERTURA · b-roll", "nota": "estrada/cafe..."},   # opcional
  "blocks": [
    {"name": "BLOCO 1 · ...", "segments": [
       {"id":"S35", "in":"00:23:06,518", "out":"00:24:26,448",
        "uso":"FILME + REEL", "nota":"..."},
       ...
    ]},
    ...
  ],
  "excluidos": [ {"id":"S09","in":"...","out":"...","uso":"...","nota":"..."} ]  # opcional
}

Timecodes aceitos em "in"/"out": "HH:MM:SS,mmm", "HH:MM:SS.mmm" ou segundos (float).
"""
import xml.etree.ElementTree as ET
import argparse, json, io, sys

PPRO_TICKS_PER_SEC = 254016000000

def parse_rate(el):
    r = el.find('rate')
    if r is None:
        return 30, False
    tb = int(r.findtext('timebase'))
    ntsc = (r.findtext('ntsc') or 'FALSE').upper() == 'TRUE'
    return tb, ntsc

def fps_of(tb, ntsc):
    return tb * 1000.0 / 1001.0 if ntsc else float(tb)

def ticks_per_frame(tb, ntsc):
    if ntsc:
        return (PPRO_TICKS_PER_SEC * 1001) // (tb * 1000)
    return PPRO_TICKS_PER_SEC // tb

def to_seconds(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(',', '.')
    if s.count(':') == 2:
        h, m, sec = s.split(':')
        return int(h) * 3600 + int(m) * 60 + float(sec)
    return float(s)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--edl', required=True)
    args = ap.parse_args()

    edl = json.load(io.open(args.edl, encoding='utf-8'))
    SRC = edl['source_xml']

    tree = ET.parse(SRC)
    seq = tree.getroot().find('sequence')
    media = seq.find('media')

    TB, NTSC = parse_rate(seq)
    FPS = fps_of(TB, NTSC)
    TPF = ticks_per_frame(TB, NTSC)

    def sec_to_frame(s):
        return int(round(s * FPS))

    # --- trilha de video de referencia (primeira nao vazia) ---
    vtracks = media.find('video').findall('track')
    ref = None
    for tr in vtracks:
        if tr.findall('clipitem'):
            ref = tr; break
    if ref is None:
        sys.exit('ERRO: nenhuma trilha de video com clipes no XML fonte.')

    tiling, file_def_xml, masterclip = [], {}, {}
    for ci in ref.findall('clipitem'):
        fe = ci.find('file'); fid = fe.get('id')
        if len(list(fe)) > 0 and fid not in file_def_xml:
            file_def_xml[fid] = ET.tostring(fe, encoding='unicode')
            masterclip[fid] = ci.findtext('masterclipid') or ('masterclip-' + fid)
        tiling.append(dict(start=int(ci.findtext('start')), end=int(ci.findtext('end')),
                           in_=int(ci.findtext('in')), out=int(ci.findtext('out')),
                           fid=fid, name=ci.findtext('name')))
    # garante que todo fid usado tem def e masterclip
    for c in tiling:
        masterclip.setdefault(c['fid'], 'masterclip-' + c['fid'])
    TOTAL_SRC = tiling[-1]['end']

    # --- trilhas de audio populadas + seus sourcetrack index ---
    atracks_src = media.find('audio').findall('track')
    audio_idx = []   # lista de trackindex de audio a espelhar (ex: [1,2])
    for tr in atracks_src:
        cis = tr.findall('clipitem')
        if not cis:
            continue
        st = cis[0].find('sourcetrack')
        ti = int(st.findtext('trackindex')) if st is not None else (len(audio_idx) + 1)
        audio_idx.append(ti)
    if not audio_idx:
        audio_idx = [1]

    vformat = ET.tostring(media.find('video').find('format'), encoding='unicode') \
        if media.find('video').find('format') is not None else ''
    aformat_el = media.find('audio').find('format')
    aformat = ET.tostring(aformat_el, encoding='unicode') if aformat_el is not None else ''

    # --- reconstruir pedacos por segmento ---
    def pieces_for(a, b):
        ti, to = max(0, sec_to_frame(a)), min(TOTAL_SRC, sec_to_frame(b))
        out = []
        for c in tiling:
            s, e = max(c['start'], ti), min(c['end'], to)
            if e <= s:
                continue
            out.append(dict(fid=c['fid'], name=c['name'],
                            src_in=c['in_'] + (s - c['start']),
                            src_out=c['in_'] + (e - c['start']),
                            length=e - s))
        return out

    # --- emitir clipitems ---
    def clip(cid, name, mclip, length, sin, sout, fid, first, tl_start,
             mediatype, sourceindex, links):
        fb = file_def_xml[fid] if first else '<file id="%s"/>' % fid
        p = []
        attr = ' premiereChannelType="stereo"' if mediatype == 'audio' else ''
        p.append('<clipitem id="%s"%s>' % (cid, attr))
        p.append('<masterclipid>%s</masterclipid>' % mclip)
        p.append('<name>%s</name>' % xesc(name))
        p.append('<enabled>TRUE</enabled>')
        p.append('<duration>%d</duration>' % length)
        p.append(ratexml(TB, NTSC))
        p.append('<start>%d</start>' % tl_start)
        p.append('<end>%d</end>' % (tl_start + length))
        p.append('<in>%d</in>' % sin)
        p.append('<out>%d</out>' % sout)
        p.append('<pproTicksIn>%d</pproTicksIn>' % (sin * TPF))
        p.append('<pproTicksOut>%d</pproTicksOut>' % (sout * TPF))
        if mediatype == 'video':
            p.append('<alphatype>none</alphatype><pixelaspectratio>square</pixelaspectratio><anamorphic>FALSE</anamorphic>')
        p.append(fb)
        if mediatype == 'audio':
            p.append('<sourcetrack><mediatype>audio</mediatype><trackindex>%d</trackindex></sourcetrack>' % sourceindex)
        for lk in links:
            p.append('<link><linkclipref>%s</linkclipref><mediatype>%s</mediatype>'
                     '<trackindex>%d</trackindex><clipindex>%d</clipindex></link>'
                     % lk)
        p.append('</clipitem>')
        return ''.join(p)

    v_clips = []
    a_clips = [[] for _ in audio_idx]
    markers = []
    seen = set()
    pos = 0
    n = 0
    mapa_rows = []

    if edl.get('abertura'):
        ab = edl['abertura']
        markers.append((ab.get('name', 'ABERTURA'), ab.get('nota', ''), 0, -1))

    for blk in edl['blocks']:
        for seg in blk['segments']:
            a, b = to_seconds(seg['in']), to_seconds(seg['out'])
            seg_start = pos
            for pc in pieces_for(a, b):
                n += 1
                first = pc['fid'] not in seen
                vid = 'ci-v%d' % n
                aids = ['ci-a%d_%d' % (ti, n) for ti in audio_idx]
                links = [(vid, 'video', 1, n)]
                for k, ti in enumerate(audio_idx):
                    links.append((aids[k], 'audio', ti, n))
                v_clips.append(clip(vid, pc['name'], masterclip[pc['fid']], pc['length'],
                                    pc['src_in'], pc['src_out'], pc['fid'], first, pos,
                                    'video', None, links))
                seen.add(pc['fid'])
                for k, ti in enumerate(audio_idx):
                    a_clips[k].append(clip(aids[k], pc['name'], masterclip[pc['fid']],
                                           pc['length'], pc['src_in'], pc['src_out'],
                                           pc['fid'], False, pos, 'audio', ti, links))
                pos += pc['length']
            markers.append(('%s · %s' % (blk['name'], seg.get('id', '')),
                            seg.get('nota', ''), seg_start, pos))
            mapa_rows.append(dict(block=blk['name'], id=seg.get('id', ''),
                                  IN=seg['in'], OUT=seg['out'], uso=seg.get('uso', ''),
                                  nota=seg.get('nota', ''), ts=seg_start, te=pos))
    TOTAL = pos

    # --- montar XML ---
    def track(clips, extra=''):
        return '<track>%s%s</track>' % (extra, ''.join(clips))

    x = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE xmeml>', '<xmeml version="4">']
    x.append('<sequence id="seq-corte" explodedTracks="true">')
    x.append('<name>%s</name>' % xesc(edl.get('sequence_name', 'CORTE')))
    x.append('<duration>%d</duration>' % TOTAL)
    x.append(ratexml(TB, NTSC))
    x.append('<media><video>')
    if vformat: x.append(vformat)
    x.append(track(v_clips))
    x.append('<track></track><track></track>')  # V2,V3 vazias p/ b-roll
    x.append('</video><audio>')
    if aformat: x.append(aformat)
    for k, ti in enumerate(audio_idx):
        x.append(track(a_clips[k], '<outputchannelindex>%d</outputchannelindex>' % (k + 1)))
    x.append('</audio></media>')
    for name, comment, mi, mo in markers:
        x.append('<marker><name>%s</name><comment>%s</comment><in>%d</in><out>%d</out></marker>'
                 % (xesc(name), xesc(comment), mi, mo))
    df = NTSC and TB in (30, 60, 120, 240)
    sep = ';' if df else ':'
    x.append('<timecode>%s<string>00%s00%s00%s00</string><frame>0</frame><displayformat>%s</displayformat></timecode>'
             % (ratexml(TB, NTSC), sep, sep, sep, 'DF' if df else 'NDF'))
    x.append('</sequence></xmeml>')
    io.open(edl['out_xml'], 'w', encoding='utf-8').write('\n'.join(x))

    # --- mapa .md ---
    def f2tc(fr):
        t = fr / FPS
        return '%02d:%02d:%05.2f' % (int(t // 3600), int((t % 3600) // 60), t % 60)
    md = ['# Mapa de Montagem — %s\n' % edl.get('sequence_name', 'CORTE'),
          'Duração total: **%s** (%d quadros a %.2f fps).\n' % (f2tc(TOTAL), TOTAL, FPS),
          'Arquivo para importar no Premiere: `%s`\n' % edl['out_xml'].split('/')[-1]]
    cur = None
    for r in mapa_rows:
        if r['block'] != cur:
            cur = r['block']
            md.append('\n## %s\n' % cur)
            md.append('| Pos. no corte | Trecho | Orig. IN→OUT | Uso | Nota / B-roll |')
            md.append('|---|---|---|---|---|')
        md.append('| %s → %s | %s | %s → %s | %s | %s |'
                  % (f2tc(r['ts']), f2tc(r['te']), r['id'], r['IN'], r['OUT'],
                     r['uso'], str(r['nota']).replace('|', '/')))
    if edl.get('excluidos'):
        md.append('\n## Fora do filme principal (viram Reels / material separado)\n')
        for e in edl['excluidos']:
            md.append('- %s [%s→%s] %s — %s' % (e.get('id', ''), e['in'], e['out'],
                                                e.get('uso', ''), str(e.get('nota', '')).replace('|', '/')))
    io.open(edl['out_mapa'], 'w', encoding='utf-8').write('\n'.join(md))

    print('OK | fps=%.3f tpf=%d | clips_video=%d | trilhas_audio=%s | duracao=%d quadros (%s) | marcadores=%d'
          % (FPS, TPF, len(v_clips), audio_idx, TOTAL, f2tc(TOTAL), len(markers)))
    print('XML :', edl['out_xml'])
    print('MAPA:', edl['out_mapa'])

def ratexml(tb, ntsc):
    return '<rate><timebase>%d</timebase><ntsc>%s</ntsc></rate>' % (tb, 'TRUE' if ntsc else 'FALSE')

def xesc(s):
    return (str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))

if __name__ == '__main__':
    main()
