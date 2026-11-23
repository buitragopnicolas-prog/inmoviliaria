'use client';
import { useActionState } from 'react';
import { sendSuggestion } from '@/app/document-actions';
import { ConsentField, usePublishedPolicy } from './ConsentField';
import { StatusNotice } from './StatusNotice';

export function SuggestionForm(){
  const policy=usePublishedPolicy();
  const [state,action,pending]=useActionState(sendSuggestion,{message:'',success:'',error:''});
  return <form className="form card formPanel" action={action}>
    <label>Tu sugerencia<textarea name="message" rows={6} required minLength={10} maxLength={4000} defaultValue={state.message}/></label>
    <ConsentField purpose="recibir y gestionar mi sugerencia"/>
    <button type="submit" className="button" disabled={pending || !policy.version}>{pending?'Enviando…':'Enviar sugerencia'}</button>
    {state.error&&<StatusNotice tone="error" message={state.error}/>}
    {state.success&&<StatusNotice tone="success" message={state.success}/>}
  </form>;
}
