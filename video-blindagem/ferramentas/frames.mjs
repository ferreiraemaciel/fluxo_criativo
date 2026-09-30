// Uso: node frames.mjs <saida> <t1> <t2> ...   (t em batidas, prefixo "b", ou segundos)
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const out = process.argv[2];
const args = process.argv.slice(3);
const BEAT = 60 / 98;
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto('file:///Users/ferreiraemaciel/Documents/fluxo-criativo/video-blindagem/' + (process.env.HTML || 'blindagem-video.html'), { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__hold = true; return window.__ready; });
page.on('pageerror', e => console.log('ERRO NA PÁGINA:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });

for (const a of args) {
  const t = a.startsWith('b') ? parseFloat(a.slice(1)) * BEAT : parseFloat(a);
  await page.evaluate(t => window.__seek(t), t);
  const name = `${out}/f_${a.replace('.', '_')}.png`;
  await page.screenshot({ path: name });
  console.log('ok', name);
}
await browser.close();
