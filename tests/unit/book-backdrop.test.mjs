import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { alignBackdrop } from '../../public/book/book-backdrop.mjs';

test('outside horizon meets both cover edges across desktop, tablet and phone sizes', () => {
  for (const [stageWidth,stageHeight,left,top,width,height,fitHeight] of [
    [1440,1000,401,119,646,774,false],
    [1920,1080,597,127,733,869,false],
    [1024,768,292,118,450,539,false],
    [1440,700,484,105,476,536,false],
    [390,844,125,117,147,555,true],
    [320,740,107,117,112,451,true],
    [390,667,125,107,147,473,true],
    [844,390,259,99,171,226,false],
  ]) {
    const {slope,shift,edges} = alignBackdrop({stageWidth,stageHeight,left,top,width,height,fitHeight});
    assert.ok(Number.isFinite(slope) && Number.isFinite(shift));
    for (const edge of edges) {
      const actual = edge.outside + slope * (edge.x - stageWidth / 2) + shift;
      assert.ok(Math.abs(actual - edge.target) < .01, `${stageWidth}×${stageHeight}: horizon must meet at x=${edge.x}`);
    }
  }
});

test('calibration uses the original 1024×1536 cover pixels and bottom-aligned cropping', () => {
  const {edges} = alignBackdrop({stageWidth:1600,stageHeight:1000,left:400,top:100,width:512,height:768});
  assert.equal(edges[0].target, 100 + 856 / 2);
  assert.equal(edges[1].target, 100 + 864 / 2);
  const cropped = alignBackdrop({stageWidth:1600,stageHeight:1000,left:400,top:100,width:512,height:600});
  assert.equal(cropped.edges[0].target, 100 + 600 - 768 + 856 / 2);
  assert.equal(cropped.edges[1].target, 100 + 600 - 768 + 864 / 2);
});

test('resize measures the closed cover without changing any book node or following its turn transform', async () => {
  const source = await readFile(new URL('../../public/book/book-backdrop.mjs', import.meta.url), 'utf8');
  const properties = new Map();
  const stage = {getBoundingClientRect:()=>({left:0,top:0,width:1440,height:1000}),style:{setProperty:(key,value)=>properties.set(key,value)}};
  const area = {getBoundingClientRect:()=>({left:78,top:125,width:1284,height:757})};
  const shell = {clientWidth:1284,clientHeight:755};
  const cover = {clientWidth:649,clientHeight:771};
  const leaf = {offsetLeft:642,offsetTop:-8,querySelector:()=>cover};
  const nodes = {'.stage':stage,'.book-area':area,'book-shell':shell,'cover-leaf':leaf};
  let resize;
  runInNewContext(source.replace('export function alignBackdrop', 'function alignBackdrop'), {
    document:{querySelector:key=>nodes[key],getElementById:key=>nodes[key]},
    getComputedStyle:()=>({borderLeftWidth:'1px',borderTopWidth:'0px',backgroundSize:'cover'}),
    ResizeObserver:class {constructor(callback){resize=callback;} observe(){}},
  });
  const expected = alignBackdrop({stageWidth:1440,stageHeight:1000,left:400,top:118,width:649,height:771});
  assert.equal(Number(properties.get('--backdrop-shift')), expected.shift);
  assert.equal(Number(properties.get('--backdrop-slope')), expected.slope);
  shell.getBoundingClientRect = () => { throw new Error('Animated shell transform must not move the backdrop'); };
  resize();
  assert.equal(Number(properties.get('--backdrop-shift')), expected.shift);
  shell.clientHeight=700;cover.clientHeight=716;
  resize();
  assert.notEqual(Number(properties.get('--backdrop-shift')), expected.shift);
  cover.clientWidth=0;
  resize();
  assert.ok(Number.isFinite(Number(properties.get('--backdrop-shift'))));
});

test('rotated phone backdrop measures logical landscape offsets instead of rotated screen bounds',async()=>{
  const source=await readFile(new URL('../../public/book/book-backdrop.mjs',import.meta.url),'utf8');
  const properties=new Map();
  const stage={clientWidth:844,clientHeight:390,getBoundingClientRect:()=>({left:0,top:0,width:390,height:844}),style:{setProperty:(key,value)=>properties.set(key,value)}};
  const area={offsetLeft:52,offsetTop:44,clientWidth:740,clientHeight:294,getBoundingClientRect:()=>({left:0,top:0,width:294,height:740})};
  const cover={clientWidth:255,clientHeight:304};
  const nodes={'.stage':stage,'.book-area':area,'book-shell':{clientWidth:500,clientHeight:294},'cover-leaf':{offsetLeft:250,offsetTop:-5,querySelector:()=>cover},'landing-scroll':{clientHeight:390}};
  runInNewContext(source.replace('export function alignBackdrop','function alignBackdrop'),{document:{querySelector:key=>nodes[key],getElementById:key=>nodes[key]},getComputedStyle:()=>({borderLeftWidth:'1px',borderTopWidth:'0px',backgroundSize:'cover'}),ResizeObserver:class{observe(){}}});
  const expected=alignBackdrop({stageWidth:844,stageHeight:390,left:298,top:39,width:255,height:304});
  assert.equal(Number(properties.get('--backdrop-shift')),expected.shift);
  assert.equal(Number(properties.get('--backdrop-slope')),expected.slope);
});
