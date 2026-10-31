import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const modules=new Set(['book.mjs','book-backdrop.mjs','book-content.mjs','book-music.mjs','book-timeline.mjs','book-scroll.mjs','page-curl.mjs','book-interaction.mjs','book-single.mjs','book-pagination.mjs']);
const hash=value=>createHash('sha256').update(value).digest('hex');
function files(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    if(fs.lstatSync(file).isSymbolicLink())throw Error('Landing output must not contain symlinks.');
    return entry.isDirectory()?files(file):[file];
  });
}
export function versionLandingAssets(directory){
  // CSS is versioned after media URLs change, so immutable CSS never points at stale assets.
  for(const relative of ['book/assets','_astro']){
    const assets=path.join(directory,relative);
    if(!fs.existsSync(assets))continue;
    const names=fs.readdirSync(assets).map(name=>{
      const ext=path.extname(name);
      const versioned=`${name.slice(0,-ext.length)}.${hash(fs.readFileSync(path.join(assets,name))).slice(0,16)}${ext}`;
      fs.renameSync(path.join(assets,name),path.join(assets,versioned));
      return [name,versioned];
    });
    for(const file of files(directory))if(/\.(?:html|css|mjs)$/.test(file)){
      let text=fs.readFileSync(file,'utf8');
      for(const [name,versioned]of names)text=text.replaceAll(name,versioned);
      fs.writeFileSync(file,text);
    }
  }
}

export function applyBasePath(directory, basePath){
  if(!basePath || basePath === '/') return;
  const normalized = basePath.endsWith('/') ? basePath : basePath + '/';
  for(const file of files(directory))if(/\.(?:html|css|mjs)$/.test(file)){
    let text=fs.readFileSync(file,'utf8');
    text=text.replaceAll('"/book/', `"${normalized}book/`);
    text=text.replaceAll("'/book/", `'${normalized}book/`);
    text=text.replaceAll("url(/book/", `url(${normalized}book/`);
    text=text.replaceAll("url('/book/", `url('${normalized}book/`);
    text=text.replaceAll('url("/book/', `url("${normalized}book/`);
    text=text.replaceAll('href="/book/', `href="${normalized}book/`);
    text=text.replaceAll('src="/book/', `src="${normalized}book/`);
    fs.writeFileSync(file,text);
  }
}

export function verifyLandingBuild(directory){
  const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
  if(/<a\b[^>]*href=["']\/(?:sach|login|noi-bo|cong-dong)(?:\/|[?"'])/.test(html))throw Error('Active application link in landing preview.');
  if(/<form\b|blockNavigation|window\.location\.replace/i.test(html))throw Error('Application navigation or form in landing preview.');
  const secrets=[];
  for(const [name,read] of [
    ['.local/ysbk/google-oauth-client.json',value=>[value.web?.client_secret]],
    ['.local/ysbk/settings.json',value=>Object.entries(value).filter(([key])=>/password|secret/i.test(key)).map(([,value])=>value)],
  ]){
    const file=path.join(root,name);
    if(fs.existsSync(file))secrets.push(...read(JSON.parse(fs.readFileSync(file,'utf8'))).filter(value=>typeof value==='string'&&value.length>=8));
  }
  return files(directory).map(file=>{
    const name=path.relative(directory,file).replaceAll('\\','/');
    const allowed=['index.html','_headers','.nojekyll'].includes(name)||/^_astro\/[^/]+\.css$/.test(name)
      ||name.startsWith('book/')&&modules.has(name.slice(5))||name.startsWith('book/vendor/')
      ||/^book\/assets\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp|svg|ttf|woff2|mp3|txt)$/.test(name);
    if(!allowed)throw Error('Unexpected file in landing output: '+name);
    const bytes=fs.readFileSync(file),text=bytes.toString('utf8');
    if(name.endsWith('.css')&&/fonts\.(?:googleapis|gstatic)\.com/.test(text))throw Error('External font in landing output: '+name);
    if(secrets.some(secret=>bytes.includes(Buffer.from(secret)))||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/|(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{15,}|apps\.googleusercontent\.com/.test(text))throw Error('Sensitive value in landing output: '+name);
    if(/\.(?:mjs|css|html)$/.test(name)&&/InternalWorkspace|PublicPortal|ReaderWorkspace|\/api\/v1|DATABASE_URL|JWT_SECRET|SUPABASE_(?:URL|KEY)|\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(text))throw Error('Application code or API access in landing output: '+name);
    return {path:name,size:bytes.length,sha256:hash(bytes)};
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  process.env.PUBLIC_LANDING_ONLY='true';
  const {syncPublicBookContent}=await import('../src/content/ysbk-story.mjs');
  syncPublicBookContent();
  const {build}=await import('astro');
  const {default:tailwind}=await import('@astrojs/tailwind');
  const output=path.join(root,'dist-landing');
  const basePath = process.env.BASE_PATH || '';
  await build({configFile:false,root,srcDir:'./landing',outDir:output,publicDir:'./landing/public',integrations:[tailwind({applyBaseStyles:true})],base:basePath||undefined,vite:{build:{sourcemap:false}}});
  fs.cpSync(path.join(root,'public/book'),path.join(output,'book'),{recursive:true});
  versionLandingAssets(output);
  if(basePath) applyBasePath(output, basePath);
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
  const scriptHashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match=>! /\bsrc\s*=/.test(match[1])).map(match=>"'sha256-"+createHash('sha256').update(match[2]).digest('base64')+"'");
  const policy="default-src 'self'; script-src 'self' "+[...new Set(scriptHashes)].join(' ')+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'";
  fs.writeFileSync(path.join(output,'_headers'),`/*\n  Content-Security-Policy: ${policy}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: public, max-age=0, must-revalidate\n/book/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
  const manifest=verifyLandingBuild(output);
  fs.mkdirSync(path.join(root,'.review-artifacts'),{recursive:true});
  fs.writeFileSync(path.join(root,'.review-artifacts/landing-security-manifest.json'),JSON.stringify({timestamp:new Date().toISOString(),files:manifest},null,2));
  console.log(`Landing security gate passed: ${manifest.length} presentation files; no application routes, bundles, API code or detected secrets.`);
}
