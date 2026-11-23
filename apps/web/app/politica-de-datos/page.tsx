import { keyedParagraphs } from '@/lib/paragraphs';
import { redirect } from 'next/navigation';
import { readSite } from '@/lib/read-site';
export default async function DataPolicyPage() {
  const {contacto}=await readSite();
  if(contacto.policyHref && contacto.policyHref!=='/politica-de-datos') redirect(contacto.policyHref);
  const paragraphs=contacto.policyText.split(/\r?\n\s*\r?\n/).filter(Boolean);
  return <section className="section pageTop"><article className="container newsArticle policyArticle"><h1>{contacto.policyLabel}</h1>
    {paragraphs.length ? keyedParagraphs(paragraphs).map(({text:part,key})=>part.startsWith('## ')?<h2 key={key}>{part.slice(3)}</h2>:<p className="formattedCopy" key={key}>{part}</p>) :
    <p>La inmobiliaria aún no ha publicado su política de tratamiento de datos.</p>}
  </article></section>;
}
