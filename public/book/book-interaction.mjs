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

export function getDesktopDragZone(rect, x, y, closed) {
  const width = rect.width;
  const height = rect.height;
  const halfWidth = width / 2;

  // Xác định 4 góc sách theo chiều dọc (khoảng 38% chiều cao mỗi đầu)
  const cornerHeight = Math.max(180, Math.min(280, height * 0.38));
  const isCornerY = y <= cornerHeight || y >= height - cornerHeight;

  // Ở 4 góc sách: tăng rộng vùng kéo chuột lên tới 48% của nửa trang (tối đa 280px)
  // Ở mép thân giữa sách: vùng kéo rộng khoảng 32% (tối đa 180px)
  const cornerEdge = Math.max(180, Math.min(280, (closed ? width : halfWidth) * 0.48));
  const middleEdge = Math.max(120, Math.min(180, (closed ? width : halfWidth) * 0.32));
  const activeEdge = isCornerY ? cornerEdge : middleEdge;

  if (x >= width - activeEdge) {
    return { direction: 1, isCorner: isCornerY };
  }
  if (!closed && x <= activeEdge) {
    return { direction: -1, isCorner: isCornerY };
  }
  return null;
}

export function desktopDrag(shell,{position,count,move,finish,enabled}) {
  let drag=null;

  shell.addEventListener('pointerdown',event=>{
    if(!enabled()||event.button!==0||!event.isPrimary||event.target.closest('a,button,input,textarea,select,[contenteditable]'))return;
    const rect=shell.getBoundingClientRect();
    const x=event.clientX-rect.left;
    const y=event.clientY-rect.top;
    const closed=timelineAt(position(),count).mode==='cover';
    const zone=getDesktopDragZone(rect,x,y,closed);
    if(!zone)return;
    const range=dragRange(position(),zone.direction,count);
    if(!range)return;
    drag={
      id:event.pointerId,
      x:event.clientX,
      y:event.clientY,
      time:performance.now(),
      width:rect.width/2,
      direction:zone.direction,
      isCorner:zone.isCorner,
      range,
      origin:position(),
      progress:0,
      active:false
    };
  });

  shell.addEventListener('pointermove',event=>{
    if(!drag){
      // Visual feedback: hiển thị con trỏ grab khi hover vào vùng kéo (4 góc / mép sách)
      if(!enabled()||event.pointerType!=='mouse')return;
      if(event.target.closest('a,button,input,textarea,select,[contenteditable]')){
        if(shell.style.cursor==='grab')shell.style.cursor='';
        return;
      }
      const rect=shell.getBoundingClientRect();
      const x=event.clientX-rect.left;
      const y=event.clientY-rect.top;
      const closed=timelineAt(position(),count).mode==='cover';
      const zone=getDesktopDragZone(rect,x,y,closed);
      const range=zone&&dragRange(position(),zone.direction,count);
      const canDrag=Boolean(zone&&range);
      const targetCursor=canDrag?'grab':'';
      if(shell.style.cursor!==targetCursor){
        shell.style.cursor=targetCursor;
      }
      return;
    }

    if(event.pointerId!==drag.id)return;
    const dx=(drag.x-event.clientX)*drag.direction;
    const dy=event.clientY-drag.y;

    if(!drag.active){
      if(drag.isCorner){
        // Ở 4 góc sách: cho phép kéo chéo (diagonal) tự nhiên, không hủy drag vì dy
        if(dx<-24){drag=null;return;}
        const dist=Math.hypot(Math.max(0,dx),dy);
        if(dx<5&&(dx<2||dist<8))return;
      }else{
        if(Math.abs(dy)>25&&dx<=2){drag=null;return;}
        if(dx<6)return;
      }
      drag.active=true;
      shell.setPointerCapture(event.pointerId);
      shell.classList.add('is-dragging');
      getSelection()?.removeAllRanges();
    }

    event.preventDefault();
    const effectiveDx=drag.isCorner?Math.max(dx,dx*0.75+Math.abs(dy)*0.45):dx;
    drag.progress=clamp(effectiveDx/drag.width);
    move(drag.range[0]+(drag.range[1]-drag.range[0])*drag.progress);
  });

  shell.addEventListener('pointerleave',()=>{
    if(!drag&&shell.style.cursor==='grab'){
      shell.style.cursor='';
    }
  });

  function end(event){
    if(!drag||event.pointerId!==drag.id)return;
    const current=drag;
    drag=null;
    shell.classList.remove('is-dragging');
    shell.style.cursor='';
    if(shell.hasPointerCapture(event.pointerId))shell.releasePointerCapture(event.pointerId);
    if(!current.active)return;
    const commit=event.type==='pointerup'&&dragCommitted(current.progress*current.width,current.width,performance.now()-current.time);
    const end=timelineAt(current.range[1],count);
    const target=commit?current.direction>0&&end.mode!=='closing'?readingEnd(end.index):current.range[1]:current.origin;
    finish(target);
  }
  shell.addEventListener('pointerup',end);
  shell.addEventListener('pointercancel',end);
  shell.addEventListener('lostpointercapture',event=>{if(event.target===shell)end(event);});
}
