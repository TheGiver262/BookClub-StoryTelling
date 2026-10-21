import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {readerLocation,bookIntent} from '../../src/lib/reader-library-navigation.ts';

const source=fs.readFileSync('src/components/PublicPortal.tsx','utf8');
const ast=ts.createSourceFile('PublicPortal.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const methods=new Map<string,string>();
let navigationEffect='';
function visit(node:ts.Node){
  if(ts.isFunctionDeclaration(node)&&node.name&&['openPanel','closePanel','switchTab','openReviewBook'].includes(node.name.getText(ast))) methods.set(node.name.getText(ast),node.getText(ast));
  if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes("window.addEventListener('popstate',sync)")) navigationEffect=node.arguments[0].getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(navigationEffect&&methods.size===4,'Exercise the real navigation effect and handlers');
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

function harness(){
  const pending=new Map<string,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  const listeners=new Map<string,()=>Promise<void>>();
  const state:Record<string,any>={
    sessionLoading:false,reader:{id:'reader-1'},locationInitialized:{current:true},
    reviewSessionRef:{current:0},bookLookupRef:{current:0},focusedBookRef:{current:null},panelRef:{current:null},
    panel:null,focusedBook:null,activeTab:'sach',bookReviews:[],reviewsError:'',bookError:'',publicError:'',reviewPage:1,
    requireReader:()=>true,bookIntent,readerLocation,URL,
  };
  state.window={
    location:{href:'http://localhost/sach/'},
    history:{
      pushState(_a:any,_b:any,path:string){state.window.location.href=new URL(path,state.window.location.href).href;},
      replaceState(_a:any,_b:any,path:string){state.window.location.href=new URL(path,state.window.location.href).href;},
    },
    addEventListener:(name:string,handler:()=>Promise<void>)=>listeners.set(name,handler),
    removeEventListener:(name:string)=>listeners.delete(name),
  };
  for(const field of ['activeTab','panel','focusedBook','reviewSubmitted','reviewsError','reviewPage','bookReviews','reviewContent','reviewRating','publicError','bookError']){
    state[`set${field[0].toUpperCase()}${field.slice(1)}`]=(value:any)=>{
      state[field]=typeof value==='function'?value(state[field]):value;
      if(field==='panel')state.panelRef.current=state[field];
      if(field==='focusedBook')state.focusedBookRef.current=state[field];
    };
  }
  state.apiClient={listPublicReservationBooks:({search}:{search:string})=>new Promise((resolve,reject)=>pending.set(search,{resolve,reject}))};
  vm.createContext(state);
  for(const method of methods.values())vm.runInContext(compile(method),state);
  const cleanup=vm.runInContext(compile(`(${navigationEffect})`),state)();
  return {
    state,cleanup,
    pop(id:string){state.window.location.href=`http://localhost/sach/?tab=sach&sach=${id}&action=reviews`;return listeners.get('popstate')!();},
    resolve(id:string,found=true){pending.get(id)!.resolve({items:found?[{titleId:id,title:`Title ${id}`}]:[]});},
    reject(id:string){pending.get(id)!.reject(new Error(`lookup ${id} failed`));},
  };
}

test('Back A then Forward B keeps B when lookup responses arrive in either order',async()=>{
  for(const order of [['A','B'],['B','A']]){
    const h=harness();const requests={A:h.pop('A'),B:h.pop('B')};
    for(const id of order){h.resolve(id);await requests[id as 'A'|'B'];}
    assert.equal(h.state.focusedBook.titleId,'B');
    assert.equal(h.state.panel,'reviews');
    assert.equal(h.state.activeTab,'sach');
    assert.equal(new URL(h.state.window.location.href).searchParams.get('sach'),'B');
    h.cleanup();
  }
});

test('opening and closing B invalidates a pending URL lookup A, including errors',async()=>{
  for(const reject of [false,true]){
    const h=harness();const request=h.pop('A');
    h.state.openPanel({titleId:'B',title:'Title B'},'detail');h.state.closePanel();
    if(reject)h.reject('A');else h.resolve('A');
    await request;
    assert.equal(h.state.focusedBook.titleId,'B');
    assert.equal(h.state.panel,null);
    assert.equal(h.state.bookError,'');
    assert.equal(new URL(h.state.window.location.href).searchParams.get('sach'),null);
    h.cleanup();
  }
});

test('leaving community review cancels its pending book lookup without changing the new tab or errors',async()=>{
  for(const reject of [false,true]){
    const h=harness();h.state.activeTab='review';
    const request=h.state.openReviewBook('A');h.state.switchTab('hoat-dong');
    if(reject)h.reject('A');else h.resolve('A');
    await request;
    assert.equal(h.state.activeTab,'hoat-dong');assert.equal(h.state.panel,null);
    assert.equal(new URL(h.state.window.location.href).searchParams.get('tab'),'hoat-dong');
    assert.equal(h.state.publicError,'');h.cleanup();
  }
});

test('a newer community lookup wins over old results or errors in either response order',async()=>{
  for(const reject of [false,true])for(const oldFirst of [false,true]){
    const h=harness();const old=h.state.openReviewBook('A'),current=h.state.openReviewBook('B');
    if(oldFirst){
      if(reject)h.reject('A');else h.resolve('A');await old;
      assert.equal(h.state.panel,null);assert.equal(h.state.publicError,'');
    }
    h.resolve('B');await current;
    if(!oldFirst){if(reject)h.reject('A');else h.resolve('A');await old;}
    assert.equal(h.state.focusedBook.titleId,'B');assert.equal(h.state.publicError,'');
    assert.equal(new URL(h.state.window.location.href).searchParams.get('sach'),'B');h.cleanup();
  }
});

test('sign-in required navigation also cancels an old lookup before requesting the account',async()=>{
  const h=harness();h.state.activeTab='review';const request=h.state.openReviewBook('A');
  h.state.requireReader=()=>false;h.state.switchTab('tra-don');h.resolve('A');await request;
  assert.equal(h.state.activeTab,'review');assert.equal(h.state.panel,null);h.cleanup();
});

test('current lookups remain valid when the previous review session is cleaned up',async()=>{
  for(const route of [true,false]){
    const h=harness();const request=route?h.pop('A'):h.state.openReviewBook('A');
    h.state.reviewSessionRef.current++;
    h.resolve('A');await request;
    assert.equal(h.state.focusedBook.titleId,'A');assert.equal(h.state.panel,'reviews');h.cleanup();
  }
});

test('current lookup failures remain visible; unmounted lookup results cannot open a modal or set errors',async()=>{
  for(const route of [true,false]){
    const h=harness();const current=route?h.pop('A'):h.state.openReviewBook('A');h.reject('A');await current;
    assert.match(route?h.state.bookError:h.state.publicError,/lookup A failed/);
    h.cleanup();
    for(const reject of [false,true]){
      const gone=harness();const request=route?gone.pop('A'):gone.state.openReviewBook('A');gone.cleanup();
      if(reject)gone.reject('A');else gone.resolve('A');await request;
      assert.equal(gone.state.panel,null);assert.equal(gone.state.bookError,'');assert.equal(gone.state.publicError,'');
    }
  }
});
