import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {getReservationIntent,clearReservationIntent} from '../../src/lib/reservation-intent.ts';

const source=fs.readFileSync('src/components/ReservationSection.tsx','utf8');
const ast=ts.createSourceFile('ReservationSection.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler='';
function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='handleSubmitReservation') handler=node.getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(handler,'Exercise the real submit handler');

function harness(){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  const memory=new Map<string,string>();
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
    getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key),
  }});
  const keys:string[]=[],payloads:any[]=[],orders=new Map<string,any>();
  let fail=false;
  const state:any={
    selectedBookId:'book-one',selectedBook:{titleId:'book-one',availableCopiesCount:3},selectedScheduleId:'shift-one',schedules:[{id:'shift-one'}],
    fullName:'Synthetic Reader',phone:'0912345678',studentId:'',email:'reader@example.test',reader:{id:'reader-one'},quantity:2,
    depositConfirmed:true,captchaToken:'captcha',submitInFlightRef:{current:false},getReservationIntent,clearReservationIntent,
    window:{dispatchEvent:()=>{}},Event,resetCaptchaWidget:()=>{},loadMetadata:async()=>{},
  };
  for(const field of ['submitError','isSubmitting','createdReservation']) state['set'+field[0].toUpperCase()+field.slice(1)]=(value:any)=>{state[field]=value;};
  state.apiClient={
    updateReaderProfile:async()=>{},
    createPublicReservation:async(payload:any,key:string)=>{
      keys.push(key);payloads.push(payload);
      if(!orders.has(key)){const reservation={id:'order-'+orders.size,code:'CODE-'+orders.size};orders.set(key,{reservation,reservations:[reservation]});}
      if(fail){fail=false;throw new Error('Response lost after server commit');}
      return orders.get(key);
    },
  };
  vm.createContext(state);
  vm.runInContext(ts.transpileModule('var '+handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,state);
  return {state,keys,payloads,orders,failNext:()=>{fail=true;},submit:()=>state.handleSubmitReservation({preventDefault(){}}),cleanup(){
    if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);else delete (globalThis as any).sessionStorage;
  }};
}

test('confirmed booking releases its key so the same title can be booked again, including after remount',async()=>{
  const h=harness();try{
    await h.submit();await h.submit();
    assert.equal(h.orders.size,2);assert.notEqual(h.keys[0],h.keys[1]);assert.equal(h.payloads[0].quantity,2);
  }finally{h.cleanup();}
});

test('lost booking response keeps its key; retry recovers the existing orders',async()=>{
  const h=harness();try{
    h.failNext();await h.submit();assert.ok(h.state.submitError);
    await h.submit();assert.equal(h.orders.size,1);assert.equal(h.keys[0],h.keys[1]);assert.ok(h.state.createdReservation);
  }finally{h.cleanup();}
});

test('two immediate submit events send only one booking request',async()=>{
  const h=harness();try{
    await Promise.all([h.submit(),h.submit()]);assert.equal(h.keys.length,1);
  }finally{h.cleanup();}
});

test('finishing an older request does not erase a newer intent',async()=>{
  const h=harness();try{
    const old=await getReservationIntent({title:'old'}),current=await getReservationIntent({title:'new'});
    clearReservationIntent(old);assert.equal(await getReservationIntent({title:'new'}),current);
    clearReservationIntent(current);assert.notEqual(await getReservationIntent({title:'new'}),current);
  }finally{h.cleanup();}
});
