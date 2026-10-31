// Grass/sky boundaries sampled from the two artworks at x = 0, 1/16, …, 1.
const defaultProfile = {
  cover: { width: 1024, height: 1536, horizon: [856,838,836,836,812,802,796,793,790,793,800,806,817,829,842,854,864].map(y => y / 1536) },
  background: { width: 1672, height: 941, horizon: [561,542,532,514,502,489,477,471,466,471,480,492,507,523,539,556,565].map(y => y / 941) }
};

function horizonAt(profile, x) {
  const p = Math.max(0, Math.min(1, x)) * (profile.length - 1);
  const i = Math.min(profile.length - 2, Math.floor(p));
  return profile[i] + (profile[i + 1] - profile[i]) * (p - i);
}

export function alignBackdrop({stageWidth,stageHeight,left,top,width,height,fitHeight=false,profile=defaultProfile}) {
  const {cover,background}=profile;
  const coverScale = fitHeight ? height / cover.height : Math.max(width / cover.width, height / cover.height);
  const coverX = (width - cover.width * coverScale) / 2;
  const coverY = top + height - cover.height * coverScale;
  const scale = Math.max(stageWidth / background.width, stageHeight * 1.5 / background.height);
  const imageX = (stageWidth - background.width * scale) / 2;
  const imageY = (stageHeight - background.height * scale) / 2;
  const edges = [left, left + width].map(x => ({
    x,
    target: coverY + horizonAt(cover.horizon, (x - left - coverX) / coverScale / cover.width) * cover.height * coverScale,
    outside: imageY + horizonAt(background.horizon, (x - imageX) / scale / background.width) * background.height * scale,
  }));
  const slope = ((edges[1].target - edges[1].outside) - (edges[0].target - edges[0].outside)) / width;
  const shift = edges[0].target - edges[0].outside - slope * (left - stageWidth / 2);
  return { slope, shift, edges };
}

if (typeof document !== 'undefined') {
  const stage = document.querySelector('.stage');
  const profile = JSON.parse(stage?.dataset?.backdrop || 'null') || defaultProfile;
  const area = document.querySelector('.book-area');
  const shell = document.getElementById('book-shell');
  const leaf = document.getElementById('cover-leaf');
  const cover = leaf?.querySelector('.cover-front');
  if (stage && area && shell && leaf && cover && profile) {
    let trackedBook=null,trackedFront=null;
    const align = () => {
      const single = area.querySelector?.('.single-book');
      const front = single?.querySelector?.('[data-leaf="0"] .cover-front');
      const current = single && front ? front : cover;
      const phone = !!single || document.getElementById('landing-scroll')?.clientHeight > 0;
      const rect = single && front?.getBoundingClientRect ? front.getBoundingClientRect() : null;
      const bounds = stage.getBoundingClientRect(), region = area.getBoundingClientRect();
      if (!bounds.width || !bounds.height || !current.clientWidth || !current.clientHeight) return;
      const style = getComputedStyle(current);
      // Use the closed-book position, independent of page-turn transforms.
      const result = alignBackdrop({profile,
        stageWidth: phone ? stage.clientWidth : bounds.width, stageHeight: phone ? stage.clientHeight : bounds.height,
        left: single && rect ? rect.left - bounds.left + (single.clientWidth - current.clientWidth) / 2 : (phone ? area.offsetLeft : region.left - bounds.left) + ((phone ? area.clientWidth : region.width) - shell.clientWidth) / 2 - shell.clientWidth / 4 + leaf.offsetLeft + parseFloat(style.borderLeftWidth),
        top: single && rect ? rect.top - bounds.top + (single.clientHeight - current.clientHeight) / 2 : (phone ? area.offsetTop : region.top - bounds.top) + ((phone ? area.clientHeight : region.height) - shell.clientHeight) / 2 + leaf.offsetTop + parseFloat(style.borderTopWidth),
        width: current.clientWidth, height: current.clientHeight,
        fitHeight: style.backgroundSize === 'contain' || style.backgroundSize === 'auto 100%' || style.backgroundSize.startsWith('auto'),
      });
      stage.style.setProperty('--backdrop-shift', String(result.shift));
      stage.style.setProperty('--backdrop-slope', String(result.slope));
    };
    new ResizeObserver(align).observe(stage);
    new ResizeObserver(align).observe(area);
    new ResizeObserver(align).observe(shell);
    new ResizeObserver(align).observe(cover);
    // Keep the mobile single-reader cover monitored as PageFlip rebuilds the nodes.
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(()=>{
        const single=area.querySelector?.('.single-book'),front=single?.querySelector('[data-leaf="0"] .cover-front');
        if(single!==trackedBook||front!==trackedFront){
          trackedBook=single;trackedFront=front;
          if(single)new ResizeObserver(align).observe(single);
          if(front)new ResizeObserver(align).observe(front);
          align();
        }
      }).observe(area,{childList:true,subtree:true});
    }
    if (typeof addEventListener !== 'undefined') {
      addEventListener('resize', align);
    }
    align();
  }
}
