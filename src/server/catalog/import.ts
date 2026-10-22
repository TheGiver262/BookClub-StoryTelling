import {Buffer} from 'node:buffer';
import {BadRequestError} from '../errors.ts';
import {unpackXlsxZip,extractSharedStrings,MAX_FILE_BYTES} from '../duty/availability-parser.ts';

export interface DraftCopy {barcode:string;coverPrice:number|null;status:'AVAILABLE'|'MAINTENANCE';note?:string;}
export interface CatalogImportRow {rowNumber:number;title:string;authors:string;categories:string;publisher:string;description:string;copy:DraftCopy;errors:string[];warnings:string[];}
export const normalizedCatalogText=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('vi').replace(/\s+/g,' ');
const stripNamespaces=(xml:string)=>xml.replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1');
const xmlText=(value:string)=>value.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&amp;','&');
const attribute=(text:string,name:string)=>xmlText(new RegExp('\\b'+name+'="([^"]*)"').exec(text)?.[1]||'');
function grid(buffer:Buffer,strings:string[]){
  const xml=stripNamespaces(buffer.toString('utf8'));
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new BadRequestError('Không nhận XML có khai báo thực thể.','INVALID_XLSX');
  const rows:{number:number;cells:string[]}[]=[];
  for(const match of xml.matchAll(/<row\b([^>]*)>(.*?)<\/row>/gs)){
    if(rows.length>=2500)throw new BadRequestError('Mỗi file tối đa 2.500 dòng.','IMPORT_ROW_LIMIT');
    const cells:string[]=[];
    for(const cell of match[2].matchAll(/<c\b([^>]*)>(.*?)<\/c>/gs)){
      const reference=attribute(cell[1],'r'),letters=/^[A-Z]+/.exec(reference)?.[0];if(!letters)continue;
      let index=0;for(const letter of letters)index=index*26+letter.charCodeAt(0)-64;if(index>100)throw new BadRequestError('Sheet có quá nhiều cột.','IMPORT_COLUMN_LIMIT');
      const raw=/<v\b[^>]*>(.*?)<\/v>/s.exec(cell[2])?.[1]||'';
      cells[index-1]=/<f\b/.test(cell[2])?'=FORMULA':attribute(cell[1],'t')==='s'?strings[Number(raw)]||'':attribute(cell[1],'t')==='inlineStr'?Array.from(cell[2].matchAll(/<t\b[^>]*>(.*?)<\/t>/gs),m=>xmlText(m[1])).join(''):xmlText(raw);
    }
    rows.push({number:Number(attribute(match[1],'r'))||rows.length+1,cells});
  }
  return rows;
}
export function parseCatalogWorkbook(buffer:Buffer):{sheet:string;rows:CatalogImportRow[]}{
  if(buffer.length>MAX_FILE_BYTES)throw new BadRequestError('Chọn file Excel dưới 5 MB.','FILE_TOO_LARGE');
  const files=unpackXlsxZip(buffer),workbook=stripNamespaces(files.get('xl/workbook.xml')?.toString('utf8')||''),relations=files.get('xl/_rels/workbook.xml.rels')?.toString('utf8')||'';
  const strings=files.has('xl/sharedStrings.xml')?extractSharedStrings(Buffer.from(stripNamespaces(files.get('xl/sharedStrings.xml')!.toString('utf8')))):[];
  const sheets=Array.from(workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g),m=>({name:attribute(m[1],'name'),id:attribute(m[1],'r:id')}));
  sheets.sort((a,b)=>Number(normalizedCatalogText(b.name)==='danh mục gộp')-Number(normalizedCatalogText(a.name)==='danh mục gộp'));
  for(const sheet of sheets){
    const rel=Array.from(relations.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)).find(m=>attribute(m[1],'Id')===sheet.id);if(!rel)continue;
    const target=attribute(rel[1],'Target'),part=target.startsWith('/')?target.slice(1):'xl/'+target;
    if(!/^xl\/worksheets\/[^/]+\.xml$/.test(part)||!files.has(part))continue;
    const rows=grid(files.get(part)!,strings);
    const headerIndex=rows.findIndex((row,index)=>index<20&&row.cells.some(c=>/^tên sách/.test(normalizedCatalogText(c||'')))&&row.cells.some(c=>['mã sách','mã bản sách','barcode'].includes(normalizedCatalogText(c||''))));
    if(headerIndex<0)continue;
    const headers=rows[headerIndex].cells.map(c=>normalizedCatalogText(c||''));
    const find=(patterns:RegExp[])=>headers.findIndex(c=>patterns.some(pattern=>pattern.test(c)));
    const columns={barcode:find([/^mã (bản )?sách$/, /^barcode$/]),title:find([/^tên sách/]),authors:find([/^tác giả/]),categories:find([/^thể loại/]),publisher:find([/^nhà xuất bản$/, /^nxb$/]),price:find([/^giá bìa/, /^giá sách/]),status:find([/^tình trạng/]),description:find([/^tóm tắt/,/^giới thiệu/,/^nhận xét.*xác minh/]),check:find([/^cần kiểm tra/])};
    const seen=new Set<string>(),result:CatalogImportRow[]=[];
    for(const row of rows.slice(headerIndex+1)){
      const get=(key:keyof typeof columns)=>(row.cells[columns[key]]||'').trim();if(!get('barcode')&&!get('title'))continue;
      const errors:string[]=[],warnings:string[]=[],barcode=get('barcode'),title=get('title'),status=get('status'),rawPrice=get('price');
      if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/.test(barcode))errors.push('Mã sách phải có 1–50 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.');
      if(seen.has(barcode))errors.push('Mã sách bị trùng trong file.');seen.add(barcode);
      if(!title||title.length>255||title==='=FORMULA')errors.push('Thiếu tên sách hợp lệ hoặc tên dài quá 255 ký tự.');
      if(Object.keys(columns).some(key=>get(key as keyof typeof columns)==='=FORMULA'))errors.push('Các cột nhập liệu phải là giá trị, không dùng công thức.');
      for(const [key,max] of [['authors',1000],['categories',500],['publisher',255],['description',6000]] as const)if(get(key).length>max)errors.push(`Cột ${key} dài quá ${max} ký tự.`);
      const price=rawPrice===''?null:Number(rawPrice.replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(/\s|₫|đ/gi,''));
      if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>100000000))errors.push('Giá bìa phải là số nguyên từ 0 đến 100.000.000 đồng.');
      const available=['sẵn sàng','còn','available'].includes(normalizedCatalogText(status));
      if(!available)warnings.push('Chưa cho đặt: '+(status||'chưa rõ tình trạng')+'. Cần đối chiếu kho trước khi mở đặt.');
      if(!get('authors'))warnings.push('Chưa có tác giả.');if(price===null)warnings.push('Chưa có giá bìa.');if(get('check'))warnings.push(get('check'));
      result.push({rowNumber:row.number,title,authors:get('authors'),categories:get('categories'),publisher:get('publisher'),description:get('description'),copy:{barcode,coverPrice:price,status:available?'AVAILABLE':'MAINTENANCE',note:available?'':'Nhập Excel: '+(status||'chưa rõ')},errors,warnings});
    }
    if(!result.length)throw new BadRequestError('Sheet danh mục không có sách.','EMPTY_CATALOG');
    return {sheet:sheet.name,rows:result};
  }
  throw new BadRequestError('Không tìm thấy sheet có cột Mã sách và Tên sách.','CATALOG_HEADERS_MISSING');
}
