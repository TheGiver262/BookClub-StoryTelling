import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalogWorkbook} from '../../src/server/catalog/import.ts';

import {workbook} from '../fixtures/catalog-workbook.ts';
test('Excel catalog reads inline strings, preserves copy codes and keeps borrowed/unknown copies unavailable',()=>{
  const result=parseCatalogWorkbook(workbook([
    ['Mã sách','Tên sách (gốc)','Tác giả (gốc)','Tình trạng mượn','Giá bìa'],
    ['VN001','Sách thứ nhất','Tác giả','Sẵn sàng','100000'],['VN002','Sách thứ hai','Tác giả','Đang mượn',''],['VN003','Sách thứ ba','','Chưa rõ',''],
  ]));
  assert.equal(result.rows.length,3);assert.equal(result.rows[0].copy.barcode,'VN001');assert.equal(result.rows[0].copy.status,'AVAILABLE');
  assert.equal(result.rows[0].copy.coverPrice,100000);assert.equal(result.rows[1].copy.coverPrice,null);
  assert.equal(result.rows[1].copy.status,'MAINTENANCE');assert.equal(result.rows[2].copy.status,'MAINTENANCE');assert.ok(result.rows[2].warnings.length);
});
test('Excel catalog reports duplicate codes, missing titles and invalid prices per row',()=>{
  const result=parseCatalogWorkbook(workbook([['Mã sách','Tên sách','Giá bìa'],['001','Đầu sách','-10'],['001','Đầu sách khác',''],['002','','100']]));
  assert.equal(result.rows[0].errors.length>0,true);assert.equal(result.rows[1].errors.length>0,true);assert.equal(result.rows[2].errors.length>0,true);
});

test('Excel exported with x namespace retains title, author and status',()=>{
 const result=parseCatalogWorkbook(workbook([['Mã sách','Tên sách','Tác giả','Tình trạng mượn'],['PREFIX1','Có dấu tiếng Việt','Tác giả','Sẵn sàng']],true));
 assert.equal(result.rows[0].title,'Có dấu tiếng Việt');assert.equal(result.rows[0].authors,'Tác giả');assert.equal(result.rows[0].copy.status,'AVAILABLE');
});
