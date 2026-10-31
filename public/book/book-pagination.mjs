// Measure the printed blocks before PageFlip positions the leaves.
export function paginateLeaf(leaf) {
  const page=leaf.firstElementChild.firstElementChild;
  if(!page.querySelector('.page-num'))return [leaf];
  const header=page.querySelector('.page-top'),footer=page.querySelector('.page-num');
  const atoms=[...page.children].filter(node=>node!==header&&node!==footer).flatMap(node=>
    node.matches('.text-window')?[...node.querySelector('.text-lines').children]:[node]);
  const pages=[];
  let body,current;
  function fresh(){
    current=leaf.cloneNode(false);
    const content=leaf.firstElementChild.cloneNode(false),paper=page.cloneNode(false);
    body=document.createElement('div');body.className='mobile-page-body';
    if(page.matches('.text-page'))body.classList.add('text-lines');
    if(header)paper.append(header.cloneNode(true));
    paper.append(body,footer.cloneNode(true));content.append(paper);current.append(content);
    leaf.parentElement.append(current);pages.push(current);
  }
  function fits(){
    const rect=body.getBoundingClientRect();
    return body.scrollWidth<=body.clientWidth+1&&body.scrollHeight<=body.clientHeight+1&&[...body.children].every(node=>{
      const child=node.getBoundingClientRect();return child.top>=rect.top-1&&child.bottom<=rect.bottom+1;
    })&&[...body.querySelectorAll('.photo-story figure,.activity-photos figure')].every(node=>{
      const image=node.querySelector('.story-image,.activity-image');
      return node.scrollHeight<=node.clientHeight+1&&image.getBoundingClientRect().height>0;
    });
  }
  function slice(node,start,end){
    const copy=node.cloneNode(true),walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT),texts=[];
    let text;while((text=walker.nextNode()))texts.push(text);
    function point(offset){for(const text of texts){if(offset<=text.length)return [text,offset];offset-=text.length;}return [copy,copy.childNodes.length];}
    const tail=document.createRange();tail.setStart(...point(end));tail.setEnd(copy,copy.childNodes.length);tail.deleteContents();
    if(start){const head=document.createRange();head.setStart(copy,0);head.setEnd(...point(start));head.deleteContents();}
    return copy;
  }
  function pack(node){
    body.append(node);
    if(fits())return;
    node.remove();
    const previous=body.children.length;
    if(node.matches('.photo-story,.activity-photos'))throw Error('An image group cannot fit the fixed mobile page; shorten its captions.');
    if(previous&&!node.matches("p,h2")){fresh();pack(node);return;}
    const text=node.textContent;
    if(!text.length)throw Error('A book illustration cannot fit the fixed mobile page');
    // Word boundaries first; graphemes handle a long unbroken word without corrupting Unicode.
    let ends=[...text.matchAll(/\S+\s*|\s+/gu)].map(match=>match.index+match[0].length);
    let low=0,high=ends.length;
    const probe=end=>{const part=slice(node,0,end);body.append(part);const fit=fits();part.remove();return fit;};
    while(low<high){const mid=Math.ceil((low+high)/2);if(probe(ends[mid-1]))low=mid;else high=mid-1;}
    let end=ends[low-1];
    if(!end){
      ends=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(item=>item.index+item.segment.length):[...text].reduce((all,char)=>[...all,(all.at(-1)||0)+char.length],[]);
      low=0;high=ends.length;
      while(low<high){const mid=Math.ceil((low+high)/2);if(probe(ends[mid-1]))low=mid;else high=mid-1;}
      end=ends[low-1];
    }
    if(!end&&previous){fresh();pack(node);return;}
    if(!end)throw Error('A text line cannot fit the fixed mobile page');
    body.append(slice(node,0,end));
    if(end<text.length){fresh();pack(slice(node,end,text.length));}
  }
  fresh();atoms.forEach(node=>pack(node.cloneNode(true)));
  leaf.remove();
  return pages;
}
