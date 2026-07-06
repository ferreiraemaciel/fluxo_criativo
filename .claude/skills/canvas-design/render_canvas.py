import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.font_manager import FontProperties
from matplotlib.colors import to_rgba
import numpy as np
import os

FONTS_DIR = os.path.join(os.path.dirname(__file__), "canvas-fonts")

gloock        = FontProperties(fname=os.path.join(FONTS_DIR, "Gloock-Regular.ttf"))
ibm_mono      = FontProperties(fname=os.path.join(FONTS_DIR, "IBMPlexMono-Regular.ttf"))
ibm_mono_bold = FontProperties(fname=os.path.join(FONTS_DIR, "IBMPlexMono-Bold.ttf"))
crimson_it    = FontProperties(fname=os.path.join(FONTS_DIR, "CrimsonPro-Italic.ttf"))
crimson_reg   = FontProperties(fname=os.path.join(FONTS_DIR, "CrimsonPro-Regular.ttf"))
instrument_it = FontProperties(fname=os.path.join(FONTS_DIR, "InstrumentSerif-Italic.ttf"))

BG           = '#0c0b09'
IVORY        = '#ede5d0'
AMBER        = '#c4913a'
PALE_AMBER   = '#d4b878'
SLATE        = '#3a5270'
PALE_SLATE   = '#6a92b2'
SAGE_DARK    = '#5a6848'
SAGE_LIGHT   = '#8a9a70'
WARM_GREY    = '#786858'
LIGHT_GREY   = '#a89880'
CREAM        = '#c8bc9a'
NEAR_BLACK   = '#080a0d'

W, H = 12, 18
fig = plt.figure(figsize=(W, H), facecolor=BG, dpi=200)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.axis('off')
ax.set_facecolor(BG)

LEFT_M   = 1.1
RIGHT_M  = 10.9
CL       = 3.0
CR       = 9.0
CW       = CR - CL
DT       = 16.0
DB       = 2.2
TOTAL_H  = DT - DB

STRATA = [
    # (fraction, fill_color, pattern, label, depth_str, label_color)
    (0.022, SAGE_LIGHT,  'surface',    'I    SURFACE MEMBRANE',          'Θ 0.000', IVORY),
    (0.108, AMBER,       'stipple',    'II   LATENT RECOGNITION',        'Θ 0.022', IVORY),
    (0.006, '#d8d0b0',   'thin_rule',  None,                             'Θ 0.130', IVORY),
    (0.182, SLATE,       'hlines',     'III  SEDIMENT OF PRIOR KNOWING', 'Θ 0.136', IVORY),
    (0.128, CREAM,       'crosshatch', 'IV   FOLDED ATTENTION',          'Θ 0.318', IVORY),
    (0.005, '#404038',   'thin_rule',  None,                             'Θ 0.446', IVORY),
    (0.198, '#111520',   'scatter',    'V    RESIDUAL FIELD',            'Θ 0.451', IVORY),
    (0.152, '#272018',   'diagonal',   'VI   CRYSTALLINE FORGETTING',    'Θ 0.649', IVORY),
    (0.007, AMBER,       'thin_rule',  None,                             'Θ 0.801', IVORY),
    (0.178, NEAR_BLACK,  'basal',      'VII  BASAL VOID',                'Θ 0.808', IVORY),
    (0.014, '#4a3820',   'thin_rule',  None,                             'Θ 0.986', IVORY),
]

rng = np.random.default_rng(42)


def make_clip(ax, x, y, w, h):
    return patches.Rectangle((x, y), w, h, transform=ax.transData)


def scatter_clipped(ax, xs, ys, sizes, color, alpha_arr, clip_patch):
    rgba = np.array([to_rgba(color)] * len(xs))
    rgba[:, 3] = np.clip(alpha_arr, 0, 1)
    sc = ax.scatter(xs, ys, s=sizes, c=rgba, linewidths=0, zorder=3)
    sc.set_clip_path(clip_patch)
    return sc


def draw_stratum(ax, x0, x1, yb, yt, color, pattern):
    w = x1 - x0
    h = yt - yb
    ax.add_patch(patches.Rectangle((x0, yb), w, h,
                                   facecolor=color, edgecolor='none', zorder=2))

    if pattern == 'surface':
        n = int(w * h * 180)
        xs = rng.uniform(x0, x1, n)
        ys = rng.uniform(yb, yt, n)
        clip = make_clip(ax, x0, yb, w, h)
        scatter_clipped(ax, xs, ys, rng.uniform(0.3, 1.8, n), '#0c0b09',
                        rng.uniform(0.15, 0.4, n), clip)

    elif pattern == 'stipple':
        n = int(w * h * 320)
        xs = rng.uniform(x0, x1, n)
        ys = rng.uniform(yb, yt, n)
        clip = make_clip(ax, x0, yb, w, h)
        scatter_clipped(ax, xs, ys, rng.uniform(0.2, 2.8, n), '#0c0b09',
                        rng.uniform(0.08, 0.28, n), clip)
        xs2 = rng.uniform(x0, x1, n // 4)
        ys2 = rng.uniform(yb, yt, n // 4)
        clip2 = make_clip(ax, x0, yb, w, h)
        scatter_clipped(ax, xs2, ys2, rng.uniform(0.2, 1.0, n // 4), '#f0e8c0',
                        rng.uniform(0.04, 0.14, n // 4), clip2)

    elif pattern == 'hlines':
        spacing = 0.062
        ys_l = np.arange(yb + spacing / 2, yt, spacing)
        for yl in ys_l:
            alpha = float(rng.uniform(0.12, 0.30))
            lw    = float(rng.uniform(0.2, 0.55))
            ln, = ax.plot([x0, x1], [yl, yl],
                          color='#c8c0e0', linewidth=lw, alpha=alpha, zorder=3)
            ln.set_clip_path(make_clip(ax, x0, yb, w, h))

    elif pattern == 'crosshatch':
        spacing_h = 0.088
        ys_h = np.arange(yb + spacing_h / 2, yt, spacing_h)
        for yl in ys_h:
            ln, = ax.plot([x0, x1], [yl, yl],
                          color='#6a5830', linewidth=0.30, alpha=0.38, zorder=3)
            ln.set_clip_path(make_clip(ax, x0, yb, w, h))
        spacing_d = 0.20
        tan_a = 1.0
        for ox in np.arange(x0 - h * tan_a, x1, spacing_d):
            dx0, dy0 = ox, yb
            dx1 = ox + h * tan_a
            dy1 = yt
            if dx0 < x0:
                dy0 = yb + (x0 - dx0) / tan_a
                dx0 = x0
            if dx1 > x1:
                dy1 = yb + (x1 - ox) / tan_a
                dx1 = x1
            if dx0 >= dx1 or dy0 > yt or dy1 < yb:
                continue
            ln, = ax.plot([dx0, dx1], [dy0, dy1],
                          color='#6a5830', linewidth=0.22, alpha=0.18, zorder=3)
            ln.set_clip_path(make_clip(ax, x0, yb, w, h))

    elif pattern == 'scatter':
        n = int(w * h * 200)
        xs = rng.uniform(x0, x1, n)
        ys = rng.uniform(yb, yt, n)
        clip = make_clip(ax, x0, yb, w, h)
        alphas = np.clip(rng.exponential(0.18, n), 0, 0.55)
        scatter_clipped(ax, xs, ys, rng.uniform(0.4, 3.5, n), PALE_SLATE,
                        alphas, clip)
        for _ in range(int(w * h * 12)):
            rx = float(rng.uniform(x0 + 0.05, x1 - 0.12))
            ry = float(rng.uniform(yb + 0.02, yt - 0.05))
            rw = float(rng.uniform(0.02, 0.14))
            rh = float(rng.uniform(0.008, 0.028))
            r = patches.Rectangle((rx, ry), rw, rh,
                                   facecolor=PALE_SLATE, edgecolor='none',
                                   alpha=float(rng.uniform(0.08, 0.35)), zorder=3)
            ax.add_patch(r)

    elif pattern == 'diagonal':
        spacing = 0.082
        tan_a   = 0.52
        for ox in np.arange(x0 - h * tan_a * 2, x1 + w, spacing):
            dx0, dy0 = ox, yb
            dx1 = ox + h * tan_a
            dy1 = yt
            if dx0 < x0:
                dy0 = yb + (x0 - dx0) / tan_a
                dx0 = x0
            if dx1 > x1:
                dy1 = yb + (x1 - ox) / tan_a
                dx1 = x1
            if dx0 >= x1 or dx1 <= x0 or dy0 > yt or dy1 < yb:
                continue
            alpha = float(rng.uniform(0.08, 0.22))
            lw    = float(rng.uniform(0.18, 0.48))
            ln, = ax.plot([dx0, dx1], [dy0, dy1],
                          color=LIGHT_GREY, linewidth=lw, alpha=alpha, zorder=3)
            ln.set_clip_path(make_clip(ax, x0, yb, w, h))

    elif pattern == 'basal':
        n = int(w * h * 55)
        xs = rng.uniform(x0, x1, n)
        ys = rng.uniform(yb, yt, n)
        clip = make_clip(ax, x0, yb, w, h)
        alphas = np.clip(rng.exponential(0.06, n), 0, 0.45)
        scatter_clipped(ax, xs, ys, rng.uniform(0.2, 2.0, n), IVORY,
                        alphas, clip)


# ── Draw strata ─────────────────────────────────────────────────────────────
cur_y = DT
positions = []
for (frac, color, pat, label, depth, lc) in STRATA:
    h = frac * TOTAL_H
    bot = cur_y - h
    draw_stratum(ax, CL, CR, bot, cur_y, color, pat)
    positions.append((cur_y, bot, color, pat, label, depth, lc))
    cur_y = bot

# Core border
ax.add_patch(patches.Rectangle((CL, DB), CW, TOTAL_H,
                                facecolor='none', edgecolor=IVORY,
                                linewidth=0.55, alpha=0.30, zorder=10))

# Subtle inner shadow lines on core edges
for dx in [0.012, 0.025]:
    ax.plot([CL + dx, CL + dx], [DB, DT],
            color='#000000', linewidth=0.8, alpha=0.35, zorder=11)
    ax.plot([CR - dx, CR - dx], [DB, DT],
            color='#000000', linewidth=0.8, alpha=0.35, zorder=11)

# ── Depth axis ───────────────────────────────────────────────────────────────
AXIS_X = CL - 0.12
ax.plot([AXIS_X, AXIS_X], [DB, DT],
        color=IVORY, linewidth=0.38, alpha=0.28, zorder=5)

# Depth ticks and labels
for (top_y, bot_y, color, pat, label, depth, lc) in positions:
    ax.plot([AXIS_X - 0.12, AXIS_X + 0.0], [top_y, top_y],
            color=IVORY, linewidth=0.38, alpha=0.40, zorder=5)
    ax.text(AXIS_X - 0.17, top_y, depth,
            ha='right', va='center', fontsize=5.0,
            color=IVORY, fontproperties=ibm_mono, alpha=0.48, zorder=5)
    if label:
        mid = (top_y + bot_y) / 2
        ax.plot([CR + 0.05, CR + 0.18], [mid, mid],
                color=IVORY, linewidth=0.28, alpha=0.30, zorder=5)
        ax.text(CR + 0.22, mid, label,
                ha='left', va='center', fontsize=4.8,
                color=IVORY, fontproperties=ibm_mono, alpha=0.48, zorder=5)

ax.plot([AXIS_X - 0.12, AXIS_X + 0.0], [DB, DB],
        color=IVORY, linewidth=0.38, alpha=0.40, zorder=5)
ax.text(AXIS_X - 0.17, DB, 'Θ 1.000',
        ha='right', va='center', fontsize=5.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.48, zorder=5)

# Depth axis label (rotated)
ax.text(AXIS_X - 0.60, (DT + DB) / 2, 'DEPTH  (THETA SCALE)',
        ha='center', va='center', fontsize=4.5, rotation=90,
        color=IVORY, fontproperties=ibm_mono, alpha=0.28, zorder=5)

# ── Micro-detail: disturbance marks at stratum transitions ───────────────────
transitions = [p[0] for p in positions[1:]]
for ty in transitions:
    n_marks = 14
    xs_m = rng.uniform(CL + 0.05, CR - 0.05, n_marks)
    ys_m = rng.normal(ty, 0.03, n_marks)
    for xm, ym in zip(xs_m, ys_m):
        w_m = float(rng.uniform(0.04, 0.18))
        h_m = float(rng.uniform(0.005, 0.018))
        alpha_m = float(rng.uniform(0.08, 0.28))
        ax.add_patch(patches.Rectangle((xm, ym), w_m, h_m,
                                       facecolor='#ffffff', edgecolor='none',
                                       alpha=alpha_m, zorder=9))

# ── Title block ───────────────────────────────────────────────────────────────
# Top rule (double)
ax.plot([LEFT_M, RIGHT_M], [17.20, 17.20], color=IVORY, linewidth=0.5, alpha=0.18)
ax.plot([LEFT_M, RIGHT_M], [17.24, 17.24], color=IVORY, linewidth=0.18, alpha=0.18)

# Catalog ref (left)
ax.text(LEFT_M, 17.55, 'SR–Ω–001',
        ha='left', va='center', fontsize=5.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.30, zorder=5)

# Classification (right)
ax.text(RIGHT_M, 17.55, 'FIELD DOCUMENTATION SERIES  I',
        ha='right', va='center', fontsize=5.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.30, zorder=5)

# Movement name
ax.text(W / 2, 16.82, 'STRATIGRAPHIC  REVERIE',
        ha='center', va='center', fontsize=14.5,
        color=IVORY, fontproperties=gloock, alpha=0.88, zorder=5)

# Subtitle
ax.text(W / 2, 16.50, 'a cross-section of transitional states',
        ha='center', va='center', fontsize=6.5,
        color=IVORY, fontproperties=ibm_mono, alpha=0.36, zorder=5)

# ── Bottom block ──────────────────────────────────────────────────────────────
ax.plot([LEFT_M, RIGHT_M], [1.95, 1.95], color=IVORY, linewidth=0.5, alpha=0.18)
ax.plot([LEFT_M, RIGHT_M], [1.91, 1.91], color=IVORY, linewidth=0.18, alpha=0.18)

# Scale bar
SL = CL
SR_bar = CL + 1.0
SY = 1.55
ax.plot([SL, SR_bar], [SY, SY], color=IVORY, linewidth=0.9, alpha=0.40)
for tick_x in [SL, (SL + SR_bar) / 2, SR_bar]:
    ax.plot([tick_x, tick_x], [SY - 0.07, SY + 0.07],
            color=IVORY, linewidth=0.6, alpha=0.40)
ax.text(SL, SY - 0.20, '0',
        ha='center', va='center', fontsize=4.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.35)
ax.text(SR_bar, SY - 0.20, '1.0',
        ha='center', va='center', fontsize=4.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.35)
ax.text((SL + SR_bar) / 2, SY + 0.22, '1 UNIT',
        ha='center', va='center', fontsize=4.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.35)

# Metadata
ax.text(LEFT_M, 1.30, 'CORE SAMPLE  REF: SR-Ω-001',
        ha='left', va='center', fontsize=4.5,
        color=IVORY, fontproperties=ibm_mono, alpha=0.25, zorder=5)
ax.text(RIGHT_M, 1.30, 'DEPTH NOTATION  ·  THETA SCALE',
        ha='right', va='center', fontsize=4.5,
        color=IVORY, fontproperties=ibm_mono, alpha=0.25, zorder=5)

# Epigraph
ax.text(W / 2, 0.72,
        'The study of states which occur between other states.',
        ha='center', va='center', fontsize=5.8,
        color=IVORY, fontproperties=crimson_it, alpha=0.33, zorder=5)
ax.text(W / 2, 0.45,
        'Threshold phenomenology  ·  field documentation, series I.',
        ha='center', va='center', fontsize=5.0,
        color=IVORY, fontproperties=ibm_mono, alpha=0.25, zorder=5)

# ── Very faint background texture across entire canvas ─────────────────────
n_bg = 8000
bx = rng.uniform(0, W, n_bg)
by = rng.uniform(0, H, n_bg)
bg_rgba = np.zeros((n_bg, 4))
bg_rgba[:, 0:3] = to_rgba(IVORY)[:3]
bg_rgba[:, 3] = np.clip(rng.exponential(0.015, n_bg), 0, 0.06)
ax.scatter(bx, by, s=rng.uniform(0.1, 0.8, n_bg), c=bg_rgba, linewidths=0, zorder=1)

# ── Save ─────────────────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(__file__), 'stratigraphic-reverie.png')
plt.savefig(out, dpi=200, bbox_inches='tight', facecolor=BG, pad_inches=0)
plt.close()
print(f"Saved: {out}")
