"""Sintetiza os efeitos sonoros do vídeo e mistura com a trilha.
Tudo é original (síntese), afinado em Dó menor sobre as notas C, D e G, sem terça,
para não brigar com a música. Uso: python3 sfx.py sfx.json saida_mix.wav [sfx_only.wav]"""
import json, sys, subprocess, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(11)
import os
HERE = os.path.dirname(os.path.abspath(__file__))
# faixa e ponto de corte (primeiro tempo forte) vêm do ambiente; padrão: In It, 0,56 s
MUSIC = os.environ.get("MUSIC", os.path.join(HERE, "..", "trilhas", "in-it-kadant-98bpm.mp3"))
MUSIC_SS = float(os.environ.get("MUSIC_SS", "0.56"))

# notas (C, D, G) em várias oitavas
C4, D4, G4 = 261.63, 293.66, 392.00
C5, D5, G5 = 523.25, 587.33, 783.99
C6, D6, G6 = 1046.50, 1174.66, 1567.98
C7 = 2093.00

def T(n): return np.arange(n) / SR
def sine(f, n): return np.sin(2*np.pi*f*T(n))
def glide(f0, f1, n):
    f = np.linspace(f0, f1, n)
    return np.sin(2*np.pi*np.cumsum(f)/SR)
def env(n, a, d):
    t = T(n); return np.minimum(1.0, t/max(a, 1e-4)) * np.exp(-t/d)
def noise(n): return rng.standard_normal(n)
def smooth(x): x = np.clip(x, 0, 1); return x*x*(3 - 2*x)
def bp(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1/SR)
    m = smooth((f - lo*.7)/(lo*.3 + 1)) * (1 - smooth((f - hi)/(hi*.3 + 1)))
    return np.fft.irfft(X*m, len(x))
def hp(x, lo): return bp(x, lo, SR/2 - 1)
def lp(x, hi): return bp(x, 1, hi)
def norm(x, peak=1.0):
    m = np.max(np.abs(x)); return x/m*peak if m > 0 else x

def bell(f, dur=.9, amp=1.0):
    n = int(dur*SR); t = T(n); out = np.zeros(n)
    for r, a, dk in [(1, 1, 1.0), (2.01, .45, .6), (2.76, .3, .42), (4.07, .16, .28), (5.4, .09, .2)]:
        out += a*np.sin(2*np.pi*f*r*t)*np.exp(-t/(dur*dk/3.4))
    return amp*.4*out*np.minimum(1, t/.002)
def marimba(f, dur=.32, amp=1.0):
    n = int(dur*SR); t = T(n)
    out = np.sin(2*np.pi*f*t)*np.exp(-t/.09) + .5*np.sin(2*np.pi*f*3.99*t)*np.exp(-t/.03) + .2*np.sin(2*np.pi*f*9.2*t)*np.exp(-t/.012)
    return amp*.45*out*np.minimum(1, t/.001)

def whoosh(dur, f0, f1, amp=.4, tail=.12, crescendo=False):
    n = int((dur + tail)*SR); t = T(n)
    fs = np.geomspace(min(f0, f1), max(f0, f1), 7)
    if f0 > f1: fs = fs[::-1]
    out = np.zeros((n, 2))
    for j, fc in enumerate(fs):
        tc = dur*(j + .5)/len(fs)
        g = np.exp(-((t - tc)/(dur*.2))**2)
        for ch in (0, 1):
            out[:, ch] += bp(noise(n), fc/1.6, fc*1.6)*g
    shape = np.sin(np.pi*np.clip(t/(dur + tail), 0, 1))**1.5
    if crescendo: shape = np.clip(t/dur, 0, 1)**2 * np.exp(-np.maximum(0, t - dur)/.04)
    return norm(out*shape[:, None], amp)

# ---------------- efeitos ----------------
def s_click():
    n = int(.13*SR); out = np.zeros(n)
    d = hp(noise(int(.005*SR)), 2200); d *= np.hanning(len(d)); out[:len(d)] += .5*norm(d)
    out += .32*sine(1750, n)*env(n, .0005, .006) + .22*sine(640, n)*env(n, .0005, .013)
    o = int(.075*SR); m = n - o
    out[o:] += .24*sine(2150, m)*env(m, .0005, .004)
    return out*.85
def s_tap():
    n = int(.12*SR)
    return (.7*glide(240, 100, n)*env(n, .001, .03) + .25*lp(noise(n), 900)*env(n, .0005, .012))*.8
def s_key():
    n = int(.03*SR); f = rng.uniform(950, 1500)
    return (.5*sine(f, n)*env(n, .0004, .005) + .55*norm(bp(noise(n), 2500, 7000))*env(n, .0002, .004))*rng.uniform(.5, .85)*.5
def s_ptick():
    n = int(.025*SR); f = rng.uniform(1900, 2700)
    return (.4*sine(f, n)*env(n, .0003, .004) + .3*norm(hp(noise(n), 3500))*env(n, .0002, .003))*rng.uniform(.5, .8)*.45
def s_pop(vol=1.0):
    n = int(.1*SR)
    return (glide(430, 800, n)*env(n, .002, .03)*.5 + .12*norm(hp(noise(n), 2500))*env(n, .0005, .01))*vol
def s_tick(): return bell(G6, .25, .28)
def s_page(): return whoosh(.26, 700, 2400, .2)
def s_swipe(dur): return whoosh(dur, 500, 2600, .18)
def s_phoneIn():
    w = whoosh(.6, 250, 2600, .38); n = int(.5*SR)
    th = .5*glide(105, 50, n)*env(n, .004, .13)
    out = np.zeros((len(w) + int(.5*SR), 2)); out[:len(w)] += w
    o = int(.5*SR); out[o:o + n] += th[:, None]; return out
def s_phoneOut(): return whoosh(.55, 2400, 250, .3)
def s_modalIn():
    w = whoosh(.42, 300, 3600, .34); n = int(.35*SR)
    out = np.zeros((len(w) + int(.45*SR), 2)); out[:len(w)] += w
    o = int(.4*SR); out[o:o + n] += (.55*glide(120, 55, n)*env(n, .004, .1))[:, None]
    return out
def s_modalOut(): return whoosh(.38, 3000, 300, .26)
def s_count(dur, vol, f0):
    total = int((dur + .5)*SR); out = np.zeros(total); nt = int(dur*24)
    for k in range(nt):
        p = k/max(1, nt - 1); tk = (p**.85)*dur; f = f0*(1 + 1.6*p)
        n = int(.016*SR); i = int(tk*SR)
        out[i:i + n] += sine(f, n)*env(n, .0004, .004)*(.35 + .35*p)
    o = int(dur*SR); b = bell(f0*2.6, .5, .5); out[o:o + len(b)] += b[:total - o]
    return out*vol
def s_bar(i, vol=1.0):
    f = [C4, D4, G4, C5][i % 4]; n = int(.55*SR)
    sw = glide(f, f*1.5, n)*env(n, .02, .2)*.34 + .16*glide(2*f, 3*f, n)*env(n, .02, .14)
    t0 = int(.004*SR); sw[:t0] += .3*norm(hp(noise(t0), 3000))
    return sw*vol
def s_wasend():
    w = whoosh(.16, 400, 2200, .22); n = int(.09*SR)
    out = np.zeros((len(w) + int(.1*SR), 2)); out[:len(w)] += w
    o = int(.14*SR); out[o:o + n] += (.42*glide(600, 1300, n)*env(n, .002, .03))[:, None]; return out
def s_wareceive():
    n = int(.6*SR); out = np.zeros(n)
    for f, t in [(G5, 0.0), (C6, .115)]:
        m = marimba(f, .4, .9); i = int(t*SR); out[i:i + len(m)] += m
    pn = int(.06*SR); out[:pn] += .25*glide(300, 600, pn)*env(pn, .002, .02)
    return out*.9
def s_toast():
    n = int(.9*SR); out = np.zeros(n)
    for f, t in [(G5, 0), (C6, .09)]:
        b = bell(f, .6, .5); i = int(t*SR); out[i:i + len(b)] += b
    return out
def s_coin():
    n = int(1.2*SR); out = np.zeros(n)
    for f, t, a in [(G6, 0, .6), (C7, .075, .65), (D6, 0.0, .18), (G6, .03, .18), (C7, .06, .18), (2*G6, .09, .14)]:
        b = bell(f, 1.0, a); i = int(t*SR); out[i:i + len(b)] += b
    m = int(.012*SR); out[:m] += .3*norm(hp(noise(m), 6000))
    return out
def s_success():
    n = int(2.6*SR); out = np.zeros((n, 2))
    pn = int(.12*SR)
    pop = .8*norm(bp(noise(int(.03*SR)), 900, 7000))*env(int(.03*SR), .0005, .008)
    out[:len(pop)] += pop[:, None]
    out[:pn] += (.6*glide(170, 60, pn)*env(pn, .002, .04))[:, None]
    for i, f in enumerate([C5, D5, G5, C6, D6, G6]):
        b = bell(f, 1.2, .75); o = int((.05 + i*.06)*SR); out[o:o + len(b)] += b[:, None]
    gn = int(1.3*SR); t = T(gn)
    for ch in (0, 1):
        g = hp(noise(gn), 5200)*(.55 + .45*np.sin(2*np.pi*26*t + ch))*np.exp(-t/.5)*.16
        out[int(.08*SR):int(.08*SR) + gn, ch] += g[:n - int(.08*SR)]
    an = int(1.9*SR); ta = T(an)
    for ch in (0, 1):
        sp = (rng.random(an) < .0042).astype(float)
        ker = np.exp(-np.arange(int(.009*SR))/(.0016*SR))
        e = np.convolve(sp, ker)[:an]
        sig = bp(noise(an), 1300, 6500)*e*np.sin(np.pi*np.clip(ta/1.9, 0, 1))**.8
        o = int(.12*SR); out[o:o + an, ch] += .34*norm(sig)[:n - o]
    return out
def s_riser(dur):
    w = whoosh(dur, 250, 7000, .5, tail=.02, crescendo=True); n = int(dur*SR)
    s = glide(180, 900, n)*(T(n)/dur)**2*.14
    w[:n] += s[:, None]; return w
def s_logo():
    n = int(3.2*SR); out = np.zeros((n, 2)); bn = int(1.1*SR)
    out[:bn] += (.9*glide(112, 48, bn)*env(bn, .004, .3))[:, None]
    for i, f in enumerate([C5, G5, C6, D6]):
        b = bell(f, 2.4, .6); o = int(i*.02*SR); out[o:o + len(b)] += b[:, None]
    gn = int(1.4*SR); t = T(gn)
    for ch in (0, 1):
        g = hp(noise(gn), 4800)*(.6 + .4*np.sin(2*np.pi*20*t + ch))*np.exp(-t/.6)*.16
        out[:gn, ch] += g
    return out

def as_stereo(a, pan=0.0):
    if a.ndim == 2: return a
    L = a*(1 - max(0, pan)); R = a*(1 + min(0, pan)); return np.stack([L, R], 1)

def main():
    ev = json.load(open(sys.argv[1])); total = ev['total']; N = int(total*SR) + SR
    dry = np.zeros((N, 2)); wet = np.zeros((N, 2)); ducks = []
    def put(buf, arr, t, gain=1.0, pan=0.0):
        st = as_stereo(arr, pan)*gain; i = int(t*SR)
        if i >= N: return
        j = min(N, i + len(st)); buf[i:j] += st[:j - i]
    for e in ev['events']:
        t, ty = e['t'], e['type']; v = e.get('vol', 1.0)
        if ty == 'click': put(dry, s_click(), t, .95*v)
        elif ty == 'tap': put(dry, s_tap(), t, .9*v)
        elif ty == 'key': put(dry, s_key(), t, v*1.8, rng.uniform(-.12, .12))
        elif ty == 'ptick': put(dry, s_ptick(), t, v*1.8, rng.uniform(-.1, .1))
        elif ty == 'pop': put(dry, s_pop(v), t)
        elif ty == 'tick': put(dry, s_tick(), t, .8); put(wet, s_tick(), t, .3)
        elif ty == 'page': put(dry, s_page(), t, 1.4)
        elif ty == 'swipe': put(dry, s_swipe(e['dur']), t, 1.3)
        elif ty == 'phoneIn': put(dry, s_phoneIn(), t, .95)
        elif ty == 'phoneOut': put(dry, s_phoneOut(), t)
        elif ty == 'modalIn': m = s_modalIn(); put(dry, m, t, .95); put(wet, bell(C6, .5, .25), t + .42, 1.0)
        elif ty == 'modalOut': put(dry, s_modalOut(), t)
        elif ty == 'count': c = s_count(e['dur'], v, e['f0']); put(dry, c, t); put(wet, c, t, .25)
        elif ty == 'bar': b = s_bar(e['i'], v); put(dry, b, t, .85); put(wet, b, t, .35)
        elif ty == 'term': b = bell([C5, D5, G5, C6, D6, G6, D6, G6, C7][e['k']], .6, .55); put(dry, b, t, .8); put(wet, b, t, .3)
        elif ty == 'wasend': put(dry, s_wasend(), t, .9)
        elif ty == 'wareceive': w = s_wareceive(); put(dry, w, t, .95); put(wet, w, t, .18)
        elif ty == 'toast': w = s_toast(); put(dry, w, t, .8); put(wet, w, t, .4)
        elif ty == 'coin': w = s_coin(); put(dry, w, t, .9*v); put(wet, w, t, .35*v); ducks.append((t, 3.0, .7))
        elif ty == 'success': w = s_success(); put(dry, w, t, .62); put(wet, w, t, .3); ducks.append((t, 5.0, 1.5))
        elif ty == 'riser': put(dry, s_riser(e['dur']), t, .9)
        elif ty == 'logo': w = s_logo(); put(dry, w, t, .5); put(wet, w, t, .3); ducks.append((t, 4.5, 2.0))

    # reverberação suave nos envios
    irn = int(1.7*SR); ir = noise(irn)*np.exp(-T(irn)/.42); ir = lp(ir, 6500); ir = ir/np.sqrt(np.sum(ir**2))
    L = 1 << int(np.ceil(np.log2(N + irn)))
    rev = np.zeros((N, 2))
    irf = np.fft.rfft(ir, L)
    for ch in (0, 1):
        rev[:, ch] = np.fft.irfft(np.fft.rfft(wet[:, ch], L)*irf, L)[:N]
    sfx = dry + rev*.55

    # música: corta no 1º tempo forte, com abertura e fechamento suaves
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(MUSIC_SS), "-t", f"{total:.3f}", "-i", MUSIC, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    mus = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    m = np.zeros((N, 2)); m[:len(mus)] = mus[:N]
    tt = T(N)
    fade = np.clip(tt/.25, 0, 1)*np.clip((total - tt)/1.6, 0, 1)
    # rebaixa a música nos momentos de festa
    cr = 1000; nc = int(N/SR*cr) + 2; tgt = np.zeros(nc)
    for t0, db, dur in ducks:
        a, b = int(t0*cr), int((t0 + dur)*cr); tgt[a:b] = np.maximum(tgt[a:b], db)
    g = np.zeros(nc); cur = 0.0
    for i in range(nc):
        k = 1 - np.exp(-1/(cr*(.03 if tgt[i] > cur else .35)))
        cur += (tgt[i] - cur)*k; g[i] = cur
    gain = 10**(-np.interp(tt, np.arange(nc)/cr, g)/20)
    mix = m*(0.80*fade*gain)[:, None] + sfx
    pk = np.max(np.abs(mix))
    if pk > .97: mix = np.tanh(mix*.95/pk*1.2)/np.tanh(1.2)*.97
    mix = mix[:int(total*SR)]
    def wr(path, a):
        pcm = (np.clip(a, -1, 1)*32767).astype(np.int16)
        with wave.open(path, 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    wr(sys.argv[2], mix)
    if len(sys.argv) > 3: wr(sys.argv[3], np.clip(sfx[:int(total*SR)], -1, 1))
    print("pico da mistura: %.2f  pico só dos efeitos: %.2f  eventos: %d" % (np.max(np.abs(mix)), np.max(np.abs(sfx)), len(ev['events'])))

if __name__ == "__main__":
    main()
