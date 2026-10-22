import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {verifyLandingBuild} from '../../scripts/build-landing.mjs';

function fixture(run){
  fs.mkdirSync('.review-artifacts',{recursive:true});
  const directory=fs.mkdtempSync('.review-artifacts/landing-gate-');
  try{fs.writeFileSync(path.join(directory,'index.html'),'<html><body><a aria-disabled="true">Tủ sách</a></body></html>');run(directory);}
  finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test('landing gate rejects application pages, bundles, source maps and config files',()=>{
  for(const name of ['login/index.html','_astro/InternalWorkspace.js','book/book.mjs.map','.env','credentials.json'])fixture(directory=>{
    const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'unexpected');
    assert.throws(()=>verifyLandingBuild(directory),/Unexpected file/);
  });
});
test('landing gate rejects live links, forms, API code and private keys',()=>{
  for(const value of ['<a href="/sach/">Tủ sách</a>','<form>login</form>',"fetch('/api/v1/readers/me')",'-----BEGIN PRIVATE KEY-----'])fixture(directory=>{
    fs.writeFileSync(path.join(directory,'index.html'),value);
    assert.throws(()=>verifyLandingBuild(directory),/landing preview|API access|Sensitive value/);
  });
});
test('landing gate allows presentation assets and records their digest',()=>fixture(directory=>{
  const manifest=verifyLandingBuild(directory);assert.equal(manifest.length,1);assert.match(manifest[0].sha256,/^[a-f0-9]{64}$/);
}));
test('landing gate rejects remote font stylesheets',()=>fixture(directory=>{
  fs.mkdirSync(path.join(directory,'_astro'));
  fs.writeFileSync(path.join(directory,'_astro/index.css'),'@import url(https://fonts.googleapis.com/css2?family=Lora);');
  assert.throws(()=>verifyLandingBuild(directory),/External font/);
}));
