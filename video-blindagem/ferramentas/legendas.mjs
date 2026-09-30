// Renderiza cada legenda como vídeo ProRes 4444 com canal alfa (fundo transparente), 1920x1080, 30 quadros por segundo.
// Uso: node legendas.mjs [números separados por vírgula]   ex.: node legendas.mjs 1,4
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';

const FPS = 30;
const BASE = '/Users/ferreiraemaciel/Documents/fluxo-criativo/video-blindagem';
const OUT = BASE + '/legendas';
fs.mkdirSync(OUT, { recursive: true });

const CLIPS = [
  { n: 1, slug: 'voce-escolhe-o-modelo',       texto: 'Você escolhe o modelo|e preenche o trabalho', dur: 6.49,  anim: 1, size: 112 },
  { n: 2, slug: 'cliente-recebe-o-link',       texto: 'O cliente recebe o link|no WhatsApp',         dur: 2.69,  anim: 2, size: 128 },
  { n: 3, slug: 'e-assina-pelo-celular',       texto: 'E assina pelo celular',                       dur: 4.29,  anim: 3, size: 140 },
  { n: 4, slug: 'assinou',                     texto: 'Assinou',                                     dur: 2.57,  anim: 4, size: 300, cor: '#fbbf24' },
  { n: 5, slug: 'voce-assina-em-seguida',      texto: 'Você assina em seguida',                      dur: 5.20,  anim: 5, size: 132 },
  { n: 6, slug: 'cada-passo-fica-registrado',  texto: 'Cada passo|fica registrado',                  dur: 5.64,  anim: 6, size: 136 },
  { n: 7, slug: 'painel-mostra-o-que-blindou', texto: 'O painel mostra|o que você blindou',          dur: 11.33, anim: 7, size: 120 },
];
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=1'] });
for (const c of CLIPS) {
  if (only && !only.includes(c.n)) continue;
  const frames = Math.round(c.dur * FPS), dur = frames / FPS;
  const file = `${OUT}/legenda-${String(c.n).padStart(2, '0')}-${c.slug}.mov`;
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg ' + code))));
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`file://${BASE}/legenda.html?texto=${encodeURIComponent(c.texto)}&dur=${dur}&anim=${c.anim}&size=${c.size}${c.cor ? '&cor=' + encodeURIComponent(c.cor) : ''}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.__ready);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.__seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'png', omitBackground: true });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await done; await page.close();
  console.log('PRONTO', file, frames + ' quadros', dur.toFixed(2) + ' s');
}
await browser.close();
