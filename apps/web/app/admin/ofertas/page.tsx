import Link from 'next/link';
import {notFound} from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { pesos } from '@/lib/format';
import { saleCatalogs, type SaleOffer } from '@/lib/sale-offers';
import { SaleOfferForm } from '@/components/SaleOfferForm';
export default async function SalesAdmin({searchParams}:{searchParams:Promise<{editar?:string;nueva?:string}>}){
  await requireUser('ADMIN');
  const {editar,nueva}=await searchParams;
  const rows=await apiFetch<SaleOffer[]>('/admin/sales',{},true);
  const offer=rows.find(row=>row.id===editar);
  if(editar&&!offer)notFound();
  return <><div className="pageHeading compact"><h1>Ofertas de venta</h1><p>Publica inmuebles en venta, vehículos y otros bienes con su precio y fotografías.</p></div>
    {editar||nueva?<section className="card formPanel"><Link href="/admin/ofertas">Volver a ofertas</Link><h2>{offer?'Editar oferta':'Nueva oferta'}</h2><SaleOfferForm key={offer?.id??'new'} offer={offer}/></section>:
    <><Link className="button" href="/admin/ofertas?nueva=1">Nueva oferta</Link><div className="card tableCard"><div className="responsiveTable"><table><thead><tr><th>Oferta</th><th>Catálogo</th><th>Precio</th><th>Estado</th><th>Acción</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><td>{row.title}</td><td>{saleCatalogs[row.catalog]}</td><td>{pesos(Number(row.price))}</td><td>{row.published?'Publicada':'Borrador'}</td><td><Link href={'/admin/ofertas?editar='+row.id}>Editar</Link></td></tr>)}</tbody></table></div>{!rows.length&&<p className="empty">Todavía no hay ofertas de venta.</p>}</div></>}
  </>;
}
