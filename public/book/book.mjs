import { roman, clamp, timelineAt, arrowTarget, readingEnd, totalUnits, lineProgress, navigationSegments, navigationAt, sloganProgress, snapBookPosition } from './book-timeline.mjs';
import { curlAt, polygon } from './page-curl.mjs';
import { site, chapters } from './book-content.mjs';
const labels = site.labels;
import { createBookScroll } from './book-scroll.mjs';
import { singlePageQuery, leafForPosition, positionForLeaf, desktopDrag } from './book-interaction.mjs';
import { createSingleReader } from './book-single.mjs';

const $ = id => document.getElementById(id);
const scrolling = createBookScroll($('landing-scroll'), window);
const count = chapters.length + 1;
const spreadLabel = index => index === count ? labels.endpapersPage : index === 0 ? labels.titlePage : `${labels.chapter} ${roman(index - 1)}: ${chapters[index - 1].name}`;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reduceQuery.matches;
let pixelsPerUnit = 800, width = 500, height = 600;
let key = '', queued = false, announcement = '';
let lines = [], panes = [];
let navigationFrame = 0;
let navigationTop = null;
let navigationPosition = null;
const singleQuery = matchMedia(singlePageQuery);
let singleReader = null, singleSize = '', readerFontsReady = false;
let restorePosition = null;
let settledSpread = 0, settledPrinted = false, reverseRead = false;
let dragPrint = null;
const assetRoot = '/book/assets/';
const coverMarkup = $('cover-leaf').querySelector('.cover-front').outerHTML.replace('leaf-face leaf-front', 'paper-cover');
const backCoverMarkup = `<div class="cover-front back-cover-art" aria-label="${labels.backCoverPage}"></div>`;
$('book-shell').insertAdjacentHTML('beforeend', `<div class="back-cover-leaf" id="back-cover-leaf" aria-hidden="true"><div class="leaf-face back-inner"><section class="page right end-board"></section></div><div class="leaf-face leaf-back">${backCoverMarkup}</div></div>`);

const isLink = source => /^https:\/\//.test(source);
const ALLOWED_TAGS = new Set(['span', 'strong', 'em', 'br', 'b', 'i']);
function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  return html.replace(/<(\/?[a-zA-Z0-9]+)([^>]*)>/g, (match, tag) => {
    const lower = tag.toLowerCase().replace('/', '');
    if (ALLOWED_TAGS.has(lower)) {
      return tag.startsWith('/') ? `</${lower}>` : `<${lower}>`;
    }
    return match.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const formatText = value => sanitizeHtml(String(value)).replaceAll('\n', '<br>');
let paperSerial = 0;
function revealAttribute(full) { return full ? 'data-reveal style="opacity:1"' : 'data-reveal'; }
function imageMarkup(photo, extraClass = '', full = false) {
  const image = `<img src="${assetRoot}${photo.file}" alt="${escapeHtml(photo.alt || photo.caption)}" style="object-position:${photo.position};transform:scale(${photo.zoom ?? 1})" draggable="false">`;
  return `<figure class="story-photo ${extraClass}" ${revealAttribute(full)}><div class="story-image">${image}</div><figcaption>${escapeHtml(photo.caption)}</figcaption></figure>`;
}

function pageMarkup(chapter, index, side, full = false) {
  const brandName = (typeof site !== 'undefined' && site?.brand?.name) || 'Yêu Sách Bách Khoa';
  const number = String(index * 2 + (side === 'left' ? 1 : 2)).padStart(2, '0');
  const footer = `<span class="page-num">${number}</span>`;
  const header = `<div class="page-top"><span>${escapeHtml(brandName)}</span><span>${roman(index)} / ${escapeHtml(chapter.name)}</span></div>`;

  if (chapter.kind === 'people') {
    const first = side === 'left';
    const split = Math.ceil(chapter.photos.length / 2);
    const photos = first ? chapter.photos.slice(0, split) : chapter.photos.slice(split);
    const intro = chapter.lines[first ? 0 : 1];
    return `<section class="page ${side} photo-page people-page">${header}<p class="kicker" ${revealAttribute(full)}>${escapeHtml(first ? chapter.kicker : (chapter.rightKicker || 'Những kỷ niệm cùng nhau'))}</p><p class="people-note" ${revealAttribute(full)}>${formatText(intro)}</p><div class="photo-story count-${photos.length}">${photos.map(photo => imageMarkup(photo, '', full)).join('')}</div>${footer}</section>`;
  }

  if (chapter.kind === 'gallery') {
    const items = chapter.items || (typeof site !== 'undefined' && site.activities) || [];
    const split = Math.ceil(items.length / 2);
    const slice = side === 'left' ? items.slice(0, split) : items.slice(split);
    return `<section class="page ${side} gallery-page" aria-label="${escapeHtml(chapter.name)}">${header}<div class="activity-photos">${slice.map(item => `<figure ${revealAttribute(full)}><div class="activity-image"><img src="${assetRoot}${item.photo.file}" alt="${escapeHtml(item.photo.alt || item.photo.caption)}" draggable="false"></div><figcaption>${escapeHtml(item.title)}</figcaption></figure>`).join('')}</div>${footer}</section>`;
  }

  if (chapter.kind === 'slogan') {
    const illustration = chapter.illustrations[side === 'left' ? 0 : 1];
    const wordStage = side === 'left' ? 0 : 3;
    const imageStage = side === 'left' ? 1 : 2;
    const defaultSlogan = side === 'left' ? 'Mở<br><em>sách,</em>' : 'Đọc<br><em>tương lai</em>';
    const sloganHtml = chapter.slogans ? chapter.slogans[side === 'left' ? 0 : 1].split('\n').map((l, i) => i ? '<em>' + escapeHtml(l) + '</em>' : escapeHtml(l)).join('<br>') : defaultSlogan;
    const word = `<p class="slogan-word slogan-reveal" data-slogan-stage="${wordStage}"${full ? ' style="opacity:1"' : ' style="opacity:0"'}>${sloganHtml}</p>`;
    const image = `<img class="slogan-illustration slogan-reveal" data-slogan-stage="${imageStage}" style="opacity:${full ? 1 : 0}" src="${assetRoot}${illustration.file}" alt="${escapeHtml(illustration.alt)}" draggable="false">`;
    return `<section class="page ${side} slogan-page">${header}${side === 'left' ? word + image : image + word}${footer}</section>`;
  }

  const photoSide = index % 2 === 0 ? 'left' : 'right';
  if (side === photoSide) {
    return `<section class="page ${side} photo-page">${header}<p class="kicker" ${revealAttribute(full)}>${escapeHtml(chapter.kicker)}</p><div class="photo-story count-${chapter.photos.length}">${chapter.photos.map(photo => imageMarkup(photo, '', full)).join('')}</div>${footer}</section>`;
  }

  const isIntro = index === 0 || chapter.variant === 'intro';
  return `<section class="page ${side} text-page${isIntro ? ' origin-page' : ''}">${header}<h2 ${revealAttribute(full)}>${formatText(chapter.title)}</h2><div class="text-window"><div class="text-lines">${chapter.lines.map((line, i) => {
    const isMeta = isIntro && i === 0;
    const renderedLine = chapter.compactLines && i > 0 && chapter.compactLines[i - 1]
      ? `<span class="intro-expanded">${formatText(line)}</span><span class="intro-brief">${formatText(chapter.compactLines[i - 1])}</span>`
      : formatText(line);
    return `<p class="reveal-line${isMeta ? ' meta' : ''}"${full ? ' style="opacity:1;transform:none"' : ''}>${renderedLine}</p>`;
  }).join('')}<div class="small-rule" aria-hidden="true"></div></div></div>${footer}</section>`;
}

function spreadMarkup(index, side, full = false) {
  const brandName = (typeof site !== 'undefined' && site?.brand?.name) || 'Yêu Sách Bách Khoa';
  const total = typeof count !== 'undefined' ? count : (typeof chapters !== 'undefined' ? chapters.length + 1 : 11);
  if (index === total) return `<section class="page ${side} ${side === 'left' ? 'end-blank' : 'end-board-placeholder'}" aria-label="${typeof labels !== 'undefined' ? labels.endpapersPage : 'Trang trắng cuối sách'}"></section>`;
  if (index > 0) return pageMarkup(chapters[index - 1], index - 1, side, full);
  if (side === 'left') return `<section class="page left title-blank" aria-label="${escapeHtml(typeof labels !== 'undefined' ? labels.blankPage : 'Trang giấy trắng')}"></section>`;
  const paperCover = coverMarkup.replaceAll('cover-tagline-arc', `paper-tagline-${++paperSerial}`);
  return `<section class="page right title-page" aria-label="${escapeHtml((typeof labels !== 'undefined' ? labels.titlePage : 'Bìa phụ') + ': ' + brandName)}">${paperCover}</section>`;
}

function scrollPanes(root, progress) {
  root.querySelectorAll('.text-window').forEach(pane => {
    const overflow = Math.max(0, pane.scrollHeight - pane.clientHeight);
    pane.querySelector('.text-lines').style.transform = `translateY(${-overflow * progress}px)`;
  });
}

function orderedReveals(root) {
  const pages = [...root.querySelectorAll('.page')];
  if (pages.length) return pages.flatMap(page => orderedReveals(page));
  const items = [...root.querySelectorAll('[data-reveal], .reveal-line')].map(node => {
    let top = 0, left = 0;
    for (let parent = node; parent && parent !== root; parent = parent.offsetParent) {
      top += parent.offsetTop; left += parent.offsetLeft;
    }
    return { node, top, left };
  }).sort((a, b) => a.top - b.top || a.left - b.left);
  const rows = [];
  for (const item of items) {
    let row = rows.at(-1);
    if (!row || item.top - row.top > 8) rows.push(row = { top: item.top, items: [] });
    row.items.push(item);
  }
  return rows.flatMap(row => row.items.sort((a, b) => a.left - b.left).map(item => item.node));
}

function prepare(state) {
  const staticTurn = reduced && state.mode === 'turn';
  const index = staticTurn ? state.index + (state.turn >= .5 ? 1 : 0) : state.index;
  const nextKey = `${state.mode}:${state.index}:${index}:${reduced}:${reverseRead}:${Boolean(dragPrint)}`;
  if (nextKey === key) return;
  key = nextKey;
  const normalTurn = state.mode === 'turn' && !reduced;
  const frozenRead = dragPrint && state.mode === 'read' && index === dragPrint.index;
  const frozenTurn = dragPrint && normalTurn && state.index + 1 === dragPrint.index;
  $('base-spread').innerHTML = (frozenRead ? dragPrint.left : spreadMarkup(index, 'left', normalTurn || reverseRead)) + (frozenRead || frozenTurn ? dragPrint.right : spreadMarkup(normalTurn ? index + 1 : index, 'right', reverseRead));
  $('base-spread').setAttribute('aria-label', spreadLabel(index));
  $('base-spread').setAttribute('aria-hidden', String(state.mode !== 'read'));
  $('base-spread').inert = state.mode !== 'read';
  lines = normalTurn || frozenRead ? [] : orderedReveals($('base-spread'));
  panes = normalTurn || frozenRead ? [] : [...$('base-spread').querySelectorAll('.text-window')].map(pane => {
    const groups = orderedReveals(pane.closest('.page'));
    return { node: pane.querySelector('.text-lines'), overflow: Math.max(0, pane.scrollHeight - pane.clientHeight), first: lines.indexOf(groups[0]), last: lines.indexOf(groups.at(-1)) };
  });
  if (normalTurn) scrollPanes($('base-spread').firstElementChild, reverseRead ? 0 : 1);
  if (state.mode === 'cover') {
    $('cover-back').innerHTML = spreadMarkup(0, 'left', true);
  } else if (state.mode === 'turn') {
    $('curl-front').innerHTML = spreadMarkup(state.index, 'right', true);
    $('curl-back-content').innerHTML = frozenTurn ? dragPrint.left : spreadMarkup(state.index + 1, 'left', reverseRead);
    scrollPanes($('curl-front'), reverseRead ? 0 : 1);
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
  if (singleReader) return;
  if (!navigationFrame && !$('book-shell').classList.contains('is-dragging')) dragPrint = null;
  const position = navigationPosition ?? snapBookPosition(scrolling.top / pixelsPerUnit, pixelsPerUnit, count);
  const state = timelineAt(position, count);
  if (state.mode === 'read' && state.index !== settledSpread) { settledPrinted = state.index < settledSpread; settledSpread = state.index; }
  if (state.mode === 'cover') { settledSpread = 0; settledPrinted = false; }
  reverseRead = state.mode === 'read' && settledPrinted;
  prepare(state);
  const cover = state.mode === 'cover';
  const closing = state.mode === 'closing', close = closing ? (reduced ? Number(state.close >= .5) : state.close) : 0;
  const ending = state.index === count || state.mode === 'turn' && state.index === count - 1;
  const opening = cover ? state.open : 1;
  const activeCurl = !reduced && state.mode === 'turn';
  const coverProgress = reduced ? Number(opening >= .5) : opening;
  $('cover-leaf').style.transform = `rotateY(${-180 * coverProgress}deg)`;
  $('cover-leaf').style.visibility = 'visible';
  $('cover-leaf').style.zIndex = cover ? '9' : '0';
  $('cover-leaf').setAttribute('aria-hidden', String(!cover));
  $('back-cover-leaf').style.visibility = ending ? 'visible' : 'hidden';
  $('back-cover-leaf').style.transform = `rotateY(${-180 * close}deg)`;
  $('back-cover-leaf').style.zIndex = closing ? '9' : '0';
  $('book-shell').style.setProperty('--opening', String(coverProgress));
  $('book-shell').style.transform = `translateX(${-25 * (1 - (reduced ? opening >= .5 ? 1 : 0 : opening)) + 25 * close}%)`;
  $('book-bed').style.opacity = String(ending ? 0 : clamp(opening * 3));
  $('page-edges').style.opacity = String(ending ? 0 : opening);
  $('book-bed').style.clipPath = 'inset(0 0 0 50%)';
  $('page-edges').style.clipPath = 'inset(0 0 0 50%)';
  $('gutter').style.opacity = String(!ending && state.index > 0 ? opening : 0);
  $('ribbon').style.opacity = String(ending ? 0 : opening);
  $('closed-spine').style.opacity = String(1 - opening);
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
  const complete = reduced || reverseRead;
  lines.forEach((line, index) => {
    const progress = complete ? 1 : lineProgress(read, index, lines.length);
    line.style.opacity = String(progress);
    if (line.classList.contains('reveal-line')) line.style.transform = complete ? 'none' : `translateY(${(1 - progress) * 7}px)`;
    line.setAttribute('aria-hidden', String(progress < .05));
    line.inert = progress < .95;
  });
  const stages = sloganProgress(read);
  if (!(dragPrint && state.index === dragPrint.index) && (state.mode !== 'turn' || reduced)) $('base-spread').querySelectorAll('[data-slogan-stage]').forEach(node => {
    const progress = complete ? 1 : stages[Number(node.dataset.sloganStage)];
    node.style.opacity = String(progress);
    node.setAttribute('aria-hidden', String(progress < .05));
  });
  panes.forEach(pane => {
    const step = .86 / lines.length, progress = clamp(((reverseRead ? 1 - read : read) - .07 - pane.first * step) / ((pane.last - pane.first + .8) * step));
    pane.node.style.transform = `translateY(${-pane.overflow * clamp((progress - .25) / .75)}px)`;
  });
  const index = state.mode === 'turn' && state.turn >= .5 ? state.index + 1 : state.index;
  const chapter = chapters[Math.min(chapters.length - 1, Math.max(0, index - 1))];
  $('status-eyebrow').textContent = cover ? labels.coverStatus : index === 0 ? labels.titleStatus : `${labels.chapter} ${roman(index - 1)} / ${String(index).padStart(2, '0')} — ${chapters.length}`;
  $('status-title').textContent = cover ? labels.coverTitle : index === 0 ? site.brand.tagline : chapter.name;
  $('status-caption').textContent = cover ? labels.coverCaption : index === 0 ? labels.titleCaption : index === count - 1 && read >= .98 ? labels.endCaption : chapter.kind === 'gallery' ? labels.galleryCaption : state.mode === 'turn' ? labels.turnCaption : labels.readCaption;
  $('hint-title').textContent = cover ? labels.openHint : state.mode === 'turn' ? labels.turnHint : labels.readHint;
  $('hint-copy').textContent = labels.arrowsHint;
  $('previous').disabled = position <= .001;
  $('next').disabled = position >= totalUnits(count) - .001;
  $('next').setAttribute('aria-label', cover ? labels.openBook : labels.nextPage);
  if (index === count) {
    $('status-eyebrow').textContent = close === 1 ? labels.backCoverPage : labels.endpapersPage;
    $('status-title').textContent = close === 1 ? labels.closedTitle : labels.closingTitle;
    $('status-caption').textContent = close === 1 ? labels.closedCaption : labels.closeCaption;
    $('hint-title').textContent = close === 1 ? labels.closedHint : labels.closeHint;
    $('next').setAttribute('aria-label', labels.closeBook);
  }
  $('previous').setAttribute('aria-label', closing ? labels.reopenBook : labels.previousPage);
  document.querySelectorAll('.chapter-dot').forEach((dot, i) => dot.setAttribute('aria-current', String(!cover && i === index - 1)));
  $('progress-fill').style.width = `${clamp(position / totalUnits(count)) * 100}%`;
  const announce = cover ? 'cover' : closing && close === 1 ? 'back-cover' : `${index}`;
  if (announcement !== announce && !navigationFrame) {
    announcement = announce;
    $('chapter-announcement').textContent = cover ? labels.openAnnouncement : closing && close === 1 ? labels.closedAnnouncement : spreadLabel(index);
    const activeDot = $('chapter-nav').querySelector('[aria-current=true]');
    if (activeDot) $('chapter-nav').scrollTo({ left: activeDot.offsetLeft - $('chapter-nav').clientWidth / 2, behavior: 'instant' });
  }
  $('book-shell').dataset.phase = state.mode;
  $('book-shell').dataset.chapter = String(state.index - 1);
  $('book-shell').dataset.spread = String(state.index);
  $('book-shell').dataset.turn = (cover ? opening : closing ? close : state.turn).toFixed(4);
}

function schedule() { if (!queued) { queued = true; requestAnimationFrame(render); } }
function cancelNavigation(keepDragPrint = false) { cancelAnimationFrame(navigationFrame); navigationFrame = 0; navigationTop = null; navigationPosition = null; if (keepDragPrint !== true) dragPrint = null; }
function onScroll() {
  if (navigationFrame && navigationTop !== null && Math.abs(scrolling.top - navigationTop) > 2) cancelNavigation();
  schedule();
}

function jump(position, keepDragPrint = false) {
  if (singleReader) { singleReader.go(leafForPosition(position, count)); return; }
  cancelNavigation(keepDragPrint);
  if (reduced) { scrolling.move(position * pixelsPerUnit); schedule(); return; }
  const segments = navigationSegments(scrolling.top / pixelsPerUnit, position, count);
  const duration = segments.reduce((sum, segment) => sum + segment.duration, 0);
  let previous = performance.now(), elapsed = 0;
  navigationTop = Math.round(scrolling.top);
  function tick(now) {
    elapsed += Math.min(50, Math.max(0, now - previous));
    previous = now;
    navigationPosition = navigationAt(segments, elapsed);
    navigationTop = Math.round(navigationPosition * pixelsPerUnit);
    scrolling.move(navigationTop);
    schedule();
    if (elapsed < duration) navigationFrame = requestAnimationFrame(tick);
    else { navigationFrame = 0; navigationPosition = null; }
  }
  navigationFrame = requestAnimationFrame(tick);
}

function navigate(direction) { if (singleReader) { singleReader.next(direction); return; } jump(arrowTarget(snapBookPosition(scrolling.top / pixelsPerUnit, pixelsPerUnit, count), direction, count)); }
function singlePageChanged(index, length, reading, total, physical, physicalTotal) {
  const chapter = Math.floor((index - 2) / 2);
  $('previous').disabled = index === 0; $('next').disabled = index === length - 1;
  $('next').setAttribute('aria-label', index === 0 ? labels.openBook : labels.nextPage);
  $('progress-fill').style.width = `${physical / (physicalTotal - 1) * 100}%`;
  const label = index === 0 ? labels.coverPage : index === 1 ? labels.titlePage : index >= length - 3 ? [labels.endpapersPage, labels.insideBackCover, labels.backCoverPage][index - length + 3] : `${spreadLabel(chapter + 1)} · ${labels.page} ${reading} / ${total}`;
  $('single-counter').textContent = index < 2 || index >= length - 3 ? label : `${labels.chapter} ${roman(chapter)} · ${labels.page} ${reading} / ${total}`;
  $('next').setAttribute('aria-label', index === length - 2 ? labels.closeBook : index === 0 ? labels.openBook : labels.nextPage);
  $('previous').setAttribute('aria-label', index === length - 1 ? labels.reopenBook : labels.previousPage);
  $('chapter-announcement').textContent = label;
  document.querySelectorAll('.chapter-dot').forEach((dot, i) => dot.setAttribute('aria-current', String(i === chapter)));
  const active = $('chapter-nav').querySelector('[aria-current=true]');
  if (active) $('chapter-nav').scrollTo({ left: active.offsetLeft - $('chapter-nav').clientWidth / 2, behavior: 'instant' });
}

function measure(keepPosition = true) {
  if (window.visualViewport?.scale > 1) return;
  cancelNavigation();
  const position = restorePosition ?? (singleReader ? positionForLeaf(singleReader.page, count) : scrolling.top / pixelsPerUnit);
  document.documentElement.classList.toggle('single-page', singleQuery.matches);
  $('book-shell').inert = singleQuery.matches;
  $('book-shell').setAttribute('aria-hidden', String(singleQuery.matches));
  if (singleQuery.matches) {
    restorePosition = null;
    $('book-shell').parentElement.removeAttribute('aria-hidden');
    document.querySelector('.static-story')?.setAttribute('aria-hidden', 'true');
    const area = $('book-shell').parentElement, size = `${area.clientWidth}:${area.clientHeight}`;
    if (!readerFontsReady) return;
    if (singleReader && size === singleSize) { singleReader.fit(); return; }
    const leaf = singleReader?.page ?? leafForPosition(position, count), offset = singleReader?.offset ?? 0;
    singleReader?.destroy(); singleSize = size;
    const cover = coverMarkup.replace('paper-cover ', '').replaceAll('cover-tagline-arc', 'single-cover-tagline');
    const pages = [`<section class="page single-cover">${cover}</section>`, spreadMarkup(0, 'right'), ...chapters.flatMap((chapter, i) => ['left', 'right'].map(side => pageMarkup(chapter, i, side))), spreadMarkup(count, 'left'), '<section class="page end-board"></section>', `<section class="page single-cover single-back-cover">${backCoverMarkup}</section>`];
    singleReader = createSingleReader({ area, pages, startPage: leaf, startOffset: offset, reduced, onPage: singlePageChanged, order: orderedReveals });
    return;
  }
  if (singleReader) {
    singleReader.destroy(); singleReader = null; restorePosition = position;
    requestAnimationFrame(() => {
      if (singleReader) return;
      scrolling.move(position * pixelsPerUnit); restorePosition = null; key = ''; schedule();
    });
  }
  $('book-shell').parentElement.setAttribute('aria-hidden', 'true');
  document.querySelector('.static-story')?.removeAttribute('aria-hidden');
  pixelsPerUnit = Math.max(620, Math.min(1100, scrolling.height * .95));
  $('scroll-track').style.height = `${totalUnits(count) * pixelsPerUnit + scrolling.height}px`;
  width = $('book-shell').clientWidth / 2; height = $('book-shell').clientHeight;
  $('curl-art').setAttribute('viewBox', `0 0 ${width * 2} ${height}`);
  if (keepPosition) scrolling.move(position * pixelsPerUnit);
  key = ''; schedule();
}

function setReduced(value) {
  cancelNavigation();
  reduced = value; key = '';
  singleReader?.setReduced(value);
  document.documentElement.classList.toggle('reduced', value);
  $('motion-toggle').setAttribute('aria-pressed', String(value));
  $('motion-toggle').textContent = value ? labels.enableMotion : labels.reduceMotion; schedule();
}

$('chapter-nav').innerHTML = chapters.map((chapter, index) => `<button type="button" class="chapter-dot" data-chapter="${index}" aria-controls="story-${chapter.id}" aria-label="${escapeHtml(labels.chapter)} ${roman(index)}: ${escapeHtml(chapter.name)}" aria-current="false">${String(index + 1).padStart(2, '0')}</button>`).join('');
$('chapter-nav').addEventListener('click', event => { const button = event.target.closest('[data-chapter]'); if (button) jump(readingEnd(Number(button.dataset.chapter) + 1)); });
$('previous').addEventListener('click', () => navigate(-1));
$('next').addEventListener('click', () => navigate(1));
$('home-link').addEventListener('click', event => { event.preventDefault(); jump(0); });
$('motion-toggle').addEventListener('click', () => setReduced(!reduced));
desktopDrag($('book-shell'), {
  count,
  enabled: () => !singleReader,
  position: () => navigationPosition ?? snapBookPosition(scrolling.top / pixelsPerUnit, pixelsPerUnit, count),
  move: position => {
    cancelNavigation(true);
    const shell = $('book-shell'), spread = $('base-spread');
    if (!dragPrint && !reduced && shell.dataset.phase === 'read' && timelineAt(position, count).index < Number(shell.dataset.spread)) {
      dragPrint = { index: Number(shell.dataset.spread), left: spread.firstElementChild.outerHTML, right: spread.lastElementChild.outerHTML };
    }
    navigationPosition = position; navigationTop = Math.round(position * pixelsPerUnit); scrolling.move(navigationTop); schedule();
  },
  finish: position => jump(position, true)
});
reduceQuery.addEventListener('change', event => setReduced(event.matches));
addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if (singleReader && $('scroll-track').getBoundingClientRect().bottom < 0) return;
  if (scrolling.top > totalUnits(count) * pixelsPerUnit + 1) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1); }
  else cancelNavigation();
});
addEventListener('wheel', cancelNavigation, { passive: true });
addEventListener('touchstart', cancelNavigation, { passive: true });
addEventListener('pointerdown', cancelNavigation, { passive: true });
scrolling.listen(onScroll);
addEventListener('resize', () => measure());
window.visualViewport?.addEventListener('resize', () => { if (window.visualViewport.scale === 1) measure(); });
Promise.all(['16px "Be Vietnam Pro"', '500 16px "Be Vietnam Pro"', '28px Lora', 'italic 16px Lora', '20px Newsreader'].map(font => document.fonts.load(font, JSON.stringify(chapters)))).then(() => document.fonts.ready).finally(() => { readerFontsReady = true; if (singleQuery.matches) measure(false); key = ''; schedule(); });
history.scrollRestoration = 'manual';
scrolling.move(0);
measure(false); setReduced(reduced); render();
addEventListener('beforeprint', () => { $('print-chapters').innerHTML = Array.from({ length: count }, (_, index) => `<section class="spread">${spreadMarkup(index, 'left', true)}${spreadMarkup(index, 'right', true)}</section>`).join(''); });
addEventListener('afterprint', () => { $('print-chapters').innerHTML = ''; });
