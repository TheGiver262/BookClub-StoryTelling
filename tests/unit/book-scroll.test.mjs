import test from 'node:test';
import assert from 'node:assert/strict';
import {createBookScroll,phoneCanvas} from '../../public/book/book-scroll.mjs';

function fixture(){
  const events=[],moves=[];
  const host={scrollY:120,innerHeight:768,scrollTo:options=>moves.push(['window',options]),addEventListener:name=>events.push(['window',name])};
  const frame={clientHeight:0,scrollTop:240,scrollTo:options=>moves.push(['frame',options]),addEventListener:name=>events.push(['frame',name])};
  return {host,frame,events,moves,scroll:createBookScroll(frame,host)};
}
test('desktop keeps window scrolling while phone uses the logical landscape scroll surface',()=>{
  const {frame,scroll,moves}=fixture();
  assert.equal(scroll.top,120);assert.equal(scroll.height,768);scroll.move(500);
  frame.clientHeight=390;
  assert.equal(scroll.top,240);assert.equal(scroll.height,390);scroll.move(700);
  assert.deepEqual(moves,[['window',{top:500,behavior:'instant'}],['frame',{top:700,behavior:'instant'}]]);
});
test('orientation/layout changes choose the current surface and both scroll events are observed',()=>{
  const {frame,scroll,events}=fixture();
  scroll.listen(()=>{});assert.deepEqual(events,[['window','scroll'],['frame','scroll']]);
  frame.clientHeight=390;assert.equal(scroll.top,240);
  frame.clientHeight=0;assert.equal(scroll.top,120);
});
test('short browser viewports scale a minimum 320px landscape canvas without cropping it',()=>{
  for(const [width,height] of [[320,568],[568,320],[390,844],[844,390],[568,260],[667,280],[568,232]]){
    const canvas=phoneCanvas(width,height);
    assert(canvas.height>=320);
    assert.equal(canvas.width*canvas.scale,Math.max(width,height));
    assert.equal(canvas.height*canvas.scale,Math.min(width,height));
    assert(canvas.scale>0&&canvas.scale<=1);
  }
});
