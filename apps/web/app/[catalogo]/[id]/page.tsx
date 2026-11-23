import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError } from '@/lib/api';
import { loadPublicData } from '@/lib/public-data';
import { readSite } from '@/lib/read-site';
import { isSaleCatalog, type SaleOffer } from '@/lib/sale-offers';
import { pesos } from '@/lib/format';
import { PropertyGallery } from '@/components/PropertyGallery';
import { ContactForm } from '@/components/ContactForm';
import { DataUnavailable } from '@/components/DataUnavailable';

export default async function SaleDetail({params}:Readonly<{params:Promise<{catalogo:string;id:string}>}>) {
  const {catalogo,id}=await params;
  if(!isSaleCatalog(catalogo)) notFound();
  const offer=await loadPublicData<SaleOffer>('/sales/'+catalogo+'/'+encodeURIComponent(id)).catch(error=>{
    if(error instanceof ApiError && error.status===404) notFound();
    throw error;
  });
  if(!offer) return <section className="container section"><DataUnavailable label="la oferta" retryHref={`/${catalogo}/${encodeURIComponent(id)}`}/></section>;
  const {catalogos}=await readSite();
  return <section className="section pageTop"><div className="container">
    <Link className="textLink" href={'/'+catalogo}>← {catalogo==='comprar'?catalogos.buyTitle:catalogos.goodsTitle}</Link>
    <div className="pageHeading"><span className="eyebrow">{[offer.category,offer.city].filter(Boolean).join(' · ')}</span><h1>{offer.title}</h1><strong>{pesos(Number(offer.price))}</strong></div>
    {offer.address && <p>{[offer.address,offer.neighborhood,offer.city].filter(Boolean).join(', ')} · {offer.bedrooms} habitaciones</p>}
    {!!offer.features?.length && <p>{offer.features.join(' · ')}</p>}
    <PropertyGallery title={offer.title} images={offer.images.map((url,i)=>({url,id:url,alt:offer.title+' · Foto '+(i+1),sortOrder:i}))}/>
    <div className="contactGrid section"><div className="formattedCopy">{offer.description}</div><div className="card formPanel"><h2>Consultar esta oferta</h2><ContactForm initialSubject={('Consulta: '+offer.title).slice(0,160)}/></div></div>
  </div></section>;
}
