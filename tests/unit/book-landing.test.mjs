import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chapters } from '../../public/book/book-content.mjs';

async function renderer(name = 'pageMarkup') {
  const source = await readFile(new URL('../../public/book/book.mjs', import.meta.url), 'utf8');
  const book = await readFile(new URL('../../src/components/BookLanding.astro', import.meta.url), 'utf8');
  const coverMarkup = book.match(/(<div class="leaf-face leaf-front cover-front cover">[\s\S]*?)<div class="leaf-face leaf-back"/)[1].replace('leaf-face leaf-front', 'paper-cover');
  return runInNewContext(source.slice(source.indexOf('const isLink'), source.indexOf('function scrollPanes')) + `; ${name}`, {
    roman: i => String(i + 1), assetRoot: '/book/assets/', coverMarkup, chapters,
  });
}

test('mở bìa tới bìa phụ: trái trắng, phải cùng thiết kế bìa nhưng là giấy; sau đó mới giới thiệu', async () => {
  const render = await renderer('spreadMarkup');
  const left = render(0, 'left');
  const right = render(0, 'right');
  assert(!/<img|<h[12]|class="page-top"|class="page-num"/.test(left));
  assert(right.includes('paper-cover'));
  assert(right.includes('Mở sách, đọc tương lai'));
  assert(right.includes('club-logo-v8.svg'));
  assert(right.includes('partner-logos-clean-v8.svg'));
  assert(!right.includes('leaf-face'));
  assert(!right.includes('class="page-num"'));
  assert.notEqual(right.match(/id="(paper-tagline-[^"]+)"/)[1], render(0, 'right').match(/id="(paper-tagline-[^"]+)"/)[1]);
  assert(render(1, 'left').includes('historical-team.png'));
  assert(render(1, 'right').includes('16.09.2013'));
  assert(render(1, 'left').includes('class="page-num">01'));
  assert(render(10, 'right').includes('class="page-num">20'));
});

test('nội dung xuất bản đủ 10 chương/20 trang, ảnh thật và ngày thành lập', async () => {
  const render = await renderer();
  assert.equal(chapters.length, 10);
  assert(chapters[0].lines[0].includes('16.09.2013'));
  const seen = [];
  for (const [index, chapter] of chapters.entries()) for (const side of ['left', 'right']) {
    const html = render(chapter, index, side, true);
    assert.equal((html.match(/class="page-top"/g) || []).length, 1, 'mọi trang dùng chỉ mục chung');
    assert(html.includes(`class="page-num">${String(index * 2 + (side === 'left' ? 1 : 2)).padStart(2, '0')}`));
    for (const match of html.matchAll(/src="\/book\/assets\/([^"/]+)"/g)) {
      assert((await readFile(new URL('../../public/book/assets/' + match[1], import.meta.url))).length > 1000);
      if (chapter.kind === 'people') seen.push(match[1]);
    }
  }
  assert.deepEqual(seen, chapters[1].photos.map(photo => photo.file));
});

test('ảnh trang kết ẩn khi vào, hiện sau chữ; bản in hiện đủ và đúng số trang', async () => {
  const render = await renderer();
  for (const [index, side] of ['left', 'right'].entries()) {
    const unread = render(chapters.at(-1), 9, side);
    assert(unread.includes(`data-slogan-stage="${index * 2}" style="opacity:0"`));
    assert(unread.includes(`data-slogan-stage="${index * 2 + 1}" style="opacity:0"`));
    const printed = render(chapters.at(-1), 9, side, true);
    assert.equal((printed.match(/style="opacity:1"/g) || []).length, 2);
  }
});

test('trang chính nối hướng dẫn sau sách và tủ sách mở tab riêng', async () => {
  const home = await readFile(new URL('../../src/pages/index.astro', import.meta.url), 'utf8');
  const book = await readFile(new URL('../../src/components/BookLanding.astro', import.meta.url), 'utf8');
  assert(home.indexOf('<BookLanding') < home.indexOf('id="cach-muon"'));
  assert.match(home, /href="\/sach\/" target="_blank" rel="noopener"/);
  assert.match(book, /href="\/sach\/" target="_blank" rel="noopener"/);
  assert(!/Bản trước|BẢN THỬ|editorial-v1|book-v2/.test(book));
});

test('cuộn ngoài animation ngắt điều hướng, sai số subpixel của chính animation không ngắt', async () => {
  const source = await readFile(new URL('../../public/book/book.mjs', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('function onScroll()'), source.indexOf('function jump('));
  for (const [actual, expected, active, shouldCancel] of [[101, 100, 1, false], [140, 100, 1, true], [140, null, 0, false]]) {
    let cancelled = false, scheduled = false;
    const run = runInNewContext(handler + '; onScroll', {
      navigationFrame: active, navigationTop: expected, scrollY: actual,
      cancelNavigation: () => { cancelled = true; }, schedule: () => { scheduled = true; },
    });
    run();
    assert.equal(cancelled, shouldCancel);
    assert(scheduled);
  }
});
