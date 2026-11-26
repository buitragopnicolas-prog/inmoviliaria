'use client';

import { useActionState, useState } from 'react';
import { askLegal, type Consultation } from '@/app/consulta-juridica/actions';
import { ConsentField,usePublishedPolicy } from '../ConsentField';
import { StatusNotice } from '../StatusNotice';
import type { SiteCopy } from '@/lib/site-content';
import styles from './legal.module.css';

export function ConsultationForm({copy,topics}:Readonly<{copy:SiteCopy['consultaLegal'];topics:{id:string;label:string}[]}>) {
  const [state,action,pending]=useActionState<Consultation,FormData>(askLegal,{});
  const [question,setQuestion]=useState('');
  const policy=usePublishedPolicy();
  return <><form className="form" action={action}><label>Consultar un tema de ejemplo<select name="topic">{topics.map(topic=><option value={topic.id} key={topic.id}>{topic.label}</option>)}</select></label>
    <button className="button outline" disabled={pending}>Consultar ejemplo</button></form>
    {policy.version && <form className="form" action={action}>
    <label>{copy.question}<textarea name="question" rows={4} minLength={12} maxLength={1800} required value={question}
      onChange={e=>setQuestion(e.target.value)} readOnly={pending} placeholder={copy.example}/></label>
    <p>{copy.privacy}</p><ConsentField purpose="procesar mi consulta a través de OpenAI"/>
    <button className="button" disabled={pending || !policy.version} aria-busy={pending}>{pending?'Consultando fuentes oficiales…':copy.submit}</button>
  </form>}{!policy.version && <p>Las preguntas libres se habilitan cuando la inmobiliaria publica su política de datos.</p>}
  {pending && <StatusNotice message="Consultando fuentes oficiales…"/>}{state.error && !pending && <StatusNotice tone="error" message={state.error}/>}
  {state.result && !pending && <section className={styles.answer} aria-label="Respuesta de la IA"><h2>Orientación</h2>
    <p>{state.result.answer}</p><h3>Fuentes consultadas</h3><ul>{state.result.sources.map(link=><li key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title} ↗</a></li>)}</ul></section>}</>;
}
