import { clamp, timelineAt, arrowTarget, readingEnd, totalUnits, lineProgress } from './book-timeline.mjs';

// Nội dung biên tập mẫu; ngày thành lập do người dùng xác nhận 16/09/2013.
const chapters = [
  { name: 'Chúng mình là ai', roman: 'I', title: 'Bắt đầu từ sách.<br>Ở lại vì <em>nhau.</em>', image: 'community', source: '1117986873782799', photo: 'Những người cùng yêu việc đọc, trong một khoảnh khắc gặp gỡ của CLB.', note: 'Từ một cuốn sách, chúng mình tìm thấy nhau.', kicker: 'Chương đầu tiên của chúng mình', lines: [
    '<span>Ngày thành lập</span><strong>16.09.2013</strong>',
    'Giữa nhịp sống Bách Khoa, có một nơi dành cho những người yêu sách.',
    '<strong>Yêu Sách Bách Khoa Hà Nội</strong> kết nối sinh viên qua việc đọc và những hoạt động văn hóa đọc.',
    'Chúng mình cùng tìm sách, chia sẻ góc nhìn và viết thêm những kỷ niệm dưới mái trường.',
    'Một cuốn sách được mở ra.<br>Một hành trình mới bắt đầu.',
  ] },
  { name: 'Điều chúng mình tin', roman: 'II', title: 'Một cuốn sách.<br>Nhiều <em>chân trời.</em>', image: 'conversation', source: '1117986797116140', photo: 'Các thành viên trong bộ ảnh kỷ niệm trên fanpage CLB.', note: 'Mỗi người mang đến một góc nhìn riêng.', kicker: 'Những điều muốn cùng nhau nuôi dưỡng', lines: [
    'Chúng mình muốn sách đến gần hơn với những người muốn đọc.',
    'Và muốn việc đọc mở ra nhiều hơn một câu chuyện trên giấy.',
    'Đó có thể là một câu hỏi mới, một cách nghĩ khác, hay một người bạn cùng sở thích.',
    '<strong>Đọc. Chia sẻ. Kết nối.</strong><br>Những điều nhỏ để cùng lớn lên.',
    'Mở sách đọc tương lai.',
  ] },
  { name: 'Những cuộc trò chuyện', roman: 'III', title: 'Gấp một trang.<br>Mở một <em>câu chuyện.</em>', image: 'talkshow', source: '1117986737116146', photo: 'Một thành viên cầm micro chia sẻ trong buổi gặp gỡ của CLB.', note: 'Đôi khi, điều ở lại là một câu chuyện được nghe.', kicker: 'Khi sách bước ra khỏi trang giấy', lines: [
    'Một cuốn sách hay thường khiến ta muốn kể với ai đó.',
    'Ở đây, những cảm nhận có chỗ để được chia sẻ và lắng nghe.',
    'Bạn có thể mang đến một điều tâm đắc, hoặc chỉ ngồi lại để nghe một góc nhìn mới.',
    'Chúng mình trân trọng những cuộc trò chuyện bắt đầu như thế.',
    '<strong>Mỗi người, một trang viết.</strong>',
  ] },
  { name: 'Những người viết tiếp', roman: 'IV', title: 'Một nơi để<br><em>thuộc về.</em>', image: 'together', source: '1117986860449467', photo: 'Thành viên CLB với giấy chứng nhận trong bộ ảnh kỷ niệm trên Facebook.', note: 'Phía sau một hoạt động là những người cùng góp sức.', kicker: 'Những gương mặt, những đóng góp', lines: [
    'Có người yêu việc kể chuyện.<br>Có người thích chăm chút từng chi tiết.',
    'Có những đóng góp ở phía trước, và cả những điều lặng lẽ ở phía sau.',
    'Từng phần việc nhỏ cùng làm nên một nơi để chúng mình gặp gỡ.',
    'Mỗi thành viên góp thêm một sắc màu cho câu chuyện Yêu Sách Bách Khoa.',
    '<strong>Cùng đọc. Cùng làm. Cùng trưởng thành.</strong>',
  ] },
  { name: 'Những điều muốn giữ', roman: 'V', title: 'Có những ngày<br>muốn <em>giữ lại.</em>', image: 'community', source: '1117986873782799', photo: 'Khoảnh khắc trong bộ ảnh “12TH ANNIVERSARY” trên fanpage CLB.', note: 'Một khoảnh khắc từ bộ ảnh “12TH ANNIVERSARY”.', kicker: 'Ký ức được xếp giữa những trang sách', lines: [
    'Rồi sẽ có những buổi gặp gỡ trở thành kỷ niệm.',
    'Những gương mặt trong một tấm ảnh, những câu chuyện quanh một chiếc bàn.',
    'Chúng mình giữ lại chúng như những dấu trang của một hành trình chung.',
    'Vẫn còn nhiều hoạt động, dấu mốc và thành tích để viết vào cuốn sách này.',
    '<strong>Và nhiều trang mới đang chờ.</strong>',
  ] },
  { name: 'Trang tiếp theo có bạn', roman: 'VI', title: 'Trang tiếp theo,<br><em>có bạn.</em>', image: 'conversation', source: '1117986797116140', photo: 'Các thành viên Yêu Sách Bách Khoa trong một buổi gặp gỡ.', note: 'Hẹn bạn ở một cuốn sách, một buổi trực, một cuộc gặp.', kicker: 'Từ câu chuyện này đến cuốn sách của bạn', lines: [
    'Có thể bắt đầu thật đơn giản: chọn một cuốn sách bạn muốn đọc.',
    'Giữ chỗ online, rồi gặp chúng mình tại buổi trực thứ 3 hoặc thứ 5 đã chọn.',
    'Không cần tài khoản để đặt chỗ.<br>Mỗi đơn giữ một cuốn sách.',
    'Sách được giữ đến hết buổi trực bạn chọn. Hẹn gặp bạn ở bàn sách.',
    '<a class="page-cta" href="editorial-v1.html#tu-sach">Khám phá tủ sách mẫu <span aria-hidden="true">↗</span></a>',
  ] },
];

const $ = id => document.getElementById(id);
const count = chapters.length;
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
let pixelsPerUnit = 800;
let currentKey = '';
let framePending = false;
let announcementKey = '';
let baseLines = [];
let baseLeft;
let baseRight;
let textOverflow = 0;

function leftPage(chapter, index) {
  return `<div class="page left"><div class="page-top"><span>Yêu Sách Bách Khoa</span><span>Những trang thanh xuân</span></div><p class="kicker">${chapter.kicker}</p><figure class="paper-photo"><img src="assets/${chapter.image}.jpg" alt="${chapter.photo}" ${index === 0 ? 'fetchpriority="high"' : 'loading="eager"'}></figure><p class="photo-note">${chapter.note}</p><span class="chapter-index" aria-hidden="true">${chapter.roman}</span><a class="photo-source" href="https://www.facebook.com/photo.php?fbid=${chapter.source}" target="_blank" rel="noreferrer">Ảnh gốc Facebook ↗</a><span class="page-num">${String(index * 2 + 1).padStart(2, '0')}</span></div>`;
}
function rightPage(chapter, index, revealed = false) {
  return `<div class="page right"><div class="page-top"><span>Chương ${chapter.roman}</span><span>${chapter.name}</span></div><h2>${chapter.title}</h2><div class="text-window"><div class="text-lines">${chapter.lines.map((line, i) => `<p class="reveal-line${index === 0 && i === 0 ? ' meta' : ''}"${revealed ? ' style="opacity:1;transform:none"' : ''}>${line}</p>`).join('')}<div class="small-rule" aria-hidden="true"></div></div></div><span class="page-num">${String(index * 2 + 2).padStart(2, '0')}</span></div>`;
}
function prepareScene(state) {
  const staticTurn = reduced && state.mode === 'turn';
  const effectiveIndex = staticTurn ? state.index + (state.turn >= .5 ? 1 : 0) : state.index;
  const key = `${state.mode}:${state.index}:${reduced}:${effectiveIndex}`;
  if (key === currentKey) return;
  currentKey = key;
  const chapter = chapters[effectiveIndex];
  const next = chapters[state.index + 1];
  const underNext = state.mode === 'turn' && !reduced;
  $('base-spread').innerHTML = leftPage(chapter, effectiveIndex) + rightPage(underNext ? next : chapter, underNext ? state.index + 1 : effectiveIndex);
  $('base-spread').setAttribute('aria-label', `Chương ${chapter.roman}: ${chapter.name}`);
  baseLeft = $('base-spread').querySelector('.left');
  baseRight = $('base-spread').querySelector('.right');
  baseLines = [...baseRight.querySelectorAll('.reveal-line')];
  const textWindow = baseRight.querySelector('.text-window');
  textOverflow = Math.max(0, textWindow.scrollHeight - textWindow.clientHeight);
  $('turn-leaf').style.visibility = state.mode === 'turn' ? 'visible' : 'hidden';
  if (state.mode === 'turn') {
    $('turn-front').innerHTML = rightPage(chapter, state.index, true);
    $('turn-back').innerHTML = leftPage(next, state.index + 1);
    const frontWindow = $('turn-front').querySelector('.text-window');
    const frontOverflow = Math.max(0, frontWindow.scrollHeight - frontWindow.clientHeight);
    $('turn-front').querySelector('.text-lines').style.transform = `translateY(${-frontOverflow}px)`;
  }
  $('base-spread').inert = state.mode !== 'read';
  $('base-spread').setAttribute('aria-hidden', String(state.mode !== 'read'));
}
function setReduced(value) {
  reduced = value;
  document.documentElement.classList.toggle('reduced', value);
  $('motion-toggle').setAttribute('aria-pressed', String(value));
  $('motion-toggle').textContent = value ? 'Bật chuyển động lật' : 'Giảm chuyển động';
  currentKey = '';
  scheduleFrame();
}
function render() {
  framePending = false;
  const position = scrollY / pixelsPerUnit;
  const state = timelineAt(position, count);
  prepareScene(state);
  const coverMode = state.mode === 'cover';
  const opening = coverMode ? state.open : 1;
  $('book-shell').style.transform = `translateX(${-25 * (1 - (reduced ? opening >= .5 ? 1 : 0 : opening))}%)`;
  $('cover-leaf').style.visibility = coverMode ? 'visible' : 'hidden';
  $('cover-leaf').style.transform = `rotateY(${-180 * opening}deg)`;
  $('cover-leaf').setAttribute('aria-hidden', String(!coverMode || opening > .5));
  $('cover-leaf').inert = !coverMode || opening > .5;
  $('cover-back').style.filter = `brightness(${.8 + .2 * opening})`;
  $('closed-spine').style.opacity = String(1 - clamp(opening * 3));
  $('closed-edge').style.opacity = String(1 - opening);
  $('book-bed').style.opacity = String(clamp(opening * 3));
  $('page-edges').style.opacity = String(opening);
  $('gutter').style.opacity = String(opening);
  $('ribbon').style.opacity = String(opening);
  $('cover-label').style.opacity = String(1 - clamp(opening * 2));
  baseLeft.style.opacity = coverMode ? '0' : '1';
  baseRight.style.opacity = '1';
  const read = state.mode === 'read' ? state.read : reduced && state.mode === 'turn' && state.turn < .5 ? 1 : 0;
  baseRight.querySelector('.text-lines').style.transform = `translateY(${-textOverflow * clamp((read - .25) / .75)}px)`;
  if (state.mode === 'turn') {
    $('turn-leaf').style.transform = `rotateY(${-180 * state.turn}deg)`;
    $('turn-shade').style.opacity = String(Math.sin(state.turn * Math.PI) * .55);
    $('turn-front').style.filter = `brightness(${1 - Math.sin(state.turn * Math.PI) * .16})`;
    $('turn-back').style.filter = `brightness(${.83 + state.turn * .17})`;
  }
  if (reduced) {
    if (coverMode) {
      $('cover-leaf').style.visibility = opening < .5 ? 'visible' : 'hidden';
      baseLeft.style.opacity = opening >= .5 ? '1' : '0';
      $('base-spread').style.opacity = opening >= .5 ? '1' : '0';
    } else {
      $('base-spread').style.opacity = '1';
    }
  } else $('base-spread').style.opacity = '1';
  baseLines.forEach((line, index) => {
    const progress = lineProgress(read, index, baseLines.length);
    line.style.opacity = String(reduced ? (progress > 0 ? 1 : 0) : progress);
    line.style.transform = reduced ? 'none' : `translateY(${(1 - progress) * 8}px)`;
    line.setAttribute('aria-hidden', String(progress < .05));
    line.inert = progress < .95;
  });
  const displayIndex = state.mode === 'turn' && state.turn > .5 ? state.index + 1 : state.index;
  const chapter = chapters[displayIndex];
  $('status-eyebrow').textContent = coverMode ? 'Bìa sách / Mở đầu' : `Chương ${chapter.roman} / ${String(displayIndex + 1).padStart(2, '0')} — ${String(count).padStart(2, '0')}`;
  $('status-title').textContent = coverMode ? 'Câu chuyện đang chờ bạn mở.' : chapter.name;
  $('status-caption').textContent = coverMode ? 'Cuộn chậm để ngắm. Cuộn ngược để trở về.' : state.mode === 'turn' ? 'Dừng cuộn để giữ trang giấy. Cuộn ngược để lật lại.' : read < .98 ? 'Cuộn để đọc tiếp. Hết chữ, mình sang trang.' : 'Cuộn tiếp để lật trang. Cuộn ngược để đọc lại.';
  $('hint-title').textContent = coverMode ? 'Cuộn xuống để mở sách' : state.mode === 'turn' ? 'Bạn đang lật trang' : 'Cuộn xuống để đọc tiếp';
  $('hint-copy').textContent = coverMode ? 'Hoặc bấm mũi tên bên dưới.' : 'Cuộn lên để trở về trang trước.';
  $('previous').disabled = position <= .001;
  $('next').disabled = position >= totalUnits(count) - .001;
  $('next').setAttribute('aria-label', coverMode ? 'Mở sách' : 'Trang tiếp theo');
  document.querySelectorAll('.chapter-dot').forEach((dot, index) => dot.setAttribute('aria-current', String(!coverMode && displayIndex === index)));
  $('progress-fill').style.width = `${clamp(position / totalUnits(count)) * 100}%`;
  $('notice').hidden = position < totalUnits(count) - .002;
  const announce = coverMode ? 'cover' : `chapter-${displayIndex}`;
  if (announcementKey !== announce) {
    announcementKey = announce;
    $('chapter-announcement').textContent = coverMode ? 'Bìa sách. Cuộn xuống hoặc bấm mũi tên phải để mở.' : `Chương ${chapter.roman}: ${chapter.name}`;
  }
  $('book-shell').dataset.phase = state.mode;
  $('book-shell').dataset.chapter = String(state.index);
  $('book-shell').dataset.turn = state.turn.toFixed(4);
}
function scheduleFrame() { if (!framePending) { framePending = true; requestAnimationFrame(render); } }
function jump(position) { scrollTo({ top: position * pixelsPerUnit, behavior: reduced ? 'instant' : 'smooth' }); }
function navigate(direction) { jump(arrowTarget(scrollY / pixelsPerUnit, direction, count)); }
function sizeTrack(keepPosition = true) {
  const position = scrollY / pixelsPerUnit;
  pixelsPerUnit = Math.max(620, Math.min(1100, innerHeight * .95));
  $('scroll-track').style.height = `${totalUnits(count) * pixelsPerUnit + innerHeight}px`;
  if (keepPosition) scrollTo({ top: position * pixelsPerUnit, behavior: 'instant' });
  scheduleFrame();
}
$('cover-back').innerHTML = leftPage(chapters[0], 0);
$('chapter-nav').innerHTML = chapters.map((chapter, index) => `<button type="button" class="chapter-dot" aria-label="Chương ${chapter.roman}: ${chapter.name}" aria-current="false" data-chapter="${index}">${String(index + 1).padStart(2, '0')}</button>`).join('');
$('chapter-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-chapter]');
  if (button) jump(readingEnd(Number(button.dataset.chapter)));
});
$('previous').addEventListener('click', () => navigate(-1));
$('next').addEventListener('click', () => navigate(1));
$('home-link').addEventListener('click', event => { event.preventDefault(); jump(0); });
$('motion-toggle').addEventListener('click', () => setReduced(!reduced));
reducedQuery.addEventListener('change', event => setReduced(event.matches));
addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1); }
});
addEventListener('scroll', scheduleFrame, { passive: true });
addEventListener('resize', () => { currentKey = ''; sizeTrack(); });
document.fonts.ready.then(() => { currentKey = ''; scheduleFrame(); });
// Cuộn gốc điều khiển sách; không chặn wheel/touch, không ép trang tự lật hết.
document.body.classList.remove('no-js');
history.scrollRestoration = 'manual';
scrollTo({ top: 0, behavior: 'instant' });
sizeTrack(false);
setReduced(reduced);
render();
addEventListener('beforeprint', () => { $('print-chapters').innerHTML = chapters.map((chapter, index) => `<section class="spread">${leftPage(chapter, index)}${rightPage(chapter, index, true)}</section>`).join(''); });
addEventListener('afterprint', () => { $('print-chapters').innerHTML = ''; });
