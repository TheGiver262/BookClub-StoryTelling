import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {DbHarness} from './db-harness.ts';
import {handleRequest} from '../../src/server/router.ts';

const h=new DbHarness(),origin='https://books.example.test';
const env={NODE_ENV:'test',RESERVATION_IP_SECRET:'quantity-test-ip-secret-long-enough-2026',TURNSTILE_SECRET_KEY:'test'};
before(async()=>{await h.resetSchema();await h.applyDDL();await h.applySeed();await h.applyMigrations();});
after(async()=>{await h.close();});
let fixtureNumber=0;
async function fixture(copies=3){
  const db=h.getPool(),n=++fixtureNumber;
  const title=(await db.query('INSERT INTO book_titles(title) VALUES($1) RETURNING id',['Quantity '+randomUUID()])).rows[0].id;
  const edition=(await db.query("INSERT INTO book_editions(title_id,publisher) VALUES($1,'Test') RETURNING id",[title])).rows[0].id;
  await db.query("INSERT INTO book_copies(edition_id,barcode,cover_price,location) SELECT $1,gen_random_uuid()::text,50000,'BAN_TRUC_TAM' FROM generate_series(1,$2::int)",[edition,copies]);
  const shift=(await db.query("INSERT INTO duty_schedules(id,term_semester,schedule_date,day_of_week,shift_time,status) VALUES(gen_random_uuid(),'2030.1','2030-01-01','THU_BA','00:00 - 23:59','PUBLISHED') RETURNING id")).rows[0].id;
  async function reader(suffix=0){
    const token=Buffer.from(randomUUID()+randomUUID()).toString('base64url').slice(0,43);
    const row=(await db.query("INSERT INTO reader_accounts(provider_subject,email,full_name,phone,session_hash,session_expires_at) VALUES($1,$2,'Quantity reader',$3,$4,NOW()+INTERVAL '1 day') RETURNING id",[randomUUID(),randomUUID()+'@example.test','0912'+String(n*10+suffix).padStart(6,'0'),createHash('sha256').update(token).digest('hex')])).rows[0];
    return {cookie:'__Host-ysbk_reader='+token,id:row.id};
  }
  const owner=await reader();
  const reserve=(quantity:unknown,key:string,account=owner,ip='192.0.2.'+(100+n))=>handleRequest(new Request(origin+'/api/v1/public/reservations',{method:'POST',headers:{Cookie:account.cookie,Origin:origin,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({titleId:title,scheduleId:shift,quantity,captchaToken:'test'})}),env,{queryable:db,clientIp:ip,now:new Date('2029-12-31T00:00:00Z'),turnstileFetch:async()=>Response.json({success:true,action:'reservation'})} as any);
  const holds=async()=> (await db.query("SELECT id,copy_id,code FROM reservations WHERE title_id=$1 AND status='HELD'",[title])).rows;
  return {title,owner,reader,reserve,holds};
}

test('quantity 2 holds two distinct copies, replays once, and a later order of the same title is separate',async()=>{
  const f=await fixture();
  const response=await f.reserve(2,'quantity-two');assert.equal(response.status,201,await response.clone().text());
  const result:any=await response.json();assert.equal(result.lookupToken,undefined);assert.equal(result.reservations.length,2);
  assert.equal(new Set(result.reservations.map((r:any)=>r.code)).size,2);
  const held=await f.holds();assert.equal(held.length,2);assert.equal(new Set(held.map(r=>r.copy_id)).size,2);
  const replay=await f.reserve(2,'quantity-two');assert.equal(replay.status,200);assert.deepEqual((await replay.json() as any).reservations,result.reservations);
  assert.equal((await f.reserve(1,'quantity-two')).status,409);
  const next=await f.reserve(1,'quantity-next');assert.equal(next.status,201);assert.notEqual((await next.json() as any).reservation.id,result.reservation.id);
  assert.equal((await f.holds()).length,3);
  const list=await handleRequest(new Request(origin+'/api/v1/readers/reservations',{headers:{Cookie:f.owner.cookie}}),env,{queryable:h.getPool()});
  assert.equal((await list.json() as any).data.length,3);
  const books=await handleRequest(new Request(origin+'/api/v1/public/reservation-books?includeUnavailable=true&search='+f.title),env,{queryable:h.getPool()});
  assert.equal((await books.json() as any).data[0].availableCopiesCount,0);
});

test('insufficient copies and remaining quota both roll back the whole quantity',async()=>{
  const scarce=await fixture(1);assert.equal((await scarce.reserve(2,'scarce-two')).status,409);assert.equal((await scarce.holds()).length,0);
  assert.equal((await scarce.reserve(1,'scarce-two')).status,201);
  const quota=await fixture(4);assert.equal((await quota.reserve(2,'quota-first')).status,201);
  assert.equal((await quota.reserve(2,'quota-too-many')).status,429);assert.equal((await quota.holds()).length,2);
});

test('concurrent quantity requests cannot partially reserve or oversell three copies',async()=>{
  const f=await fixture(),other=await f.reader(1);
  const results=await Promise.all([f.reserve(2,'concurrent-a'),f.reserve(2,'concurrent-b',other,'192.0.2.240')]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await f.holds()).length,2);
});

test('quantity rejects zero, fractions, strings and values beyond the existing three-slot limit',async()=>{
  const f=await fixture();for(const quantity of [0,-1,1.5,'2',4,null]) assert.equal((await f.reserve(quantity,'invalid-'+quantity)).status,400);
  assert.equal((await f.holds()).length,0);
});
