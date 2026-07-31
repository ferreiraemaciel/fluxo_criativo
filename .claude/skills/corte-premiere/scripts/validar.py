# -*- coding: utf-8 -*-
"""
validar.py — Confere a integridade do XML de corte antes de entregar.

Checa: XML bem formado; continuidade sem furos em cada trilha; alinhamento
video x audio; end-start == out-in em cada clipe; cada arquivo definido 1 vez;
quadros dentro da duracao real do arquivo (se o XML fonte for passado);
marcadores dentro do range.

Uso: python3 validar.py --xml "/.../CORTE.xml" [--source "/.../Sequencia.xml"]
"""
import xml.etree.ElementTree as ET
import argparse

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xml', required=True)
    ap.add_argument('--source')
    a = ap.parse_args()

    filedur = {}
    if a.source:
        for f in ET.parse(a.source).getroot().iter('file'):
            if f.findtext('duration') and f.findtext('name'):
                filedur[f.get('id')] = int(f.findtext('duration'))

    seq = ET.parse(a.xml).getroot().find('sequence')   # levanta erro se malformado
    media = seq.find('media')
    prob = []

    def check(clips, label):
        pos = None
        for i, c in enumerate(clips):
            st, en = int(c.findtext('start')), int(c.findtext('end'))
            ii, oo = int(c.findtext('in')), int(c.findtext('out'))
            fid = c.find('file').get('id')
            if en - st != oo - ii:
                prob.append('%s clipe %d: len timeline != source' % (label, i))
            if pos is not None and st != pos:
                prob.append('%s clipe %d: furo/sobreposição (start %d != %d)' % (label, i, st, pos))
            pos = en
            if ii < 0:
                prob.append('%s clipe %d: in negativo' % (label, i))
            if fid in filedur and oo > filedur[fid]:
                prob.append('%s clipe %d: out %d > dur arquivo %d' % (label, i, oo, filedur[fid]))
        return pos

    vt = media.find('video').findall('track')
    at = media.find('audio').findall('track')
    ends = []
    ends.append(check(vt[0].findall('clipitem'), 'V1'))
    for k, tr in enumerate(at):
        if tr.findall('clipitem'):
            ends.append(check(tr.findall('clipitem'), 'A%d' % (k+1)))
    if len(set(ends)) > 1:
        prob.append('trilhas terminam em quadros diferentes: %s' % ends)

    defs = {}
    for f in seq.iter('file'):
        full = len(list(f)) > 0
        d = defs.setdefault(f.get('id'), [0, 0])
        d[0 if full else 1] += 1
    for fid, (full, ref) in defs.items():
        if full != 1:
            prob.append('arquivo %s definido %d vezes (esperado 1)' % (fid, full))

    TOTAL = int(seq.findtext('duration'))
    for m in seq.findall('marker'):
        mi, mo = int(m.findtext('in')), int(m.findtext('out'))
        if mi < 0 or mi > TOTAL or (mo != -1 and (mo < mi or mo > TOTAL)):
            prob.append('marcador fora do range: %s' % m.findtext('name'))

    nclips = len(vt[0].findall('clipitem'))
    print('clipes V1=%d | fim das trilhas=%s | duração=%d | marcadores=%d'
          % (nclips, ends, TOTAL, len(seq.findall('marker'))))
    if prob:
        print('PROBLEMAS (%d):' % len(prob))
        for p in prob[:40]:
            print('  -', p)
        raise SystemExit(1)
    print('SEM PROBLEMAS. Continuidade, A/V, defs de arquivo e marcadores OK.')

if __name__ == '__main__':
    main()
