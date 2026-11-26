import Form from 'next/form';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataUnavailable } from '@/components/DataUnavailable';
import { SaleShowcase } from '@/components/market/Merchandising';
import { loadPublicData } from '@/lib/public-data';
import { readSite } from '@/lib/read-site';
import { isSaleCatalog, type SaleCatalog, type SaleOffer } from '@/lib/sale-offers';

type Filters = Record<string, string | string[] | undefined>;
async function Results({ catalog, query }: Readonly<{ catalog: SaleCatalog; query: string }>) {
  const offers = await loadPublicData<SaleOffer[]>('/sales/'+(catalog==='comprar'?'market':catalog)+'?'+query);
  if (offers === null) return <DataUnavailable label="las ofertas de venta" retryHref={`/${catalog}?${query}`} />;
  const { catalogos } = await readSite();
  if (!offers.length) return <output className="card empty">{query ? 'No hay ofertas que coincidan con tu búsqueda.' : catalogos.emptyOffers}</output>;
  return <><SaleShowcase copy={catalogos} offers={offers.filter(o=>o.catalog==='comprar')}/>
    <SaleShowcase copy={catalogos} goods offers={offers.filter(o=>o.catalog==='vehiculos-y-bienes')}/></>;
}

export default async function SaleCatalogPage({params,searchParams}:Readonly<{params:Promise<{catalogo:string}>;searchParams:Promise<Filters>}>) {
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
    {property && <div className="portalLinks"><Link className="button outline" href="/propietarios">{catalogos.publishLink}</Link></div>}
    <Form className="filters glass-panel" action={'/'+catalogo} aria-label="Buscar ofertas">
      <label>{property?'Buscar inmueble o bien mueble':'Buscar artículo'}<input type="search" name="q" defaultValue={query.get('q')??''} maxLength={150}/></label>
      <label>Categoría<input name="category" defaultValue={query.get('category')??''} placeholder={property?'Casa, vehículo, estufa…':'Carro, estufa…'} maxLength={150}/></label>
      {property && <label>Ciudad<input name="city" defaultValue={query.get('city')??''} maxLength={150}/></label>}
      <button className="button" type="submit">Buscar</button>
    </Form>
    <Suspense key={query.toString()} fallback={<output>Cargando ofertas…</output>}><Results catalog={catalogo} query={query.toString()}/></Suspense>
  </div></section>;
}
