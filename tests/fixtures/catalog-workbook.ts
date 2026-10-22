import {Buffer} from 'node:buffer';
export function workbook(rows:string[][],namespaced=false){
  const xml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const sheet='<worksheet><sheetData>'+rows.map((row,i)=>`<row r="${i+1}">`+row.map((cell,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>';
  const files=[['xl/workbook.xml','<workbook><sheets><sheet name="DANH MỤC GỘP" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',sheet]];
  if(namespaced)for(const file of files)file[1]=file[1].replace(/(<\/?)(?!Relationship)([A-Za-z]+)/g,'$1x:$2');
  return Buffer.concat(files.map(([name,text])=>{const data=Buffer.from(text),filename=Buffer.from(name),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);return Buffer.concat([header,filename,data]);}));
}
