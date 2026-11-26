'use client';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { saveSection, type PublicationState } from '@/app/admin/publishing-actions';
import { sections, type SectionId } from '@/lib/site-content';
import { EditorialImageField } from './EditorialImageField';
import { StatusNotice } from './StatusNotice';

export function SiteSectionForm({id,values,revision}:Readonly<{id:SectionId;values:Record<string,string>;revision:number}>) {
  const [ready,setReady]=useState(false);
  useEffect(()=>{setReady(true);},[]);
  const [version,setVersion] = useState(revision);
  const formRef = useRef<HTMLFormElement>(null);
  const [state,action,pending]=useActionState<PublicationState,FormData>(async (previous, data)=>{
    const result=await saveSection(id,previous,data);
    if(result.revision && result.values){
      setVersion(result.revision);
      setDraft(result.values);
      formRef.current?.querySelectorAll<HTMLInputElement>('input[type=file]').forEach(input=>{input.value='';});
    }
    return result;
  },{});
  const [busy,start]=useTransition();
  const [draft,setDraft]=useState(values);
  return <form className="form adminForm" ref={formRef} aria-busy={!ready||busy||pending} action={action} onSubmit={event=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    start(()=>action(data));
  }}>
    <input type="hidden" name="revision" value={version}/>
    {Object.entries(sections[id].fields).map(([key,field])=>{
      const input={name:key,defaultValue:draft[key]??'',readOnly:!ready};
      let control;
      if (['long','links','cityList'].includes(field.kind)) {
        control = <textarea {...input} rows={field.kind==='long'?3:7} required={field.kind==='cityList'}/>;
      } else if (field.kind === 'image') {
        control = <EditorialImageField key={version} name={key} value={draft[key] || field.value} label={field.label}/>;
      } else {
        control = <input {...input} type={field.kind==='email'?'email':'text'} required={!['optionalLink','optionalText'].includes(field.kind)}/>;
      }
      return <div key={key}><label>{field.label}{control}</label></div>;
    })}
    {state.error && <StatusNotice tone="error" message={state.error}/>}
    {state.success && <StatusNotice tone="success" message={state.success}/>}
    <button type="submit" className="button" disabled={!ready||pending||busy} aria-busy={pending||busy}>{pending||busy?'Guardando…':'Publicar cambios'}</button>
  </form>;
}
