import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('standalone preview contains no backend, app pages or runtime dependencies', () => {
  for (const name of ['src/server','src/modules','src/lib','src/data','src/pages/api','src/pages/sach','src/pages/noi-bo.astro','src/pages/login.astro','docker','compose.local.yml','wrangler.json','wrangler.beta.json','.env.beta']) {
    assert(!fs.existsSync(name), name + ' must remain outside the landing branches');
  }
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@astrojs/tailwind','astro']);
  assert(!Object.keys(pkg.scripts).some(name=>/beta|server|local:|test:db/.test(name)));
  const config=fs.readFileSync('astro.config.mjs','utf8');
  assert(!/proxy|react|BACKEND_URL/.test(config));
  assert.match(config,/PUBLIC_LANDING_ONLY = 'true'/);
});
