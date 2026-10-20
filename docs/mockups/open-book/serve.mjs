import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';

// Chỉ phục vụ các bản mockup và ảnh của chúng, tách khỏi web/API tại cổng 4321.
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/editorial-v1.html', ['editorial-v1.html', 'text/html; charset=utf-8']],
  ['/book.mjs', ['book.mjs', 'text/javascript; charset=utf-8']],
  ['/book-timeline.mjs', ['book-timeline.mjs', 'text/javascript; charset=utf-8']],
  ['/book-v2.html', ['book-v2.html', 'text/html; charset=utf-8']],
  ['/book-v2.mjs', ['book-v2.mjs', 'text/javascript; charset=utf-8']],
  ['/book-v3.mjs', ['book-v3.mjs', 'text/javascript; charset=utf-8']],
  ['/book-content.mjs', ['book-content.mjs', 'text/javascript; charset=utf-8']],
  ['/page-curl.mjs', ['page-curl.mjs', 'text/javascript; charset=utf-8']],
  ['/book-v3.css', ['book-v3.css', 'text/css; charset=utf-8']],
]);
const imageTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf' };
for (const name of await readdir(new URL('assets/', import.meta.url))) {
  if (/^[a-z0-9-]+\.(png|jpe?g|webp|svg|ttf)$/.test(name)) {
    files.set(`/assets/${name}`, [`assets/${name}`, imageTypes[name.split('.').at(-1)]]);
  }
}

const server = createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://127.0.0.1:4322').pathname);
  if (!['GET', 'HEAD'].includes(request.method) || !file) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      'Content-Type': file[1],
      'Cache-Control': file[1].startsWith('image/') ? 'private, max-age=3600' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': body.length,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500).end('Cannot read mockup file');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4322, '127.0.0.1', () => console.log('Mockup YSBK: http://localhost:4322'));
