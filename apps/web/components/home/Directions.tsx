import Link from 'next/link';
import { Suspense } from 'react';
import { HomeSearch, destinations } from './HomeSections';
import { FeaturedRentals } from './FeaturedRentals';
import { LightSurface } from './LightSurface';
import type { SiteCopy } from '@/lib/site-content';
import styles from './Directions.module.css';

export const directions = { luz:'Luz', orbita:'Órbita', recorridos:'Recorridos', original:'Original' } as const;
export type Direction = keyof typeof directions;
type Cover = SiteCopy['portada'];

export function StylePicker({current}:Readonly<{current:Direction}>) {
  return <nav className={styles.picker} aria-label="Comparar portadas"><div className="container">
    <span>Diseño de portada</span><div>{(Object.entries(directions) as [Direction,string][]).map(([key,label])=>
      <Link key={key} href={'/?estilo='+key} prefetch={false} aria-current={current===key?'page':undefined}>{label}</Link>)}</div>
    {(current==='orbita' || current==='recorridos') && <a className={styles.mobileSearch} href="#home-search">Ir al buscador ↓</a>}
  </div></nav>;
}

function Title({copy}:Readonly<{copy:Cover}>) {
  return <><p className={styles.location}>{copy.kicker}</p><h1 id="home-title">{copy.first} <em>{copy.second}</em></h1><p className={styles.intro}>{copy.intro}</p></>;
}

function Destinations({copy}:Readonly<{copy:Cover}>) {
  return <nav className={styles.destinations} aria-label="¿Qué quieres hacer?">{destinations.map(([key,url])=>
    <Link href={url} key={url}>{copy[key]}<span aria-hidden="true">↗</span></Link>)}</nav>;
}

function RouteMap({copy}:Readonly<{copy:Cover}>) {
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

export function DesignHero({direction,copy}:Readonly<{direction:Exclude<Direction,'original'>;copy:Cover}>) {
  let content;
  if (direction === 'luz') {
    content = <LightSurface image={copy.photo} alt={copy.photoAlt} caption={copy.caption}>
      <div className={'container '+styles.lightCopy}><Title copy={copy}/><a className={styles.mainAction} href="#buscar-inmueble">{copy.searchButton} <span aria-hidden="true">↓</span></a></div>
    </LightSurface>;
  } else if (direction === 'orbita') {
    content = <div className={'container '+styles.orbitGrid}>
      <div className={styles.orbitCopy}><Title copy={copy}/><Link className={styles.mainAction} href="/inmuebles">{copy.featuredLink} <span aria-hidden="true">↗</span></Link></div>
      <Suspense fallback={<output className={styles.empty}>Cargando inmuebles destacados…</output>}><FeaturedRentals copy={copy}/></Suspense>
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
