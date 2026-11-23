import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { editSite } from '@/lib/read-site';
import { sections, resolveCopy, type SectionId } from '@/lib/site-content';
import { SiteSectionForm } from '@/components/SiteSectionForm';
export default async function ContentPage({searchParams}:{searchParams:Promise<{seccion?:string}>}){
  await requireUser('ADMIN');
  const rows=await editSite();
  const copy=resolveCopy(rows);
  const param=(await searchParams).seccion || 'portada';
  const id:SectionId=Object.hasOwn(sections,param)?param as SectionId:'portada';
  const revision=rows.find(row=>row.id===id)?.revision??0;
  return <><div className="pageHeading compact"><h1>Contenido del sitio</h1><p>Elige una sección para editar lo que ve el visitante.</p></div>
    <div className="editorColumns"><nav className="editorMenu card" aria-label="Secciones editables">{Object.entries(sections).map(([key,s])=>
      <Link key={key} prefetch={false} href={'/admin/contenido?seccion='+key} aria-current={id===key?'page':undefined}>{s.title}</Link>)}</nav>
    <section className="card formPanel"><h2>{sections[id].title}</h2><SiteSectionForm key={id} id={id} values={copy[id]} revision={revision}/></section></div></>;
}
