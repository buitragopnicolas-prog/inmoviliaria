import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataUnavailable } from '@/components/DataUnavailable';
import { Reveal } from '@/components/Reveal';
import { pesos, propertyPhotoUrl } from '@/lib/format';
import { loadPublicData } from '@/lib/public-data';
import { readSite } from '@/lib/read-site';
import { isSaleCatalog, type SaleCatalog, type SaleOffer } from '@/lib/sale-offers';

type Filters = Record<string, string | string[] | undefined>;
async function Results({ catalog, query }: { catalog: SaleCatalog; query: string }) {
  const offers = await loadPublicData<SaleOffer[]>('/sales/'+(catalog==='comprar'?'market':catalog)+'?'+query);
  if (offers === null) return <DataUnavailable label="las ofertas de venta" />;
  const { catalogos } = await readSite();
  if (!offers.length) return <p className="card empty" role="status">{query ? 'No hay ofertas que coincidan con tu búsqueda.' : catalogos.emptyOffers}</p>;
  return <div className="cardsGrid">{offers.map(offer=><Reveal key={offer.id}><Link className="card saleCard" href={'/'+offer.catalog+'/'+offer.id}>
    <img src={propertyPhotoUrl(offer.images[0])} alt={offer.title} loading="lazy" />
    <div><span className="eyebrow">{[offer.category,offer.city].filter(Boolean).join(' · ')}</span><h2>{offer.title}</h2><strong>{pesos(Number(offer.price))}</strong></div>
  </Link></Reveal>)}</div>;
}

export default async function SaleCatalogPage({params,searchParams}:{params:Promise<{catalogo:string}>;searchParams:Promise<Filters>}) {
  const [{catalogo}, filters, {catalogos}] = await Promise.all([params, searchParams, readSite()]);
  if (!isSaleCatalog(catalogo)) notFound();
  const property = catalogo === 'comprar';
  const query = new URLSearchParams();
  for (const key of property ? ['q','category','city'] : ['q','category']) {
    const value=filters[key];
    if(typeof value==='string' && value.trim()) query.set(key,value.trim().slice(0,150));
  }
  return <section className="section pageTop"><div className="container">
    <div className="pageHeading"><h1>{property ? catalogos.buyTitle : catalogos.goodsTitle}</h1><p>{property ? catalogos.buyIntro : catalogos.goodsIntro}</p></div>
    {property && <div className="portalLinks"><Link className="button outline" href="/propietarios">Publicar mi inmueble</Link></div>}
    <form className="filters" method="get" action={'/'+catalogo} aria-label="Buscar ofertas">
      <label>{property?'Buscar inmueble o bien mueble':'Buscar artículo'}<input type="search" name="q" defaultValue={query.get('q')??''} maxLength={150}/></label>
      <label>Categoría<input name="category" defaultValue={query.get('category')??''} placeholder={property?'Casa, vehículo, estufa…':'Carro, estufa…'} maxLength={150}/></label>
      {property && <label>Ciudad<input name="city" defaultValue={query.get('city')??''} maxLength={150}/></label>}
      <button className="button" type="submit">Buscar</button>
    </form>
    <Suspense key={query.toString()} fallback={<p role="status">Cargando ofertas…</p>}><Results catalog={catalogo} query={query.toString()}/></Suspense>
  </div></section>;
}
