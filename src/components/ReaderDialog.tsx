import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export default function ReaderDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
  useEffect(()=>{
    const element=dialog.current!,previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    element.showModal();
    return ()=>{element.close();document.body.style.overflow=overflow;if(previous?.isConnected) previous.focus();};
  },[]);
  return <dialog ref={dialog} aria-labelledby={titleId} className="reader-dialog" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
    if(event.target===event.currentTarget){const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom) onClose();}
  }}>
    <header className="reader-dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="ui-btn ui-btn-ghost reader-icon-button" aria-label="Đóng cửa sổ" onClick={onClose}><X aria-hidden="true" size={20}/></button></header>
    <div className="reader-dialog-body">{children}</div>
  </dialog>;
}
