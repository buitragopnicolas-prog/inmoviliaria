import { defaultCopy } from '@/lib/site-content';
import { readSite } from '@/lib/read-site';
import Link from 'next/link';
import { loadPublicData } from '@/lib/public-data';
import { pesos } from '@/lib/format';
import { promotionNames, type SaleOffer } from '@/lib/sale-offers';
import { AssetRail, type DisplayAsset } from './AssetRail';
import { DataUnavailable } from '../DataUnavailable';

function asset(offer:SaleOffer):DisplayAsset {
  return {id:offer.id,href:'/'+offer.catalog+'/'+encodeURIComponent(offer.id),title:offer.title,price:Number(offer.price),
    image:offer.images[0],place:[offer.category,offer.city].filter(Boolean).join(' · '),details:offer.neighborhood || '',
    badge:offer.promotion ? promotionNames[offer.promotion] : undefined,latitude:offer.latitude,longitude:offer.longitude};
}

export function SaleShowcase({offers,goods=false,copy=defaultCopy.catalogos}:Readonly<{copy?:typeof defaultCopy.catalogos;offers:SaleOffer[];goods?:boolean}>) {
  if(!offers.length)return null;
  const sorted=goods ? offers : [...offers.filter(o=>o.promotion),...offers.filter(o=>!o.promotion)];
  const saleHeading=offers.some(o=>o.promotion)?copy.featuredSalesHeading:copy.saleHeading;
  const heading=goods?copy.goodsHeading:saleHeading;
  return <section className="marketShowcase"><h2>{heading}</h2>
    <AssetRail key={sorted.map(o=>o.id).join('/')} items={sorted.map(asset)} label={heading} kind={goods?'goods':'sale'}/>
  </section>;
}

export async function InvestmentPanel() {
  const [offers,{catalogos:copy}]=await Promise.all([loadPublicData<SaleOffer[]>('/sales/comprar'),readSite()]);
  if(offers===null)return <aside className="investment glass-panel-total glass-panel-jb"><DataUnavailable label="las oportunidades de inversión" retryHref="/comprar"/></aside>;
  const candidates=offers.map(o=>({offer:o,monthly:Number(o.estimatedMonthlyRent),price:Number(o.price)}));
  const rows=[...candidates.filter(c=>c.monthly>0),...candidates.filter(c=>c.monthly<=0)].slice(0,3)
    .map(c=>({...c,yield:c.price>0 && c.monthly>0 ? 1200*c.monthly/c.price : null}));
  const max=Math.max(1,...rows.map(r=>r.yield??0));
  return <aside className="investment glass-panel-total glass-panel-jb" data-heat-panel="" aria-label={copy.investmentTitle}>
    <h2>{copy.investmentTitle}</h2>
    {!rows.length && <p>{copy.emptyInvestment}</p>}
    {rows.map(({offer,price,monthly,yield:rate})=><article key={offer.id}>
      <Link href={'/comprar/'+encodeURIComponent(offer.id)}>{offer.title} ↗</Link><p>{pesos(price)} · Venta</p>
      {rate!==null ? <><small>Canon estimado {pesos(monthly)} / mes</small>
        <strong>{rate.toLocaleString('es-CO',{maximumFractionDigits:2})} % bruto anual</strong>
        <div className="yieldTrack" aria-hidden="true"><i style={{width:(100*rate/max)+'%'}}/></div></>
        :<small>Canon estimado pendiente de publicación</small>}
    </article>)}
    {rows.some(r=>r.yield!==null) && <p className="yieldNote">Proyección con 12 meses de ocupación. Canon mensual estimado × 12 ÷ precio de venta. Excluye gastos, impuestos y vacancia.</p>}
    <Link className="textLink" href="/comprar">{copy.buyLink} ↗</Link>
  </aside>;
}
