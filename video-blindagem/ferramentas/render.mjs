// Renderiza o vídeo quadro a quadro pelo Chrome e junta com a trilha via ffmpeg.
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';

const FPS = 30;
const BEAT = 60 / 98;
const TOTAL = (parseFloat(process.env.BEATS) || 104) * BEAT;
const FRAMES = Math.round(TOTAL * FPS);
const AUDIO = process.env.AUDIO || '/Users/ferreiraemaciel/Downloads/ES_In It (Instrumental Version) - Kadant.mp3';
const AUDIO_SS = process.env.AUDIO_SS !== undefined ? parseFloat(process.env.AUDIO_SS) : 0.56;                          // primeiro tempo forte da faixa
const OUT = process.argv[2] || '/Users/ferreiraemaciel/Documents/fluxo-criativo/video-blindagem/blindagem-apresentacao.mp4';
const LIMIT = process.argv[3] ? parseInt(process.argv[3]) : FRAMES;   // para testes curtos

const ff = spawn('ffmpeg', [
  '-y', '-v', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-ss', String(AUDIO_SS), '-i', AUDIO,
  '-t', String(LIMIT / FPS),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '256k',
  ...(process.env.NOFADE ? [] : ['-af', `afade=t=in:st=0:d=0.25,afade=t=out:st=${(TOTAL - 1.6).toFixed(2)}:d=1.6`]),
  '-movflags', '+faststart',
  OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const done = new Promise((res, rej) => { ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg saiu com código ' + c))); });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERRO NA PÁGINA:', e.message));
await page.goto('file:///Users/ferreiraemaciel/Documents/fluxo-criativo/video-blindagem/' + (process.env.HTML || 'blindagem-video.html') + (process.env.QUERY ? '?' + process.env.QUERY : ''), { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__hold = true; return window.__ready; });

const t0 = Date.now();
for (let i = 0; i < LIMIT; i++) {
  await page.evaluate(t => window.__seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`quadro ${i}/${LIMIT}  (${(i / LIMIT * 100).toFixed(0)}%)  ${el.toFixed(0)}s decorridos`);
  }
}
ff.stdin.end();
await done;
await browser.close();
console.log('PRONTO', OUT, ((Date.now() - t0) / 1000).toFixed(0) + 's');
