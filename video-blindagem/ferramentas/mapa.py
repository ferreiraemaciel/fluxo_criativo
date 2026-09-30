"""Mapa de uma trilha: andamento, fase da batida, primeiro tempo forte, tom e energia por compasso.
Uso: python3 mapa.py <arquivo.mp3> <bpm_da_etiqueta>"""
import subprocess, sys, numpy as np
SRC = sys.argv[1]; BPM_TAG = float(sys.argv[2])
SR = 11025
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
hop = int(SR*.01); n = len(x)//hop
env = np.log1p(np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)) for i in range(n)])*50)
flux = np.maximum(0, np.diff(env, prepend=env[0])); fps = 100.0

def score(bpm, per, ph, limit=None):
    period = 60.0/bpm*per*fps
    m = n if limit is None else min(n, int(limit*fps))
    idx = (ph*fps + np.arange(0, int((m - ph*fps)/period))*period).astype(int); idx = idx[idx < m]
    return flux[idx].sum()/max(1, len(idx))

# confirma o andamento
best = []
for bpm in np.arange(BPM_TAG - 4, BPM_TAG + 4.01, .1):
    period = 60.0/bpm*fps
    best.append((max(score(bpm, 1, p/fps, 90) for p in np.arange(0, period, 1.0)), bpm))
best.sort(reverse=True)
print("melhores BPM medidos:", [(round(float(b), 1), round(float(s), 3)) for s, b in best[:3]])

beat = 60.0/BPM_TAG
ph = float(np.arange(0, beat, .005)[int(np.argmax([score(BPM_TAG, 1, p, 90) for p in np.arange(0, beat, .005)]))])
cand = [(score(BPM_TAG, 4, ph + k*beat, 90), ph + k*beat) for k in range(4)]
down = max(cand)[1]
print("fase da batida: %.3fs | candidatos a tempo 1: %s | primeiro tempo forte: %.3fs" % (ph, [(round(float(a), 3), round(float(b), 2)) for a, b in cand], down))

# tom
N = 8192; hp = 4096; win = np.hanning(N)
freqs = np.fft.rfftfreq(N, 1/SR); msk = (freqs > 60) & (freqs < 2000)
pcs = np.round(12*np.log2(np.maximum(freqs, 1e-3)/440.0) + 69).astype(int) % 12
ch = np.zeros(12); a0, a1 = int(20*SR), int(min(len(x)/SR, 80)*SR)
for i in range(a0, a1 - N, hp):
    sp = np.abs(np.fft.rfft(x[i:i+N]*win))**2
    for k in np.where(msk)[0]: ch[pcs[k]] += sp[k]
ch /= ch.sum()
names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
res = sorted([(np.corrcoef(ch, np.roll(maj, k))[0, 1], names[k] + " maior") for k in range(12)] + [(np.corrcoef(ch, np.roll(mnr, k))[0, 1], names[k] + " menor") for k in range(12)], reverse=True)
print("tom provável:", [(nm, round(float(c), 3)) for c, nm in res[:3]])
print("cromagrama:", {names[i]: round(float(ch[i]), 3) for i in range(12) if ch[i] > .06})

# energia por compasso
bar = beat*4; total = len(x)/SR
print("energia por compasso (compasso: início em s do arquivo | energia):")
b = 0; row = []
while down + (b + 1)*bar < total and b < 80:
    a = int((down + b*bar)*fps); z = int((down + (b + 1)*bar)*fps)
    row.append((b + 1, down + b*bar, float(np.mean(env[a:z]))))
    b += 1
prev = None
for k, t0, e in row:
    tag = ""
    if prev is not None:
        d = e - prev
        if d > .45: tag = "  <-- SOBE"
        elif d < -.45: tag = "  <-- CAI"
    print("  %2d  %6.1fs  %.2f%s" % (k, t0, e, tag)); prev = e
