'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { createNewsAction, type ActionState } from '@/app/actions';
import type { NewsPost } from '@/lib/types';
import categories from '../../../shared/bulletin-categories.json';
import { StatusNotice } from './StatusNotice';

export function AdminNewsForm({post}:Readonly<{post?: NewsPost}>) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous,data)=>{
    const result=await createNewsAction(previous,data);
    if(result.success) {
      form.current?.querySelectorAll<HTMLInputElement>('input[type=file]').forEach(input=>{input.value='';});
      if(!post){ form.current?.reset(); setContent(''); }
    }
    return result;
  }, {});
  const [content, setContent] = useState(post?.content ?? '');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  return <form ref={form} className="form adminForm card" onSubmit={e=>{
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    start(()=>action(data));
  }}>
    <h2>{post ? 'Editar artículo' : 'Escribir artículo'}</h2>
    <input name="id" type="hidden" value={post?.id??''} />
    <label>Título<input name="title" required minLength={5} maxLength={140} defaultValue={post?.title}/></label>
    <label>Tipo de publicación<select name="category" defaultValue={post?.category??categories[0]}>{categories.map(label=><option key={label}>{label}</option>)}</select></label>
    <label>Resumen · hasta 8.000 caracteres<textarea name="summary" rows={3} required minLength={20} maxLength={8000} defaultValue={post?.summary}/></label>
    <label>Cargar texto desde un archivo (.txt o .md)<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={async e=>{
      const file=e.currentTarget.files?.[0]; if(!file)return;
      try {
        if(file.size>200000 || !/\.(txt|md)$/i.test(file.name)) throw new Error('Selecciona un archivo de texto válido de hasta 200 KB.');
        const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
        if(text.length>50000 || text.includes('\u0000')) throw new Error('El texto no se puede importar.');
        setContent(text); setError('');
      } catch { setError('Selecciona un archivo de texto UTF-8 de hasta 50.000 caracteres.'); }
    }}/></label>
    <label>Contenido adicional (opcional)<textarea name="content" rows={10} maxLength={50000} value={content} onChange={e=>setContent(e.target.value)}/></label>
    <label>Adjuntar PDF<input type="file" multiple name="pdfs" accept="application/pdf,.pdf"/><small>Hasta tres PDF de 8 MB por envío.</small></label>
    {post?.attachments?.map(pdf=><div key={pdf.id}><a href={'/documentos/privados/'+pdf.id} target="_blank" rel="noopener">{pdf.originalName}</a><label><input type="checkbox" name="removePdfIds" value={pdf.id}/>Retirar este adjunto</label></div>)}
    <label>Fuente (opcional)<input name="sourceLabel" maxLength={80} defaultValue={post?.sourceLabel??''}/></label>
    <label>Enlace de prensa (opcional)<input name="externalUrl" type="url" defaultValue={post?.externalUrl??''}/></label>
    <label>Otras fuentes · un enlace por línea<textarea name="additionalLinks" rows={3} defaultValue={post?.additionalLinks?.join('\n')??''}/></label>
    <label>Visibilidad<select name="visibility" defaultValue={post?.published===false?'draft':'public'}><option value="public">Publicado</option><option value="draft">Borrador</option></select></label>
    {(error||state.error)&&<StatusNotice tone="error" message={error||state.error!}/>}
    {state.success&&<StatusNotice tone="success" message={state.success}/>}
    <button type="submit" className="button" disabled={pending||busy}>{pending||busy?'Guardando…':'Guardar artículo'}</button>
  </form>;
}
