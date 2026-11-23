import Link from 'next/link';
import { Suspense } from 'react';
import { DataUnavailable } from '../DataUnavailable';
import { HomeSearch, destinations } from './HomeSections';
import { LightSurface } from './LightSurface';
import { WorksWheel, type WheelItem } from '../ui/works-wheel';
import { loadPublicData } from '@/lib/public-data';
import { propertyPhotoUrl, pesos } from '@/lib/format';
import type { Property } from '@/lib/types';
import type { SiteCopy } from '@/lib/site-content';
import styles from './Directions.module.css';

export const directions = { luz:'Luz', orbita:'Órbita', recorridos:'Recorridos', original:'Original' } as const;
export type Direction = keyof typeof directions;
type Cover = SiteCopy['portada'];

export function StylePicker({current}:{current:Direction}) {
  return <nav className={styles.picker} aria-label="Comparar portadas"><div className="container">
    <span>Diseño de portada</span><div>{(Object.entries(directions) as [Direction,string][]).map(([key,label])=>
      <Link key={key} href={'/?estilo='+key} prefetch={false} aria-current={current===key?'page':undefined}>{label}</Link>)}</div>
    {(current==='orbita' || current==='recorridos') && <a className={styles.mobileSearch} href="#home-search">Ir al buscador ↓</a>}
  </div></nav>;
}

function Title({copy}:{copy:Cover}) {
  return <><p className={styles.location}>{copy.kicker}</p><h1 id="home-title">{copy.first} <em>{copy.second}</em></h1><p className={styles.intro}>{copy.intro}</p></>;
}

function Destinations({copy}:{copy:Cover}) {
  return <nav className={styles.destinations} aria-label="¿Qué quieres hacer?">{destinations.map(([key,url])=>
    <Link href={url} key={url}>{copy[key]}<span aria-hidden="true">↗</span></Link>)}</nav>;
}

export async function InventoryWheel({copy, portfolio = false}:{copy:Cover; portfolio?:boolean}) {
  const published = await loadPublicData<Property[]>('/properties');
  if (published===null) return <DataUnavailable label="la galería de inmuebles" retryHref={portfolio ? '/' : '/?estilo=orbita'}/>;
  const items:WheelItem[]=[];
  // Interleave homes so the first turn does not just show one property's album.
  const homes=published.filter(p=>p.images.some(image=>image.url && image.url!=='/property-placeholder.svg'))
    .slice(0,9).map(property=>({property,photos:property.images.filter(photo=>photo.url && photo.url!=='/property-placeholder.svg')}));
  const maxPhotos = Math.max(0,...homes.map(home => home.photos.length));
  for(let photoIndex=0; photoIndex<maxPhotos && items.length<9; photoIndex++) {
    for(const {property,photos} of homes) {
      const photo=photos[photoIndex];
      if(!photo || items.length>=9) continue;
      items.push({id:property.id+'/'+photo.id, title:property.title, image:propertyPhotoUrl(photo.url), alt:photo.alt || property.title,
        href:'/inmuebles/'+encodeURIComponent(property.slug), detail:[property.city,pesos(property.monthlyRent)+'/mes'].filter(Boolean).join(' · ')});
    }
  }
  if(!items.length) return <p className={styles.empty}>{copy.emptyFeatured} <Link href="/inmuebles">{copy.emptyFeaturedLink} →</Link></p>;
  return <WorksWheel items={items} portfolio={portfolio}/>;
}

function RouteMap({copy}:{copy:Cover}) {
  const groups=[
    {name:'Encontrar un inmueble o un bien', entries:[['rent','/inmuebles'],['buy','/comprar'],['goods','/vehiculos-y-bienes']]},
    {name:'Publicar mi inmueble', entries:[['owners','/propietarios']]},
    {name:'Consultar mi cuenta o un servicio', entries:[['tenants','/arrendatarios'],['clients','/clientes'],['services','/servicios']]},
  ] as const;
  return <nav aria-label="¿Qué quieres hacer?" className={styles.routeMap}><h2>¿Qué quieres hacer?</h2>
    {groups.map((group,i)=><details key={group.name} name="rutas-jb" open={i===0}>
      <summary>{group.name}<span aria-hidden="true"/></summary><div className={styles.branches}>{group.entries.map(([key,href])=>
        <Link key={href} href={href}>{copy[key]}<span aria-hidden="true">↗</span></Link>)}</div>
    </details>)}</nav>;
}

export function DesignHero({direction,copy}:{direction:Exclude<Direction,'original'>;copy:Cover}) {
  let content;
  if (direction === 'luz') {
    content = <LightSurface image={copy.photo} alt={copy.photoAlt} caption={copy.caption}>
      <div className={'container '+styles.lightCopy}><Title copy={copy}/><a className={styles.mainAction} href="#buscar-inmueble">{copy.searchButton} <span aria-hidden="true">↓</span></a></div>
    </LightSurface>;
  } else if (direction === 'orbita') {
    content = <div className={'container '+styles.orbitGrid}>
      <div className={styles.orbitCopy}><Title copy={copy}/><a className={styles.mainAction} href="/inmuebles">{copy.featuredLink} <span aria-hidden="true">↗</span></a></div>
      <Suspense fallback={<output className={styles.empty}>Cargando galería…</output>}><InventoryWheel copy={copy}/></Suspense>
    </div>;
  } else {
    content = <div className={'container '+styles.flowGrid}><div className={styles.flowCopy}><Title copy={copy}/>
      <img className={styles.flowPhoto} src={copy.photo} alt={copy.photoAlt} width="680" height="220"/></div><RouteMap copy={copy}/></div>;
  }
  return <section aria-labelledby="home-title" className={styles[direction]}>
    {content}
    <div className={'container '+styles.tools}>{direction!=='recorridos' && <Destinations copy={copy}/>}<HomeSearch copy={copy}/></div>
  </section>;
}
