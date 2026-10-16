// Captura a arte de Novidade de Produto quadro a quadro e monta o MP4.
// Uso: node capturar.js <arquivo.html> <pasta-de-saida> <nome> [fps]
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

(async () => {
  const [html, saida, nome, fpsArg] = process.argv.slice(2);
  const fps = Number(fpsArg) || 30;
  const quadros = path.join(__dirname, 'quadros', nome);
  fs.rmSync(quadros, { recursive: true, force: true });
  fs.mkdirSync(quadros, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(html), { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.getElementById('rel'), { timeout: 30000 }); // o ajuste de texto terminou
  const duracao = await page.evaluate(() => window.__montar());
  const total = Math.ceil(duracao * fps);
  console.log(`Duração ${duracao.toFixed(2)}s, ${total} quadros a ${fps} fps`);

  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__ir(t), i / fps);
    await page.screenshot({ path: path.join(quadros, String(i).padStart(5, '0') + '.png'), type: 'png' });
    if (i % 30 === 0) process.stdout.write(`  quadro ${i}/${total}\r`);
  }
  await browser.close();

  const mp4 = path.resolve(saida, nome + '.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(quadros, '%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', mp4]);
  console.log('\nMP4: ' + mp4);
})().catch((e) => { console.error(e); process.exit(1); });
