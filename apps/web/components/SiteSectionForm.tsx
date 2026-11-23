'use client';
import { useActionState, useRef, useState, useTransition } from 'react';
import { saveSection, type PublicationState } from '@/app/admin/publishing-actions';
import { sections, type SectionId } from '@/lib/site-content';
import { StatusNotice } from './StatusNotice';

export function SiteSectionForm({id,values,revision}:{id:SectionId;values:Record<string,string>;revision:number}) {
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
  return <form className="form adminForm" ref={formRef} onSubmit={event=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    start(()=>action(data));
  }}>
    <input type="hidden" name="revision" value={version}/>
    {Object.entries(sections[id].fields).map(([key,field])=>{
      const input={name:key,value:draft[key]??'',onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>setDraft({...draft,[key]:e.target.value})};
      return <div key={key}><label>{field.label}
        {['long','links'].includes(field.kind)?<textarea {...input} rows={field.kind==='links'?7:3} />:
         field.kind==='image'?<><img className="editorPreview" src={draft[key]} alt="Imagen publicada"/><input type="hidden" name={key} value={draft[key]}/><input type="file" name={'photo-'+key} accept="image/jpeg,image/png,image/webp"/></>:
         <input {...input} type={field.kind==='email'?'email':'text'} required={!['optionalLink','optionalText'].includes(field.kind)} />}
      </label></div>;
    })}
    {state.error && <StatusNotice tone="error" message={state.error}/>}
    {state.success && <StatusNotice tone="success" message={state.success}/>}
    <button className="button" disabled={pending||busy} aria-busy={pending||busy}>{pending||busy?'Guardando…':'Publicar cambios'}</button>
  </form>;
}
