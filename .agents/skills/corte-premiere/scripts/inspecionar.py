# -*- coding: utf-8 -*-
"""
inspecionar.py — Radiografia de um Final Cut Pro XML (xmeml) exportado do Premiere.

Mostra fps/timebase, trilhas de video e audio, arquivos-fonte com caminho, o
tiling da timeline (como os clipes cobrem o tempo) e a duracao total. Serve pra
entender qualquer projeto antes de conformar.

Uso: python3 inspecionar.py "/caminho/Sequencia.xml"
"""
import xml.etree.ElementTree as ET
import sys

def rate(el):
    r = el.find('rate')
    if r is None: return None
    return (r.findtext('timebase'), r.findtext('ntsc'))

def main():
    if len(sys.argv) < 2:
        sys.exit('uso: python3 inspecionar.py "/caminho/Sequencia.xml"')
    seq = ET.parse(sys.argv[1]).getroot().find('sequence')
    media = seq.find('media')
    tb, ntsc = rate(seq)
    fps = (int(tb) * 1000.0 / 1001.0) if (ntsc or '').upper() == 'TRUE' else float(tb)
    print('SEQ:', seq.findtext('name'))
    print('rate: timebase=%s ntsc=%s  -> fps=%.3f' % (tb, ntsc, fps))
    print('duração:', seq.findtext('duration'), 'quadros =', round(int(seq.findtext('duration'))/fps, 1), 's')

    files = {}
    for f in seq.iter('file'):
        if f.findtext('name') and f.findtext('pathurl') and f.get('id') not in files:
            files[f.get('id')] = (f.findtext('name'), f.findtext('duration'), f.findtext('pathurl'))

    for mt in ('video', 'audio'):
        m = media.find(mt)
        if m is None: continue
        trs = m.findall('track')
        print('\n=== %s: %d trilha(s) ===' % (mt.upper(), len(trs)))
        for i, tr in enumerate(trs, 1):
            cis = tr.findall('clipitem')
            st = cis[0].find('sourcetrack') if cis else None
            sidx = st.findtext('trackindex') if st is not None else '-'
            print('  trilha %d: %d clipe(s)  (sourcetrack index=%s)' % (i, len(cis), sidx))

    ref = None
    for tr in media.find('video').findall('track'):
        if tr.findall('clipitem'): ref = tr; break
    print('\n=== TILING (trilha de vídeo de referência) ===')
    for ci in ref.findall('clipitem'):
        fid = ci.find('file').get('id')
        nm = files.get(fid, ('?',))[0]
        print('  tl[%s-%s] src[%s-%s] %s (%s)' % (ci.findtext('start'), ci.findtext('end'),
              ci.findtext('in'), ci.findtext('out'), nm, fid))

    print('\n=== ARQUIVOS-FONTE ===')
    for fid, (nm, dur, path) in sorted(files.items()):
        print('  %s: %s dur=%s' % (fid, nm, dur))
        print('       %s' % path)

if __name__ == '__main__':
    main()
