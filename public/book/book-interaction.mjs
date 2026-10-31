import {OPEN, TURN, clamp, timelineAt, readingStart, readingEnd,totalUnits} from './book-timeline.mjs';

export const singlePageQuery = '(max-width:700px), (max-width:1100px) and (max-height:500px)';
export function leafForPosition(position, count) {
  const state=timelineAt(position,count);
  if(state.mode==='closing')return count*2+(state.close>=.5?2:1);
  const index=state.index+(state.mode==='turn'&&state.turn>=.5?1:0);
  return state.mode==='cover'?0:index===0?1:index*2;
}
export const positionForLeaf = (leaf,count) => leaf===0?0:count&&leaf>=count*2+2?totalUnits(count):readingEnd(Math.floor(leaf/2));
export function dragRange(position,direction,count) {
  const state=timelineAt(position,count);
  if(state.mode==='closing')return direction<0?[totalUnits(count),readingEnd(count)]:state.close<1?[readingEnd(count),totalUnits(count)]:null;
  const index=state.index+(state.mode==='turn'&&state.turn>=.5?1:0);
  if(direction>0){
    if(state.mode==='cover')return [0,OPEN];
    return index===count?[readingEnd(count),totalUnits(count)]:index<count?[readingEnd(index),readingEnd(index)+TURN]:null;
  }
  if(state.mode==='cover')return position>0?[OPEN,0]:null;
  return index===0?[OPEN,0]:[readingStart(index),readingEnd(index-1)];
}
export const dragCommitted=(distance,width,elapsed)=>distance>=width*.25 || distance>=40&&distance/Math.max(1,elapsed)>.55;

export function desktopDrag(shell,{position,count,move,finish,enabled}) {
  let drag=null;
  shell.addEventListener('pointerdown',event=>{
    if(!enabled()||event.button!==0||!event.isPrimary||event.target.closest('a,button,input,textarea,select,[contenteditable]'))return;
    const rect=shell.getBoundingClientRect(),x=event.clientX-rect.left;
    const closed=timelineAt(position(),count).mode==='cover';
    const edge=Math.min(104,rect.width*.18);
    const direction=x>rect.width-edge?1:!closed&&x<edge?-1:0;
    const range=direction&&dragRange(position(),direction,count);
    if(!range)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),width:rect.width/2,direction,range,origin:position(),progress:0};
  });
  shell.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=(drag.x-event.clientX)*drag.direction,dy=event.clientY-drag.y;
    if(!drag.active){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
      if(dx<8)return;
      drag.active=true;shell.setPointerCapture(event.pointerId);shell.classList.add('is-dragging');
      getSelection()?.removeAllRanges();
    }
    event.preventDefault();drag.progress=clamp(dx/drag.width);
    move(drag.range[0]+(drag.range[1]-drag.range[0])*drag.progress);
  });
  function end(event){
    if(!drag||event.pointerId!==drag.id)return;
    const current=drag;drag=null;shell.classList.remove('is-dragging');
    if(shell.hasPointerCapture(event.pointerId))shell.releasePointerCapture(event.pointerId);
    if(!current.active)return;
    const commit=event.type==='pointerup'&&dragCommitted(current.progress*current.width,current.width,performance.now()-current.time);
    const end=timelineAt(current.range[1],count);
    const target=commit?current.direction>0&&end.mode!=='closing'?readingEnd(end.index):current.range[1]:current.origin;
    finish(target);
  }
  shell.addEventListener('pointerup',end);shell.addEventListener('pointercancel',end);
  shell.addEventListener('lostpointercapture',event=>{if(event.target===shell)end(event);});
}
