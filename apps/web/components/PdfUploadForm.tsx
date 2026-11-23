'use client';
import { useState, useTransition } from 'react';
import { uploadDocument } from '@/app/document-actions';
import type { ActionState } from '@/app/actions';
import { StatusNotice } from './StatusNotice';

export function PdfUploadForm({kind,id,label,service=false}: {kind:'account'|'template'; id:string; label:string; service?:boolean}) {
  const [state,setState] = useState<ActionState>({});
  const [pending,start] = useTransition();
  return <form className="form" onSubmit={event=>{
    event.preventDefault();
    if (pending) return;
    const form=event.currentTarget;
    const data=new FormData(form);
    start(async()=>{
      const result=await uploadDocument(kind,id,{},data);
      setState(result);
      if(result.success) form.reset();
    });
  }}>
    {service && <label>Tipo de servicio contratado<input name="serviceType" required maxLength={150} placeholder="Ej. Asesoría tributaria"/></label>}
    <label>{label}<input type="file" name="file" accept="application/pdf,.pdf" required disabled={pending}/></label>
    <small className="hint">PDF de hasta 8 MB</small>
    <button className="button small" disabled={pending} aria-busy={pending}>{pending?'Comprobando PDF…':kind==='template'?'Publicar formato':'Asignar PDF'}</button>
    {state.error && <StatusNotice tone="error" message={state.error}/>}
    {state.success && <StatusNotice tone="success" message={state.success}/>}
  </form>;
}
