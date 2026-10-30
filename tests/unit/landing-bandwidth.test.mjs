import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const {versionLandingAssets}=await import('../../scripts/build-landing.mjs');

test('asset content hashes update every reference and change only with asset bytes',()=>{
  assert.equal(typeof versionLandingAssets,'function','build must version assets for safe long-term caching');
  const dir=fs.mkdtempSync('.review-artifacts/cache-test-');
  try{
    fs.mkdirSync(path.join(dir,'book/assets'),{recursive:true});
    fs.writeFileSync(path.join(dir,'book/assets/cover.webp'),'cover bytes');
    fs.writeFileSync(path.join(dir,'index.html'),'<img src="/book/assets/cover.webp">');
    fs.writeFileSync(path.join(dir,'book/book-content.mjs'),"const file='cover.webp';");
    fs.mkdirSync(path.join(dir,'_astro'));
    fs.writeFileSync(path.join(dir,'_astro/index.css'),"body{background:url('/book/assets/cover.webp')}");
    versionLandingAssets(dir);
    const [name]=fs.readdirSync(path.join(dir,'book/assets'));
    assert.match(name,/^cover\.[a-f0-9]{16}\.webp$/);
    assert(fs.readFileSync(path.join(dir,'index.html'),'utf8').includes(name));
    assert(fs.readFileSync(path.join(dir,'book/book-content.mjs'),'utf8').includes(name));
    assert(!fs.existsSync(path.join(dir,'book/assets/cover.webp')));
    const [css]=fs.readdirSync(path.join(dir,'_astro'));
    const bytes=fs.readFileSync(path.join(dir,'_astro',css));
    assert(css.includes(createHash('sha256').update(bytes).digest('hex').slice(0,16)));
    assert(bytes.toString().includes(name));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

function music({blocked=false}={}){
  const listeners=new Map(),toggleEvents={},attempts=[];
  const audio={volume:1,play(){attempts.push('play');return blocked?Promise.reject(Error('blocked')):Promise.resolve();},pause(){}};
  const toggle={textContent:'',setAttribute(){},addEventListener(name,fn){toggleEvents[name]=fn;}};
  const document={hidden:false,getElementById:id=>id==='bg-music'?audio:toggle,addEventListener(){}};
  const window={addEventListener(name,fn,options){listeners.set(name,{fn,options});},removeEventListener(name){listeners.delete(name);}};
  runInNewContext(fs.readFileSync('public/book/book-music.mjs','utf8'),{document,window,setInterval:()=>1,clearInterval(){}});
  return {listeners,attempts,fire:async name=>{listeners.get(name)?.fn({target:null});await new Promise(resolve=>setImmediate(resolve));},toggleEvents};
}

test('music waits for interaction, captures inner scrolling and tries wheel',async()=>{
  const player=music();assert.equal(player.attempts.length,0);
  assert.equal(player.listeners.get('scroll').options.capture,true);
  assert(player.listeners.has('wheel'));
  await player.fire('wheel');assert.equal(player.attempts.length,1);
  assert(!player.listeners.has('click'),'remove automatic listeners only after successful play');
});
test('blocked scroll autoplay keeps click/keyboard retry available',async()=>{
  const player=music({blocked:true});await player.fire('scroll');
  assert(player.listeners.has('click'));
  await player.fire('click');assert.equal(player.attempts.length,2);
});

for(const event of ['click','keydown','touchstart','scroll'])test('first '+event+' attempts automatic music',async()=>{
  const player=music();await player.fire(event);assert.equal(player.attempts.length,1);
});
