export function phoneCanvas(width,height){
  const short=Math.max(1,Math.min(width,height)),long=Math.max(1,width,height);
  const scale=Math.min(1,short/320);
  return {width:long/scale,height:short/scale,scale};
}

export function createBookScroll(frame,host){
  const surface=()=>frame.clientHeight>0?frame:host;
  return {
    get top(){const node=surface();return node===host?host.scrollY:node.scrollTop;},
    get height(){const node=surface();return node===host?host.innerHeight:node.clientHeight;},
    move(top){surface().scrollTo({top,behavior:'instant'});},
    listen(handler){for(const node of [host,frame])node.addEventListener('scroll',handler,{passive:true});},
  };
}
