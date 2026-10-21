import { clamp, timelineAt, arrowTarget, readingEnd, totalUnits, lineProgress, navigationSegments, navigationAt, sloganProgress, snapBookPosition } from './book-timeline.mjs';
import { curlAt, polygon } from './page-curl.mjs';
import { chapters } from './book-content.mjs';

const $ = id => document.getElementById(id);
const count = chapters.length + 1;
const roman = index => ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'][index];
const spreadLabel = index => index === 0 ? 'Bìa phụ' : `Chương ${roman(index - 1)}: ${chapters[index - 1].name}`;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reduceQuery.matches;
let pixelsPerUnit = 800, width = 500, height = 600;
let key = '', queued = false, announcement = '';
let lines = [], panes = [];
let navigationFrame = 0;
let navigationTop = null;
const assetRoot = '/book/assets/';
const coverMarkup = $('cover-leaf').querySelector('.cover-front').outerHTML.replace('leaf-face leaf-front', 'paper-cover');

const isLink = source => /^https:\/\//.test(source);
let paperSerial = 0;
function imageMarkup(photo, extraClass = '') {
  const image = `<img src="${assetRoot}${photo.file}" alt="${photo.caption}" style="object-position:${photo.position};transform:scale(${photo.zoom ?? 1})" draggable="false">`;
  return `<figure class="story-photo ${extraClass}">${isLink(photo.source) ? `<a href="${photo.source}" target="_blank" rel="noreferrer">${image}</a>` : `<div class="story-image">${image}</div>`}<figcaption>${photo.caption}</figcaption></figure>`;
}
function pageMarkup(chapter, index, side, full = false) {
  const number = String(index * 2 + (side === 'left' ? 1 : 2)).padStart(2, '0');
  const footer = `<span class="page-num">${number}</span>`;
  const header = `<div class="page-top"><span>Yêu Sách Bách Khoa</span><span>${roman(index)} / ${chapter.name}</span></div>`;
  if (chapter.kind === 'people') {
    const first = side === 'left';
    const photos = chapter.photos.slice(first ? 0 : 2, first ? 2 : 4);
    const intro = chapter.lines[first ? 0 : 1];
    return `<section class="page ${side} photo-page people-page">${header}<p class="kicker">${first ? chapter.kicker : 'Những kỷ niệm cùng nhau'}</p><p class="people-note">${intro}</p><div class="photo-story count-2">${photos.map(photo => imageMarkup(photo)).join('')}</div>${footer}</section>`;
  }
  if (chapter.kind === 'gallery') {
    const items = chapter.items.slice(side === 'left' ? 0 : 3, side === 'left' ? 3 : 6);
    return `<section class="page ${side} gallery-page" aria-label="Các hoạt động của CLB">${header}<div class="activity-photos">${items.map(item => `<figure>${isLink(item.photo.source) ? `<a href="${item.photo.source}" target="_blank" rel="noreferrer">` : '<div class="activity-image">'}<img src="${assetRoot}${item.photo.file}" alt="${item.photo.caption}" draggable="false">${isLink(item.photo.source) ? '</a>' : '</div>'}<figcaption>${item.title}</figcaption></figure>`).join('')}</div>${footer}</section>`;
  }
  if (chapter.kind === 'slogan') {
    const illustration = chapter.illustrations[side === 'left' ? 0 : 1];
    const stage = side === 'left' ? 0 : 2;
    return `<section class="page ${side} slogan-page">${header}<p class="slogan-word slogan-reveal" data-slogan-stage="${stage}"${full ? ' style="opacity:1"' : ' style="opacity:0"'}>${side === 'left' ? 'Mở<br><em>sách,</em>' : 'Đọc<br><em>tương lai</em>'}</p><img class="slogan-illustration slogan-reveal" data-slogan-stage="${stage + 1}" style="opacity:${full ? 1 : 0}" src="${assetRoot}${illustration.file}" alt="${illustration.alt}" draggable="false">${footer}</section>`;
  }
  const photoSide = index % 2 === 0 ? 'left' : 'right';
  if (side === photoSide) {
    return `<section class="page ${side} photo-page">${header}<p class="kicker">${chapter.kicker}</p><div class="photo-story count-${chapter.photos.length}">${chapter.photos.map(photo => imageMarkup(photo)).join('')}</div>${footer}</section>`;
  }
  return `<section class="page ${side} text-page${index === 0 ? ' origin-page' : ''}">${header}<h2>${chapter.title}</h2><div class="text-window"><div class="text-lines">${chapter.lines.map((line, i) => `<p class="reveal-line${index === 0 && i === 0 ? ' meta' : ''}"${full ? ' style="opacity:1;transform:none"' : ''}>${chapter.compactLines && i > 0 ? `<span class="intro-expanded">${line}</span><span class="intro-brief">${chapter.compactLines[i - 1]}</span>` : line}</p>`).join('')}<div class="small-rule" aria-hidden="true"></div></div></div><a class="chapter-source" href="${chapter.sources[0]}" target="_blank" rel="noreferrer">Nguồn tư liệu ↗</a>${footer}</section>`;
}
function spreadMarkup(index, side, full = false) {
  if (index > 0) return pageMarkup(chapters[index - 1], index - 1, side, full);
  if (side === 'left') return '<section class="page left title-blank" aria-label="Trang giấy trắng"></section>';
  const paperCover = coverMarkup.replaceAll('cover-tagline-arc', `paper-tagline-${++paperSerial}`);
  return `<section class="page right title-page" aria-label="Bìa phụ: Câu lạc bộ Yêu Sách Bách Khoa Hà Nội">${paperCover}</section>`;
}
function scrollPanes(root, progress) {
  root.querySelectorAll('.text-window').forEach(pane => {
    const overflow = Math.max(0, pane.scrollHeight - pane.clientHeight);
    pane.querySelector('.text-lines').style.transform = `translateY(${-overflow * progress}px)`;
  });
}
function prepare(state) {
  const staticTurn = reduced && state.mode === 'turn';
  const index = staticTurn ? state.index + (state.turn >= .5 ? 1 : 0) : state.index;
  const nextKey = `${state.mode}:${state.index}:${index}:${reduced}`;
  if (nextKey === key) return;
  key = nextKey;
  const normalTurn = state.mode === 'turn' && !reduced;
  $('base-spread').innerHTML = spreadMarkup(index, 'left', normalTurn) + spreadMarkup(normalTurn ? index + 1 : index, 'right');
  $('base-spread').setAttribute('aria-label', spreadLabel(index));
  $('base-spread').setAttribute('aria-hidden', String(state.mode !== 'read'));
  $('base-spread').inert = state.mode !== 'read';
  lines = normalTurn ? [] : [...$('base-spread').querySelectorAll('.reveal-line')];
  panes = normalTurn ? [] : [...$('base-spread').querySelectorAll('.text-window')].map(pane => ({ node: pane.querySelector('.text-lines'), overflow: Math.max(0, pane.scrollHeight - pane.clientHeight) }));
  if (normalTurn) scrollPanes($('base-spread').firstElementChild, 1);
  if (state.mode === 'cover') {
    $('cover-back').innerHTML = spreadMarkup(0, 'left', true);
  } else if (state.mode === 'turn') {
    $('curl-front').innerHTML = spreadMarkup(state.index, 'right', true);
    $('curl-back-content').innerHTML = spreadMarkup(state.index + 1, 'left');
    scrollPanes($('curl-front'), 1);
  }
}
function drawCurl(progress) {
  const curl = curlAt(progress, width, height);
  $('curl-front').style.clipPath = polygon(curl.front);
  $('curl-back').style.clipPath = polygon(curl.fold);
  $('curl-back').style.transform = `matrix(${curl.matrix.join(',')})`;
  $('curl-back').style.filter = `brightness(${1 - Math.sin(progress * Math.PI) * .08})`;
  const points = curl.back.map(p => `${(p.x + width).toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  $('curl-cast').setAttribute('points', points);
  $('curl-cast').style.opacity = String(Math.sin(Math.PI * progress) * .2);
  const [a, b] = curl.crease;
  if (a && b && curl.radius > .05) {
    const middle = { x: width + (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bow = curl.radius * .24;
    const path = `M${a.x + width},${a.y} Q${middle.x + curl.normal.x * bow},${middle.y + curl.normal.y * bow} ${b.x + width},${b.y}`;
    $('curl-ridge').setAttribute('d', path);
    $('curl-ridge').setAttribute('stroke-width', curl.radius);
    $('curl-ridge').style.opacity = '.9';
    const gradient = $('curl-gradient');
    gradient.setAttribute('x1', middle.x - curl.normal.x * curl.radius / 2);
    gradient.setAttribute('y1', middle.y - curl.normal.y * curl.radius / 2);
    gradient.setAttribute('x2', middle.x + curl.normal.x * curl.radius / 2);
    gradient.setAttribute('y2', middle.y + curl.normal.y * curl.radius / 2);
  } else $('curl-ridge').style.opacity = '0';
}
function render() {
  queued = false;
  const position = snapBookPosition(scrollY / pixelsPerUnit, pixelsPerUnit, count);
  const state = timelineAt(position, count);
  prepare(state);
  const cover = state.mode === 'cover';
  const opening = cover ? state.open : 1;
  const activeCurl = !reduced && state.mode === 'turn';
  const coverProgress = reduced ? Number(opening >= .5) : opening;
  $('cover-leaf').style.transform = `rotateY(${-180 * coverProgress}deg)`;
  $('cover-leaf').style.visibility = cover ? 'visible' : 'hidden';
  $('cover-leaf').setAttribute('aria-hidden', String(!cover));
  $('book-shell').style.setProperty('--opening', String(coverProgress));
  $('book-shell').style.transform = `translateX(${-25 * (1 - (reduced ? opening >= .5 ? 1 : 0 : opening))}%)`;
  $('book-bed').style.opacity = String(clamp(opening * 3));
  $('page-edges').style.opacity = String(opening);
  $('book-bed').style.clipPath = cover ? 'inset(0 0 0 50%)' : 'none';
  $('page-edges').style.clipPath = cover ? 'inset(0 0 0 50%)' : 'none';
  $('gutter').style.opacity = String(opening);
  $('ribbon').style.opacity = String(opening);
  $('closed-spine').style.opacity = String(1 - opening * .65);
  $('closed-edge').style.opacity = String(1 - opening);
  $('base-spread').firstElementChild.style.opacity = cover && opening < 1 ? '0' : '1';
  $('curl-faces').style.visibility = activeCurl ? 'visible' : 'hidden';
  if (activeCurl) drawCurl(state.turn);
  else if (reduced && cover) {
    $('curl-front').style.clipPath = 'none';
    $('curl-back').style.clipPath = polygon([]);
    $('curl-cast').style.opacity = '0';
    $('curl-ridge').style.opacity = '0';
    $('base-spread').style.opacity = opening >= .5 ? '1' : '0';
    $('base-spread').firstElementChild.style.opacity = opening >= .5 ? '1' : '0';
  }
  if (!(reduced && cover)) $('base-spread').style.opacity = '1';
  const read = state.mode === 'read' ? state.read : reduced && state.mode === 'turn' && state.turn < .5 ? 1 : 0;
  lines.forEach((line, index) => {
    const progress = lineProgress(read, index, lines.length);
    line.style.opacity = String(reduced ? Number(progress > 0) : progress);
    line.style.transform = reduced ? 'none' : `translateY(${(1 - progress) * 7}px)`;
    line.setAttribute('aria-hidden', String(progress < .05));
    line.inert = progress < .95;
  });
  const stages = sloganProgress(read);
  $('base-spread').querySelectorAll('[data-slogan-stage]').forEach(node => {
    const progress = stages[Number(node.dataset.sloganStage)];
    node.style.opacity = String(reduced ? Number(progress > 0) : progress);
    node.setAttribute('aria-hidden', String(progress < .05));
  });
  panes.forEach(pane => { pane.node.style.transform = `translateY(${-pane.overflow * clamp((read - .25) / .75)}px)`; });
  const index = state.mode === 'turn' && state.turn >= .5 ? state.index + 1 : state.index;
  const chapter = chapters[Math.max(0, index - 1)];
  $('status-eyebrow').textContent = cover ? 'Bìa sách / Mở đầu' : index === 0 ? 'Bìa phụ / Trên trang giấy' : `Chương ${roman(index - 1)} / ${String(index).padStart(2, '0')} — ${chapters.length}`;
  $('status-title').textContent = cover ? 'Câu chuyện bắt đầu từ một cuốn sách.' : index === 0 ? 'Mở sách, đọc tương lai' : chapter.name;
  $('status-caption').textContent = cover ? 'Cuộn chậm để mở. Cuộn ngược để khép lại.' : index === 0 ? 'Một trang giấy trước khi câu chuyện bắt đầu. Cuộn tiếp để đọc.' : index === count - 1 && read >= .98 ? 'Cuộn tiếp để xem cách mượn và tìm sách.' : chapter.kind === 'gallery' ? 'Những điều chúng mình làm cùng nhau. Cuộn tiếp để khám phá từng hoạt động.' : state.mode === 'turn' ? 'Dừng ở một nếp giấy. Cuộn ngược để trở về.' : 'Cuộn để đọc tiếp. Hết nội dung, mình sang trang.';
  $('hint-title').textContent = cover ? 'Cuộn xuống để mở sách' : state.mode === 'turn' ? 'Lật từ góc trang' : 'Cuộn xuống để đọc tiếp';
  $('hint-copy').textContent = 'Hoặc dùng mũi tên trái / phải.';
  $('previous').disabled = position <= .001;
  $('next').disabled = position >= totalUnits(count) - .001;
  $('next').setAttribute('aria-label', cover ? 'Mở sách' : 'Trang tiếp theo');
  document.querySelectorAll('.chapter-dot').forEach((dot, i) => dot.setAttribute('aria-current', String(!cover && i === index - 1)));
  $('progress-fill').style.width = `${clamp(position / totalUnits(count)) * 100}%`;
  const announce = cover ? 'cover' : `${index}`;
  if (announcement !== announce) {
    announcement = announce;
    $('chapter-announcement').textContent = cover ? 'Bìa sách. Cuộn hoặc bấm mũi tên phải để mở.' : spreadLabel(index);
    const activeDot = $('chapter-nav').querySelector('[aria-current=true]');
    if (activeDot) $('chapter-nav').scrollTo({ left: activeDot.offsetLeft - $('chapter-nav').clientWidth / 2, behavior: 'instant' });
  }
  $('book-shell').dataset.phase = state.mode;
  $('book-shell').dataset.chapter = String(state.index - 1);
  $('book-shell').dataset.spread = String(state.index);
  $('book-shell').dataset.turn = (cover ? opening : state.turn).toFixed(4);
}
function schedule() { if (!queued) { queued = true; requestAnimationFrame(render); } }
function cancelNavigation() { cancelAnimationFrame(navigationFrame); navigationFrame = 0; navigationTop = null; }
function onScroll() {
  // Bao gồm kéo thanh cuộn và công cụ hỗ trợ không phát wheel/pointer event.
  if (navigationFrame && navigationTop !== null && Math.abs(scrollY - navigationTop) > 2) cancelNavigation();
  schedule();
}
function jump(position) {
  cancelNavigation();
  if (reduced) { scrollTo({ top: position * pixelsPerUnit, behavior: 'instant' }); return; }
  const segments = navigationSegments(scrollY / pixelsPerUnit, position, count);
  const duration = segments.reduce((sum, segment) => sum + segment.duration, 0);
  const start = performance.now();
  navigationTop = Math.round(scrollY);
  function tick(now) {
    navigationTop = Math.round(navigationAt(segments, now - start) * pixelsPerUnit);
    scrollTo({ top: navigationTop, behavior: 'instant' });
    if (now - start < duration) navigationFrame = requestAnimationFrame(tick);
    else navigationFrame = 0;
  }
  navigationFrame = requestAnimationFrame(tick);
}
function navigate(direction) { jump(arrowTarget(snapBookPosition(scrollY / pixelsPerUnit, pixelsPerUnit, count), direction, count)); }
function measure(keepPosition = true) {
  cancelNavigation();
  const position = scrollY / pixelsPerUnit;
  pixelsPerUnit = Math.max(620, Math.min(1100, innerHeight * .95));
  $('scroll-track').style.height = `${totalUnits(count) * pixelsPerUnit + innerHeight}px`;
  width = $('book-shell').clientWidth / 2; height = $('book-shell').clientHeight;
  $('curl-art').setAttribute('viewBox', `0 0 ${width * 2} ${height}`);
  if (keepPosition) scrollTo({ top: position * pixelsPerUnit, behavior: 'instant' });
  key = ''; schedule();
}
function setReduced(value) {
  cancelNavigation();
  reduced = value; key = '';
  document.documentElement.classList.toggle('reduced', value);
  $('motion-toggle').setAttribute('aria-pressed', String(value));
  $('motion-toggle').textContent = value ? 'Bật chuyển động lật' : 'Giảm chuyển động'; schedule();
}
$('chapter-nav').innerHTML = chapters.map((chapter, index) => `<button type="button" class="chapter-dot" data-chapter="${index}" aria-label="Chương ${roman(index)}: ${chapter.name}" aria-current="false">${String(index + 1).padStart(2, '0')}</button>`).join('');
$('chapter-nav').addEventListener('click', event => { const button = event.target.closest('[data-chapter]'); if (button) jump(readingEnd(Number(button.dataset.chapter) + 1)); });
$('previous').addEventListener('click', () => navigate(-1));
$('next').addEventListener('click', () => navigate(1));
$('home-link').addEventListener('click', event => { event.preventDefault(); jump(0); });
$('motion-toggle').addEventListener('click', () => setReduced(!reduced));
reduceQuery.addEventListener('change', event => setReduced(event.matches));
addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if (scrollY > totalUnits(count) * pixelsPerUnit + 1) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1); }
  else cancelNavigation();
});
addEventListener('wheel', cancelNavigation, { passive: true });
addEventListener('touchstart', cancelNavigation, { passive: true });
addEventListener('pointerdown', cancelNavigation, { passive: true });
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => measure());
document.fonts.ready.then(() => { key = ''; schedule(); });
history.scrollRestoration = 'manual';
scrollTo({ top: 0, behavior: 'instant' });
measure(false); setReduced(reduced); render();
addEventListener('beforeprint', () => { $('print-chapters').innerHTML = Array.from({ length: count }, (_, index) => `<section class="spread">${spreadMarkup(index, 'left', true)}${spreadMarkup(index, 'right', true)}</section>`).join(''); });
addEventListener('afterprint', () => { $('print-chapters').innerHTML = ''; });
