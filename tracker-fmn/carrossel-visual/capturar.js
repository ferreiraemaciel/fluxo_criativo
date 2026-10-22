// Fotografa cada página HTML montada pelo montar.py.
// Uso: node capturar.js <pasta-do-carrossel>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const pasta = path.resolve(process.argv[2] || '.');
  const paginas = fs.readdirSync(pasta).filter(f => /^\d+\.html$/.test(f))
                    .map(f => parseInt(f)).sort((a, b) => a - b);
  fs.mkdirSync(path.join(pasta, 'final'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const i of paginas) {
    await p.goto('file://' + path.join(pasta, i + '.html'));
    await p.waitForTimeout(900);          // tempo da fonte carregar e o encaixe rodar
    await p.screenshot({ path: path.join(pasta, 'final', i + '.png') });
  }
  await b.close();
  console.log(paginas.length + ' slides prontos em final/');
})();
