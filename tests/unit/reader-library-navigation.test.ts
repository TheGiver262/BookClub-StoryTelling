import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookIntent,readerLocation} from '../../src/lib/reader-library-navigation.ts';
test('liên kết đặt cũ trở thành modal trong Tủ sách; token riêng không bị đưa vào OAuth next',()=>{
  assert.deepEqual(readerLocation(new URL('https://example.test/sach/?tab=dat-sach&sach=book-1')),{tab:'sach',bookId:'book-1',panel:'reserve'});
  assert.equal(readerLocation(new URL('https://example.test/sach/?tab=dat-sach#token=private')).tab,'tra-don');
  assert(!bookIntent('reserve','book-1').includes('token='));
});
test('ý định mỗi sách đi-về qua callback; query lạ không thành tab hoặc hành động',()=>{
  for(const panel of ['detail','reserve','reviews','write','bookmark'] as const){
    const parsed=readerLocation(new URL(bookIntent(panel,'a&b'), 'https://example.test'));
    assert.equal(parsed.bookId,'a&b');assert.equal(parsed.panel,panel);
  }
  assert.deepEqual(readerLocation(new URL('https://example.test/sach/?tab=admin&action=delete')),{tab:'sach',bookId:'',panel:'detail'});
});
