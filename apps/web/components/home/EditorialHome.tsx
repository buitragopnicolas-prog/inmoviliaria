import Link from 'next/link';
import { Suspense } from 'react';
import type { SiteCopy } from '@/lib/site-content';
import { InventoryWheel } from './Directions';
import { HomeSearch } from './HomeSections';
import { LightSurface } from './LightSurface';
import styles from './EditorialHome.module.css';

type Cover = SiteCopy['portada'];

function JourneyDirectory({ copy }: Readonly<{ copy: Cover }>) {
  const journeys = [
    { title: copy.findPath, links: [[copy.rent, '/inmuebles'], [copy.buy, '/comprar'], [copy.goods, '/vehiculos-y-bienes']] },
    { title: copy.publishPath, links: [[copy.owners, '/propietarios']] },
    { title: copy.accountPath, links: [[copy.tenants, '/arrendatarios'], [copy.clients, '/clientes'], [copy.services, '/servicios']] },
  ];

  return (
    <nav className={styles.paths} aria-label="¿Qué quieres hacer?">
      {journeys.map(({ title, links }, index) => (
        <details name="gestion-jb" key={links[0][1]} open={index === 0}>
          <summary>{title}</summary>
          <div className={styles.links}>
            {links.map(([label, href]) => <Link href={href} key={href}>{label} <span aria-hidden="true">↗</span></Link>)}
          </div>
        </details>
      ))}
    </nav>
  );
}

export function EditorialHome({ copy }: Readonly<{ copy: Cover }>) {
  return (
    <div className={styles.editorial} data-portada="editorial-jb">
      <div className="container">
        <header className={styles.intro}>
          <p className={styles.label}>{copy.kicker}</p>
          <h1 id="home-title">{copy.first} <em>{copy.second}</em></h1>
          <p>{copy.intro}</p>
          <nav className={styles.shortcuts} aria-label="Secciones de la portada">
            <a href="#portafolio">{copy.portfolioLabel}</a>
            <a href="#home-search">{copy.searchButton}</a>
            <a href="#recorridos">{copy.journeyTitle}</a>
          </nav>
        </header>
        <section id="portafolio" aria-labelledby="portafolio-title" className={styles.portfolio}>
          <div>
            <p className={styles.label}>{copy.portfolioLabel}</p>
            <h2 id="portafolio-title">{copy.portfolioTitle}</h2>
            <p>{copy.featuredIntro}</p>
            <div className={styles.shortcuts}>
              <Link href="/inmuebles">{copy.featuredLink} <span aria-hidden="true">↗</span></Link>
              <Link href="/comprar">{copy.buy} <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <Suspense fallback={<output>Cargando galería…</output>}>
            <InventoryWheel copy={copy} portfolio />
          </Suspense>
        </section>
        <section id="busqueda" aria-labelledby="busqueda-title" className={styles.search}>
          <LightSurface image={copy.photo} alt={copy.photoAlt} caption={copy.caption}>
            <div className={styles.searchContent}>
              <p className={styles.label}>{copy.rent}</p>
              <h2 id="busqueda-title">{copy.lightTitle}</h2>
              <HomeSearch copy={copy} />
            </div>
          </LightSurface>
        </section>
        <section id="recorridos" aria-labelledby="recorridos-title" className={styles.journeys}>
          <h2 id="recorridos-title">{copy.journeyTitle}</h2>
          <JourneyDirectory copy={copy} />
        </section>
      </div>
    </div>
  );
}
