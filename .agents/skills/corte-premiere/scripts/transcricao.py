# -*- coding: utf-8 -*-
"""
transcricao.py — Le a transcricao da sequencia e devolve o texto com timecode,
pronto pro modelo ler e montar a decupagem. Aceita:

  --json  transcricao word-level (formato com segments[].words[].start/duration)
  --srt   arquivo .srt (blocos com "HH:MM:SS,mmm --> HH:MM:SS,mmm")

Opcional:
  --scan "volvo,mercedes,man,iveco,daf"   varre o texto e mostra ocorrencias
                                          (util p/ checar mencao a marcas)
  --janela 600   (segundos) imprime so ate esse tempo, pra amostra

REGRA DE OURO: a transcricao tem que ser da SEQUENCIA MONTADA, nao dos clipes
crus. So assim o tempo da transcricao == tempo da timeline, e o corte bate no
frame certo.
"""
import argparse, json, io, re

def from_json(path):
    d = json.load(io.open(path, encoding='utf-8'))
    segs = []
    for s in d.get('segments', []):
        ws = s.get('words', [])
        if not ws:
            continue
        start = ws[0]['start']
        end = ws[-1]['start'] + ws[-1].get('duration', 0)
        txt = ' '.join(w['text'] for w in ws)
        segs.append((start, end, txt))
    return segs

def from_srt(path):
    raw = io.open(path, encoding='utf-8-sig').read()
    segs = []
    for blk in re.split(r'\n\s*\n', raw.strip()):
        lines = [l for l in blk.splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        tl = next((l for l in lines if '-->' in l), None)
        if not tl:
            continue
        a, b = [t.strip() for t in tl.split('-->')]
        def s(tc):
            tc = tc.replace(',', '.'); h, m, sec = tc.split(':')
            return int(h)*3600 + int(m)*60 + float(sec)
        txt = ' '.join(l for l in lines if l is not tl and '-->' not in l and not l.strip().isdigit())
        segs.append((s(a), s(b), txt))
    return segs

def tc(sec):
    return '%02d:%02d:%06.3f' % (int(sec//3600), int((sec % 3600)//60), sec % 60)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json'); ap.add_argument('--srt')
    ap.add_argument('--scan', default='')
    ap.add_argument('--janela', type=float, default=0)
    a = ap.parse_args()
    segs = from_json(a.json) if a.json else from_srt(a.srt)

    if a.scan:
        full = ' '.join(t for _, _, t in segs).lower()
        print('=== VARREDURA ===')
        hit = False
        for term in [t.strip().lower() for t in a.scan.split(',') if t.strip()]:
            for m in re.finditer(re.escape(term), full):
                hit = True
                i = m.start()
                print("  '%s': ...%s..." % (term, full[max(0, i-50):i+50]))
        if not hit:
            print('  nenhuma ocorrência dos termos buscados.')
        print()

    print('=== TRANSCRIÇÃO COM TIMECODE (%d segmentos) ===' % len(segs))
    for st, en, txt in segs:
        if a.janela and st > a.janela:
            break
        print('[%s -> %s] %s' % (tc(st), tc(en), txt))

if __name__ == '__main__':
    main()
