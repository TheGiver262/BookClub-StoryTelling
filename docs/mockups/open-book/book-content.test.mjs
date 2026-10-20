import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chapters, galleryActivities } from './book-content.mjs';
import { timelineAt, readingEnd, totalUnits } from './book-timeline.mjs';

test('câu chuyện bắt đầu đúng ngày, đi từ con người đến hoạt động và kết bằng slogan', () => {
  assert.equal(chapters[0].id, 'origin');
  assert(chapters[0].lines[0].includes('16.09.2013'));
  assert.equal(chapters[0].photos[0].file, 'historical-team.png');
  assert.equal(chapters[1].id, 'people');
  assert.equal(chapters[1].kind, 'people');
  assert.equal(chapters[1].photos.length, 4);
  assert.equal(chapters[2].kind, 'gallery');
  assert.equal(galleryActivities.length, 6);
  assert.deepEqual(chapters.slice(3, -1).map(chapter => chapter.id), ['free-loans','book-night','weekly','vietnam-book-day','outdoors','recruitment']);
  assert.equal(chapters.at(-1).kind, 'slogan');
  assert.equal(chapters.at(-1).name, 'Mở sách đọc tương lai!');
});

async function markupRenderer() {
  const source = await readFile(new URL('book-v3.mjs', import.meta.url), 'utf8');
  // Chỉ chạy hàm tạo markup, không khởi tạo DOM hoặc điều khiển cuộn.
  return runInNewContext(source.slice(source.indexOf('const isLink'), source.indexOf('function scrollPanes')) + '; pageMarkup', { roman: index => String(index + 1) });
}

test('trang con người chia đúng hai ảnh mỗi bên, không lặp hoặc bỏ ảnh', async () => {
  const render = await markupRenderer();
  const chapter = chapters.find(chapter => chapter.id === 'people');
  const seen = [];
  for (const side of ['left', 'right']) {
    const html = render(chapter, 1, side, true);
    assert.equal([...html.matchAll(/<figure class="story-photo/g)].length, 2);
    assert(html.includes('photo-story count-2'));
    seen.push(...[...html.matchAll(/src="assets\/([^"]+)"/g)].map(match => match[1]));
  }
  assert.deepEqual(seen, chapter.photos.map(photo => photo.file));
});

test('hai vế slogan có đúng minh họa riêng và nội dung truy cập', async () => {
  const render = await markupRenderer();
  const chapter = chapters.at(-1);
  assert.equal(chapter.illustrations.length, 2);
  for (const [index, side] of ['left', 'right'].entries()) {
    const illustration = chapter.illustrations[index];
    const html = render(chapter, chapters.length - 1, side, true);
    assert(html.includes(`src="assets/${illustration.file}"`));
    assert(html.includes(`alt="${illustration.alt}"`));
    assert.equal([...html.matchAll(/class="slogan-illustration"/g)].length, 1);
    assert((await readFile(new URL(`assets/${illustration.file}`, import.meta.url))).length > 1000);
  }
});

test('bìa đủ tên Hà Nội, slogan dưới title và có logo đối tác ở chân bìa', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('book-v3.css', import.meta.url), 'utf8');
  const start = html.indexOf('<div class="cover-heading">');
  const cover = html.slice(start, html.indexOf('<div class="leaf-face leaf-back"', start));
  assert(cover.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').includes('Yêu Sách Bách Khoa Hà Nội'));
  assert(cover.indexOf('</h1>') < cover.indexOf('class="cover-tagline"'));
  assert(cover.indexOf('class="cover-tagline"') < cover.indexOf('class="cover-footer"'));
  assert(cover.includes('src="assets/partner-logos-clean-v8.svg"'));
  assert(cover.includes('Hà Nội · Từ 16.09.2013'));
  assert(css.includes("src:url('assets/dancing-script.ttf') format('truetype')"));
  const font = await readFile(new URL('assets/dancing-script.ttf', import.meta.url));
  assert.equal(font.readUInt32BE(0), 0x00010000, 'TrueType header');
  assert((await readFile(new URL('assets/partner-logos-clean-v8.svg', import.meta.url))).length > 1000);
});

test('slogan cong giữ tham chiếu path riêng khi sao chép bìa và không còn nhãn cuối cũ', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('book-v3.mjs', import.meta.url), 'utf8');
  const svg = html.match(/<svg class="cover-tagline"[\s\S]*?<\/svg>/)[0];
  assert(svg.includes('Mở sách đọc tương lai!'));
  assert(svg.includes('href="#cover-tagline-arc"'));
  const expression = script.match(/^const coverMarkup = (.+);$/m)[1];
  const clone = runInNewContext(expression, { $: () => ({ querySelector: () => ({ outerHTML: svg }) }) });
  assert(clone.includes('id="cover-tagline-live-arc"'));
  assert(clone.includes('href="#cover-tagline-live-arc"'));
  const ids = [...(html + clone).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert(!html.includes('Một cuốn sách. Một câu chuyện của chúng mình.'));
  assert(!script.includes("$('cover-label')"));
});

test('hai nút lật ở vùng riêng, dãy số trang nằm trong điều hướng giữa', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const sides = html.match(/<nav class="book-side-controls"[\s\S]*?<\/nav>/)[0];
  assert(sides.includes('id="previous"'));
  assert(sides.includes('id="next"'));
  assert(!sides.includes('id="chapter-nav"'));
  const controls = html.match(/<div class="controls"[\s\S]*?<\/div>/)[0];
  assert(controls.includes('id="chapter-nav"'));
  assert(!controls.includes('id="previous"') && !controls.includes('id="next"'));
});
test('ảnh trong từng chương tồn tại và có chú thích/nguồn, chi tiết hoạt động có hai ảnh', async () => {
  for (const [index, chapter] of chapters.entries()) {
    assert(chapter.sources.every(source => source.startsWith('https://')));
    if (index >= 3 && chapter.kind === 'story') assert.equal(chapter.photos.length, 2, chapter.id);
    for (const photo of [...(chapter.photos ?? []), ...(chapter.items ?? []).map(item => item.photo)]) {
      assert(photo.caption && photo.source);
      const bytes = await readFile(new URL(`assets/${photo.file}`, import.meta.url));
      assert(bytes.length > 1000, photo.file);
    }
  }
});
test('timeline hỗ trợ toàn bộ 10 chương và giữ nguyên điểm dừng khi quay lại', () => {
  assert.equal(chapters.length, 10);
  for (let index = 0; index < chapters.length; index++) {
    const state = timelineAt(readingEnd(index), chapters.length);
    assert.equal(state.index, index);
    assert.equal(state.mode, 'read');
    assert(Math.abs(state.read - 1) < 1e-9);
  }
  assert.equal(timelineAt(totalUnits(chapters.length) + 100, chapters.length).index, chapters.length - 1);
});
test('bộ ảnh mới khớp hoạt động và bỏ các nội dung đã ngừng', () => {
  const byId = Object.fromEntries(chapters.map(chapter => [chapter.id, chapter]));
  assert.deepEqual(byId.people.photos.map(photo => photo.file), ['members-current-group.jpg','members-current-friends.jpg','members-anniversary-13.jpg','members-current-campus.jpg']);
  assert.deepEqual(byId['book-night'].photos.map(photo => photo.file), ['book-night-group.jpg','book-night-sharing.jpg']);
  assert.deepEqual(byId['vietnam-book-day'].photos.map(photo => photo.file), ['vietnam-book-day-booth.jpg','vietnam-book-day-talk.jpg']);
  assert.deepEqual(byId.outdoors.photos.map(photo => photo.file), ['outdoors-big-game.jpg','outdoors-group.jpg']);
  assert.deepEqual(byId.recruitment.photos.map(photo => photo.file), ['recruitment-artemis.jpg','recruitment-interview.jpg']);
  assert(!/tặng giáo trình|giao lưu các clb|12 năm|textbooks|historical-outing|community\.jpg/i.test(JSON.stringify(chapters)));
  assert.equal(galleryActivities[3].title, 'Ngày Sách Việt Nam');
  const files = chapters.flatMap(chapter => (chapter.photos ?? []).map(photo => photo.file));
  assert(files.includes('loans-book-table.jpg'));
  const uploads = files.filter(file => !['historical-team.png','historical-reading.jpg','historical-trip.png','loan-user.jpg'].includes(file));
  assert.equal(new Set(uploads).size, 13);
});
test('logo CLB dùng path SVG, không nhúng ảnh hay mask PNG gây nhiễu viền', async () => {
  const color = JSON.parse(await readFile(new URL('logo-color.json', import.meta.url), 'utf8'));
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('book-v3.css', import.meta.url), 'utf8');
  assert.equal(color.hex, '#819079');
  assert(html.includes('class="cover-logo" role="img"'));
  assert(!html.includes('href="assets/logo-reference.jpg"'));
  assert(css.includes('--brand:#819079'));
  const logoStyle = css.match(/\.cover-logo\{([^}]+)\}/)[1];
  assert(logoStyle.includes('object-fit:contain'));
  assert(!/mask|background|border-radius|box-shadow/.test(logoStyle));
  assert(html.includes('src="assets/club-logo-v8.svg"'));
  assert(!css.includes('logo-restored-v6.png'));
  const svg = await readFile(new URL('assets/club-logo-v8.svg', import.meta.url), 'utf8');
  assert(svg.includes('fill="#819079"'));
  assert(svg.includes('shape-rendering="geometricPrecision"'));
  assert.equal([...svg.matchAll(/<path\b/g)].length, 4);
  assert(!/<image|data:image|<rect/i.test(svg));
});
