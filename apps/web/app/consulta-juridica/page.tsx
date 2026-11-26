import Link from 'next/link';
import { apiFetch,getCurrentUser } from '@/lib/api';
import { readSite } from '@/lib/read-site';
import { ConsultationForm } from '@/components/legal/ConsultationForm';
import { chatGptUrl } from '@/components/legal/chat-link';
import styles from '@/components/legal/legal.module.css';

export const metadata={title:'Consulta jurídica inmobiliaria'};
export default async function LegalPage() {
  const [{consultaLegal:copy},user,status]=await Promise.all([readSite(),getCurrentUser(),
    apiFetch<{available:boolean;topics:{id:string;label:string}[]}>('/consulta-ia/estado').catch(()=>({available:false,topics:[]}))]);
  return <section className="section pageTop"><div className={'container '+styles.page}><div className="pageHeading">
    <h1>{copy.title}</h1><p>{copy.intro}</p></div>
    {status.available && user ? <ConsultationForm copy={copy} topics={status.topics}/> : <p>{status.available?
      <Link className="button" href="/login">{copy.login}</Link>:copy.pending}</p>}
    <div className={styles.external}><a href={chatGptUrl} target="_blank" rel="noopener noreferrer">{copy.external} ↗</a>
    <p>{copy.externalNote}</p></div><p>{copy.review} <Link href="/contacto?servicio=juridicos">{copy.contact}</Link></p></div></section>;
}
