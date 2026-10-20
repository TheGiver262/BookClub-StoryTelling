import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const DIAGRAMS_DIR = path.resolve('docs/technical/diagrams');

async function renderDiagrams() {
  const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  console.log(`Using Chrome at: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const mmdFiles = fs.readdirSync(DIAGRAMS_DIR).filter(f => f.endsWith('.mmd'));
  console.log(`Found ${mmdFiles.length} Mermaid diagram files to render.`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 2 });

  // Load a base page with Mermaid JS
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 30px;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: inline-block;
          }
          #container {
            display: inline-block;
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div id="container"></div>
        <script>
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
              primaryColor: '#FEE2E2',
              primaryTextColor: '#991B1B',
              primaryBorderColor: '#DC2626',
              lineColor: '#151879',
              secondaryColor: '#FEF3C7',
              tertiaryColor: '#F3F4F6',
              fontFamily: 'Be Vietnam Pro, Segoe UI, sans-serif'
            }
          });
        </script>
      </body>
    </html>
  `, { waitUntil: 'networkidle0' });

  for (const file of mmdFiles) {
    const baseName = path.basename(file, '.mmd');
    const mmdPath = path.join(DIAGRAMS_DIR, file);
    const mmdContent = fs.readFileSync(mmdPath, 'utf8');

    console.log(`Rendering ${file}...`);
    try {
      const renderResult = await page.evaluate(async (code, id) => {
        try {
          const { svg } = await window.mermaid.render('mermaid-' + id, code);
          const container = document.getElementById('container');
          container.innerHTML = svg;
          return { success: true, svg };
        } catch (err) {
          return { success: false, error: err.message || String(err) };
        }
      }, mmdContent, baseName.replace(/[^a-zA-Z0-9]/g, '_'));

      if (!renderResult.success) {
        console.error(`  [FAILED] ${file}: ${renderResult.error}`);
        continue;
      }

      // Save SVG
      const svgPath = path.join(DIAGRAMS_DIR, `${baseName}.svg`);
      fs.writeFileSync(svgPath, renderResult.svg, 'utf8');

      // Take PNG screenshot of container
      const containerEl = await page.$('#container');
      const pngPath = path.join(DIAGRAMS_DIR, `${baseName}.png`);
      if (containerEl) {
        await containerEl.screenshot({ path: pngPath, omitBackground: false });
      }

      console.log(`  [OK] Saved ${baseName}.svg and ${baseName}.png`);
    } catch (err) {
      console.error(`  [ERROR] Exception on ${file}:`, err);
    }
  }

  await browser.close();
  console.log('Diagram rendering completed!');
}

renderDiagrams().catch(console.error);
