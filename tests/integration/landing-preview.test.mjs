import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const output=process.env.LANDING_BUILD_DIR||'dist-landing';
const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
test('landing deploy exports only its entry page and presentation assets',()=>{
  const files=walk(output).map(file=>path.relative(output,file).replaceAll('\\','/'));
  assert.deepEqual(files.filter(file=>file.endsWith('.html')),['index.html']);
  assert(!files.some(file=>/InternalWorkspace|PublicPortal|ReaderWorkspace|\.map$|\.env|\.json$|\.sql$/.test(file)));
  assert(!files.some(file=>file.startsWith('_astro/')&&!file.endsWith('.css')));
});
test('preview navigation is disabled in HTML, including without JavaScript',()=>{
  const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
  const anchors=[...html.matchAll(/<a\b[^>]*>/g)].map(match=>match[0]);
  assert(!anchors.some(anchor=>/href=["']\/(?:sach|login|noi-bo|cong-dong)(?:\/|[?"'])/.test(anchor)));
  assert(anchors.filter(anchor=>anchor.includes('aria-disabled="true"')).length>=8);
  assert(!html.includes('blockNavigation'));
  assert.match(html,/href="https:\/\/www.facebook.com\/CLBYeuSachBachKhoaHaNoi\//);
});
test('preview denies connections and forms; unknown routes have no success fallback',()=>{
  const headers=fs.readFileSync(path.join(output,'_headers'),'utf8');
  assert.match(headers,/connect-src 'none'/);assert.match(headers,/form-action 'none'/);
  assert.match(headers,/frame-ancestors 'none'/);assert.match(headers,/script-src 'self' 'sha256-/);
  const config=fs.readFileSync('netlify.toml','utf8');
  assert.match(config,/publish\s*=\s*"dist-landing"/);
  assert(!config.includes('[[redirects]]'));
});
test('landing fonts are self-hosted, including Vietnamese glyphs',()=>{
  const css=walk(output).filter(file=>file.endsWith('.css')).map(file=>fs.readFileSync(file,'utf8')).join('\n');
  assert(!/fonts\.(?:googleapis|gstatic)\.com/.test(css),'font loading must not require Google or a CSP exception');
  for(const family of ['Be Vietnam Pro','Lora','Newsreader'])assert(css.includes(family));
  const fonts=[...css.matchAll(/url\(["']?(\/book\/assets\/[^)"']+\.woff2)/g)].map(match=>match[1]);
  assert(fonts.length>=3,'local WOFF2 faces must be present');
  for(const font of fonts)assert(fs.statSync(path.join(output,font.slice(1))).size>1000);
  assert.match(css,/U\+1EA0-1EF9/i,'Vietnamese precomposed characters must have a font face');
});
