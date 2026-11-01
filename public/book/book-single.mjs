import {PageFlip} from './vendor/page-flip.mjs';
import {clamp} from './book-timeline.mjs';
import {paginateLeaf} from './book-pagination.mjs';

// The desktop and phone share the content renderer; only the reading surface changes.
export function createSingleReader({area,pages,startPage=0,startOffset=0,reduced,onPage,order}) {
  const root=document.createElement('div');root.className='single-reader';
  root.innerHTML='<div class="single-book"></div><div class="single-corner left top" aria-hidden="true"></div><div class="single-corner right top" aria-hidden="true"></div><div class="single-corner left bottom" aria-hidden="true"></div><div class="single-corner right bottom" aria-hidden="true"></div>';
  area.append(root);
  const book=root.firstElementChild;
  const leaves=[];
  pages.forEach((html,index)=>{
    const leaf=document.createElement('div');leaf.className='single-leaf';leaf.dataset.leaf=String(index);
    leaf.innerHTML=`<div class="single-content">${html}</div>`;
    if(index===0||index>=pages.length-2)leaf.dataset.density='hard';
    leaf.style.cssText="position:absolute;width:100%;height:100%";
    book.append(leaf);
    paginateLeaf(leaf).forEach((part,offset)=>{part.dataset.sourcePage=String(index);part.dataset.part=String(offset);part.dataset.leaf=String(leaves.length);leaves.push(part);});
  });
  const first=leaves.findIndex(leaf=>Number(leaf.dataset.sourcePage)===startPage);
  startPage=Math.max(0,first)+Math.min(startOffset,leaves.filter(leaf=>leaf.dataset.sourcePage===String(startPage)).length-1);
  let number=0;
  leaves.forEach(leaf=>{if(Number(leaf.dataset.sourcePage)>1&&Number(leaf.dataset.sourcePage)<pages.length-3){leaf.dataset.reading=String(++number);leaf.querySelector(".page-num").textContent=String(number).padStart(2,"0");}});
  const abort=new AbortController(),signal=abort.signal;
  const stage=area.closest('.stage');
  const readingSurface=event=>event.target.closest('.single-reader,.chapter-nav');
  // Native panning belongs to the paper; the surrounding scenery stays still.
  stage.addEventListener('touchmove',event=>{
    if(event.touches.length===1&&!readingSurface(event)&&!(window.visualViewport?.scale>1)&&event.cancelable)event.preventDefault();
  },{passive:false,signal});
  stage.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey&&!(window.visualViewport?.scale>1)&&!readingSurface(event)&&event.cancelable)event.preventDefault();
  },{passive:false,signal});
  const flip=new PageFlip(book,{width:book.clientWidth,height:book.clientHeight,size:'fixed',startPage,usePortrait:true,autoSize:false,showCover:true,useMouseEvents:false,showPageCorners:false,flippingTime:650,maxShadowOpacity:.2});
  let index=startPage,target=startPage,drag=null,touch=null,revealFrame=0,wheel=0,lastWheel=0,wheelLocked=false,destroyed=false,fitFrame=0,lastHeight=0,resetTop=false,backward=false;
  function canScroll(direction){const rect=stage.getBoundingClientRect();return direction>0?rect.bottom>window.innerHeight+2:rect.top<-2;}
  function fit(){
    if(destroyed||drag||flip.getState()!=='read')return;
    const height=book.clientHeight;
    if(height!==lastHeight){lastHeight=height;flip.getSettings().height=height;flip.getUI().update();}
    if(resetTop){resetTop=false;window.scrollTo({top:Math.max(0,stage.getBoundingClientRect().top+window.scrollY),behavior:'instant'});}
  }
  function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fit);}
  const resize=new ResizeObserver(scheduleFit);
  leaves.forEach(leaf=>resize.observe(leaf.firstElementChild.firstElementChild));
  function reveal(){
    cancelAnimationFrame(revealFrame);
    const nodes=order(leaves[index]).concat([...leaves[index].querySelectorAll('[data-slogan-stage]')]);
    const start=performance.now(),complete=reduced||backward;
    function tick(now){
      const progress=complete?1:clamp((now-start)/1800);
      nodes.forEach((node,i)=>{
        node.style.opacity=String(complete?1:clamp((progress-i*.7/Math.max(1,nodes.length))/.3));
        node.style.transform='none';node.removeAttribute('aria-hidden');node.inert=false;
      });
      if(progress<1)revealFrame=requestAnimationFrame(tick);
    }
    tick(start);
  }
  function publish(){
    const next=flip.getCurrentPageIndex();if(next!==index)backward=next<index;resetTop=resetTop||next!==index;index=next;book.dataset.page=String(index);
    if(target===null)target=index;
    leaves.forEach((leaf,i)=>{leaf.inert=i!==index;leaf.setAttribute('aria-hidden',String(i!==index));});
    scheduleFit();
    book.dataset.sourcePage=leaves[index].dataset.sourcePage;book.dataset.part=leaves[index].dataset.part;
    reveal();onPage(Number(leaves[index].dataset.sourcePage),pages.length,Number(leaves[index].dataset.reading)||0,number,index,leaves.length);
  }
  function advance(){
    if(destroyed||flip.getState()!=='read'||target===null||index===target)return;
    if(reduced){flip.turnToPage(target);return;}
    if(target>index)flip.flipNext('bottom');else flip.flipPrev('bottom');
  }
  function goPhysical(page){target=clamp(page,0,leaves.length-1);advance();}
  function go(source){const index=leaves.findIndex(leaf=>Number(leaf.dataset.sourcePage)===source);if(index>=0)goPhysical(index);}
  flip.on('flip',publish);
  flip.on('changeState',event=>{
    if(event.data==='read')requestAnimationFrame(()=>{if(!destroyed){fit();advance();}});
    else {
      cancelAnimationFrame(revealFrame);
      // An incoming leaf is committed only after the fold finishes.
      leaves.forEach((leaf,i)=>leaf.querySelectorAll('[data-reveal],.reveal-line,[data-slogan-stage]').forEach(node=>{node.style.opacity=i===index?'1':'0';node.style.transform='none';}));
    }
  });
  flip.loadFromHTML(leaves);
  publish();
  const point=event=>{const rect=flip.getUI().getDistElement().getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};};
  root.addEventListener('pointerdown',event=>{
    if(!event.isPrimary){cancelDrag();return;}
    if(event.button!==0||event.target.closest('a,button,input,select,textarea,[contenteditable]')||flip.getState()!=='read'||window.visualViewport?.scale>1)return;
    const pos=point(event);
    // Corners reserve touch panning for page turns; the middle remains a native reader.
    const edge=Math.min(140,book.clientWidth*.35);
    if(event.pointerType==='mouse'&&pos.x>edge&&pos.x<book.clientWidth-edge)return;
    target=index;drag={id:event.pointerId,pos,x:event.clientX,y:event.clientY,corner:!!event.target.closest('.single-corner')};
    if(drag.corner)root.setPointerCapture(event.pointerId);
  },{signal});
  root.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(drag.corner)event.preventDefault();
    if(!drag.active){
      if(!drag.corner&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
      if(Math.abs(dx)<8)return;
      if(dx>0&&index===0||dx<0&&index===leaves.length-1){drag=null;return;}
      drag.active=true;drag.direction=dx<0?1:-1;
      if(touch)touch.dragged=true;
      if(!reduced){
        // Portrait backward folds are selected by a starting point on the left edge.
        const start={x:drag.direction>0?book.clientWidth-1:1,y:drag.pos.y};
        drag.start=start;
        flip.startUserTouch({x:start.x+drag.direction*8,y:start.y});flip.userMove(start,true);
      }
      root.setPointerCapture(event.pointerId);getSelection()?.removeAllRanges();
    }
    event.preventDefault();
    if(!reduced)flip.userMove({x:drag.start.x+(event.clientX-drag.x)*2,y:drag.corner?drag.start.y:point(event).y},true);
  },{signal});
  function cancelDrag(){
    if(drag?.active&&!reduced){target=null;flip.userMove(drag.start,true);flip.userStop(drag.start);flip.getRender().finishAnimation();}
    drag=null;
  }
  function endDrag(event){
    if(!drag||drag.id!==event.pointerId)return;
    const current=drag;drag=null;
    if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
    if(!current.active){scheduleFit();return;}
    if(event.type!=='pointerup'){
      if(!reduced){target=null;flip.userMove(current.start,true);flip.userStop(current.start);flip.getRender().finishAnimation();}return;
    }
    if(reduced){if(Math.abs(event.clientX-current.x)>40)goPhysical(index+current.direction);}
    else {target=null;flip.userStop({x:current.start.x+(event.clientX-current.x)*2,y:current.corner?current.start.y:point(event).y});}
  }
  root.addEventListener('pointerup',endDrag,{signal});root.addEventListener('pointercancel',endDrag,{signal});
  // Touch transfers implicit capture from a child to this root; that child's loss bubbles.
  root.addEventListener('lostpointercapture',event=>{if(event.target===root)endDrag(event);},{signal});
  root.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){touch=null;cancelDrag();return;}
    const t=event.touches[0];touch={x:t.clientX,y:t.clientY,top:window.scrollY,scale:window.visualViewport?.scale??1,corner:!!drag?.corner};
  },{passive:true,signal});
  root.addEventListener('touchmove',event=>{
    if(!touch||touch.dragged||event.touches.length!==1||touch.scale!==1||window.visualViewport?.scale>1)return;
    if(touch.corner){if(event.cancelable)event.preventDefault();return;}
    const t=event.touches[0],dy=touch.y-t.clientY,dx=t.clientX-touch.x,direction=Math.sign(dy);
    if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.5&&!canScroll(direction)&&!(index===leaves.length-1&&direction>0)&&!(index===0&&direction<0)&&event.cancelable)event.preventDefault();
  },{passive:false,signal});
  root.addEventListener('touchend',event=>{
    if(!touch||event.touches.length||drag?.active)return;
    const previous=touch;touch=null;
    if(previous.dragged||previous.corner)return;
    if(previous.scale!==1||window.visualViewport?.scale>1||!event.changedTouches.length)return;
    const t=event.changedTouches[0],dy=previous.y-t.clientY,dx=t.clientX-previous.x;
    if(Math.abs(dy)>80&&Math.abs(dy)>Math.abs(dx)*1.5&&Math.abs(window.scrollY-previous.top)<2&&!canScroll(Math.sign(dy)))goPhysical(index+Math.sign(dy));
  },{passive:true,signal});
  root.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey||window.visualViewport?.scale>1||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
    const direction=Math.sign(event.deltaY);
    if(!direction)return;
    // Keep a trackpad's slower momentum tail in the same page-turn gesture.
    const now=performance.now(),paused=now-lastWheel>500;lastWheel=now;
    if(canScroll(direction)){wheel=0;wheelLocked=true;return;}
    if(index===leaves.length-1&&direction>0||index===0&&direction<0)return;
    event.preventDefault();
    if(paused){wheel=0;wheelLocked=false;}
    else if(wheel&&Math.sign(wheel)!==direction)wheel=0;
    if(flip.getState()!=='read'){wheel=0;wheelLocked=true;return;}
    if(wheelLocked)return;
    wheel+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?book.clientHeight:1);
    if(Math.abs(wheel)>=70){wheel=0;wheelLocked=true;goPhysical(index+direction);}
  },{passive:false,signal});
  return {
    get page(){return Number(leaves[index].dataset.sourcePage);},get offset(){return Number(leaves[index].dataset.part);},get length(){return pages.length;},
    fit:scheduleFit,go, next:direction=>goPhysical(index+direction),
    setReduced(value){cancelDrag();reduced=value;if(value){flip.getRender().finishAnimation();target=index;flip.turnToPage(index);}reveal();},
    destroy(){destroyed=true;abort.abort();resize.disconnect();cancelAnimationFrame(revealFrame);cancelAnimationFrame(fitFrame);flip.destroy();root.remove();},
  };
}
