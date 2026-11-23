import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Reveal } from '@/components/Reveal';
import { StatusNotice } from '@/components/StatusNotice';
import { OwnerListingForm, type OwnerListing } from '@/components/OwnerListingForm';
export default async function Publications({searchParams}:{searchParams:Promise<{editar?:string;nuevo?:string;guardado?:string}>}) {
  const user=await requireUser('USER');
  if(user.portal!=='OWNER') redirect('/propietarios');
  const [rows,params]=await Promise.all([apiFetch<OwnerListing[]>('/owner/listings',{},true),searchParams]);
  const selected=rows.find(row=>row.id===params.editar);
  return <section className="section pageTop"><div className="container"><div className="pageHeading">
    <h1>Mis publicaciones</h1><div className="portalLinks"><Link className="button" href="?nuevo=1">Inscribir un inmueble</Link><Link href="/mi-cuenta">Mis facturas y documentos</Link></div></div>
    {params.guardado==='1' && <StatusNotice tone="success" message="Publicación guardada."/>}
    {params.editar && !selected && <p role="alert">Publicación no disponible.</p>}
    {selected || params.nuevo==='1' ? <Reveal><OwnerListingForm key={selected?.id??'new'} item={selected}/><Link href="/propietarios/publicaciones">Volver a mis publicaciones</Link></Reveal> :
    <div className="cardsGrid">{rows.map(row=><Reveal key={row.id}><article className="card formPanel"><span className="eyebrow">{row.operation==='sale'?'Venta':'Arriendo'} · {row.published?'Publicado':'Borrador'}</span>
    <h2>{row.title}</h2><p>{row.city} · {row.neighborhood}</p><div className="portalLinks"><Link href={'?editar='+row.id}>Editar publicación</Link>
    {row.published && <Link href={row.operation==='sale'?'/comprar/'+row.id:'/inmuebles/'+row.slug}>Ver ficha</Link>}</div></article></Reveal>)}
    {!rows.length && <p>Todavía no has inscrito inmuebles.</p>}</div>}</div></section>;
}
