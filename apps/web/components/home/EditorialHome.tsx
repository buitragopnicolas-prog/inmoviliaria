import Link from 'next/link';
import { Suspense } from 'react';
import type { SiteCopy } from '@/lib/site-content';
import { FeaturedRentals } from './FeaturedRentals';
import { HomeSearch } from './HomeSections';
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
        <section id="busqueda" className="homeSearchBar" aria-label={copy.searchTitle}><HomeSearch copy={copy}/></section>
        <div className="marketHero">
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
        <section id="portafolio" className="rentalPortfolio" aria-labelledby="portafolio-title">
          <h2 id="portafolio-title">{copy.portfolioLabel}</h2>
          <Suspense fallback={<output>Cargando inmuebles destacados…</output>}><FeaturedRentals copy={copy}/></Suspense>
        </section>
        </div>
        <section id="recorridos" aria-labelledby="recorridos-title" className={styles.journeys+' glass-panel'}>
          <h2 id="recorridos-title">{copy.journeyTitle}</h2>
          <JourneyDirectory copy={copy} />
        </section>
      </div>
    </div>
  );
}
