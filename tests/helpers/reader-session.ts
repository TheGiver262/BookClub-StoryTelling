import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const token='r'.repeat(43);
export const readerHeaders={Cookie:`ysbk_reader=${token}; __Host-ysbk_reader=${token}`};
export function withReaderSession(db:{query:(...args:any[])=>Promise<any>}){
  return {query:async(sql:string,params?:any[])=>{
    if(sql.startsWith('SELECT id,email,full_name,phone FROM reader_accounts')){
      assert.equal(params?.[0],createHash('sha256').update(token).digest('hex'));
      return {rows:[{id:'00000000-0000-0000-0000-000000000777',email:'reader@example.test',full_name:'Nguyen Van A',phone:'0912345678'}]};
    }
    return db.query(sql,params);
  }};
}
