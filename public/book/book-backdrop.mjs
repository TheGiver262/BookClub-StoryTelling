// Grass/sky boundaries sampled from the two artworks at x = 0, 1/16, …, 1.
// The cover's lily at x=1/8 is excluded from the underlying hill contour.
const coverHorizon = [856,838,836,836,812,802,796,793,790,793,800,806,817,829,842,854,864];
const landscapeHorizon = [561,542,532,514,502,489,477,471,466,471,480,492,507,523,539,556,565];
function horizonAt(profile, x) {
  const p = Math.max(0, Math.min(1, x)) * 16;
  const i = Math.min(15, Math.floor(p));
  return profile[i] + (profile[i + 1] - profile[i]) * (p - i);
}

export function alignBackdrop({stageWidth,stageHeight,left,top,width,height,fitHeight=false}) {
  const coverScale = fitHeight ? height / 1536 : Math.max(width / 1024, height / 1536);
  const coverX = (width - 1024 * coverScale) / 2;
  const coverY = top + height - 1536 * coverScale;
  const scale = Math.max(stageWidth / 1672, stageHeight * 1.5 / 941);
  const imageX = (stageWidth - 1672 * scale) / 2;
  const imageY = (stageHeight - 941 * scale) / 2;
  const edges = [left, left + width].map(x => ({
    x,
    target: coverY + horizonAt(coverHorizon, (x - left - coverX) / coverScale / 1024) * coverScale,
    outside: imageY + horizonAt(landscapeHorizon, (x - imageX) / scale / 1672) * scale,
  }));
  const slope = ((edges[1].target - edges[1].outside) - (edges[0].target - edges[0].outside)) / width;
  const shift = edges[0].target - edges[0].outside - slope * (left - stageWidth / 2);
  return {slope,shift,edges};
}

if (typeof document !== 'undefined') {
  const stage = document.querySelector('.stage');
  const area = document.querySelector('.book-area');
  const shell = document.getElementById('book-shell');
  const leaf = document.getElementById('cover-leaf');
  const cover = leaf?.querySelector('.cover-front');
  if (stage && area && shell && leaf && cover) {
    const align = () => {
      const bounds = stage.getBoundingClientRect();
      const region = area.getBoundingClientRect();
      const phone=document.getElementById('landing-scroll')?.clientHeight>0;
      if (!bounds.width || !bounds.height || !cover.clientWidth || !cover.clientHeight) return;
      const style = getComputedStyle(cover);
      // Use the closed-book position, independent of page-turn transforms.
      const result = alignBackdrop({
        stageWidth: phone?stage.clientWidth:bounds.width, stageHeight: phone?stage.clientHeight:bounds.height,
        left: (phone?area.offsetLeft:region.left-bounds.left) + ((phone?area.clientWidth:region.width) - shell.clientWidth) / 2 - shell.clientWidth / 4 + leaf.offsetLeft + parseFloat(style.borderLeftWidth),
        top: (phone?area.offsetTop:region.top-bounds.top) + ((phone?area.clientHeight:region.height) - shell.clientHeight) / 2 + leaf.offsetTop + parseFloat(style.borderTopWidth),
        width: cover.clientWidth, height: cover.clientHeight,
        fitHeight: style.backgroundSize.startsWith('auto'),
      });
      stage.style.setProperty('--backdrop-slope', String(result.slope));
      stage.style.setProperty('--backdrop-shift', String(result.shift));
    };
    const observer = new ResizeObserver(align);
    for (const node of [stage,area,shell,cover]) observer.observe(node);
    align();
  }
}
