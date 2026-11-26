import Link from 'next/link';
import { PortalPhoto } from '../business/PortalPhoto';
import { EditorialPhoto } from '../EditorialPhoto';
import Form from 'next/form';
import { Reveal } from '../Reveal';
import { BrandIcon } from '../BrandIcon';
import { UiIcon } from '../UiIcon';
import { defaultCopy } from '@/lib/site-content';
import styles from './HomeSections.module.css';

export const destinations = [ ['buy', '/comprar'], ['rent', '/inmuebles'], ['goods', '/vehiculos-y-bienes'], ['services', '/servicios'], ['tenants', '/arrendatarios'], ['owners', '/propietarios'], ['clients', '/clientes'] ] as const;

export function HomeHero({ featuredHref = '#inmuebles-destacados', copy = defaultCopy.portada, brand = defaultCopy.identidad.name }: Readonly<{ featuredHref?: string; copy?: typeof defaultCopy.portada; brand?: string }>) {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={`container ${styles.heroContent}`}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>{copy.kicker} · {brand}</span>
          <h1 id="home-title"><span className={styles.titleLine}>{copy.first}</span>{' '}<span className={styles.titleLine}><em>{copy.second}</em></span></h1>
          <p>{copy.intro}</p>
          <nav className={styles.heroActions} aria-label="¿Qué quieres hacer?">
            {destinations.map(([label, href]) => (
              <Link key={label} href={href}>{copy[label]}<span aria-hidden="true">↗</span></Link>
            ))}
          </nav>
        </div>
        <HomeSearch copy={copy} />
        <div className={styles.heroVisual}>
          <picture className={styles.heroImage}>
            <source media="(max-width: 1000px)" srcSet={copy.photo === defaultCopy.portada.photo ? "/images/jb-architecture-hero-960.webp" : copy.photo} />
            <img src={copy.photo} alt={copy.photoAlt} width="1920" height="1081" fetchPriority="high" />
          </picture>
          <div className={styles.heroImageCaption}><small>{copy.caption}</small></div>
        </div>
        <div className={styles.heroFoot}>
          <Link className={styles.discoverLink} href={featuredHref}><span aria-hidden="true">↓</span> {copy.discover}</Link>
          <Link className={styles.catalogLink} href="/contacto">{copy.contact} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  );
}

export function ServiceIntroduction({ copy = defaultCopy.accesos } = {}) {
  return (
    <section className={styles.introduction} id="nuestro-enfoque" aria-labelledby="approach-title">
      <div className="container">
        <h2 id="approach-title">{copy.title}</h2>
        <div className={styles.serviceRows}>
          <Reveal><Link href={copy.visitHref} className={styles.serviceLink}><div><BrandIcon name="rent"/><h3>{copy.visit}</h3><p>{copy.visitText}</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
          <Reveal delay={70}><Link href={copy.manageHref} className={styles.serviceLink}><div><BrandIcon name="sale"/><h3>{copy.manage}</h3><p>{copy.manageText}</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
          <Reveal delay={140}><Link href={copy.contractHref} className={styles.serviceLink}><div><BrandIcon name="advice"/><h3>{copy.contract}</h3><p>{copy.contractText}</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
        </div>
      </div>
    </section>
  );
}

export function DocumentsSection({ copy = defaultCopy.documentos } = {}) {
  return (
    <section className={styles.documents} aria-labelledby="documents-title">
      <div className={`container ${styles.documentsGrid}`}>
        <Reveal className={styles.interiorFigure}>
          <figure>
            <EditorialPhoto fallback={defaultCopy.documentos.photo} fallbackAlt={defaultCopy.documentos.alt} src={copy.photo} width="1200" height="900" alt={copy.alt} loading="lazy" decoding="async" />
            <figcaption>{copy.caption}</figcaption>
          </figure>
          <span className={styles.figureIndex} aria-hidden="true">{copy.mark}</span>
        </Reveal>
        <Reveal className={styles.documentCopy}>
          <span className={styles.kicker}>{copy.kicker}</span>
          <h2 id="documents-title">{copy.title}</h2>
          <p>{copy.intro}</p>
          <ul className={styles.documentList}>
            <li><UiIcon name="document" /><div><h3>{copy.first}</h3><p>{copy.firstText}</p></div></li>
            <li><UiIcon name="message" /><div><h3>{copy.second}</h3><p>{copy.secondText}</p></div></li>
          </ul>
          <Link className={styles.lightArrowLink} href={copy.href}>{copy.link} <span aria-hidden="true">↗</span></Link>
        </Reveal>
      </div>
    </section>
  );
}

export function DigitalSection({ copy = defaultCopy.cuenta, portals = defaultCopy.portales } = {}) {
  return (
    <section className={styles.digital} aria-labelledby="digital-title">
      <div className={`container ${styles.digitalGrid}`}>
        <Reveal className={styles.digitalCopy}>
          <PortalPhoto portal="TENANT" copy={portals}/>
          <span className={styles.kicker}>{copy.kicker}</span>
          <h2 id="digital-title">{copy.title}</h2>
          <p>{copy.intro}</p>
          <Link className={styles.arrowLink} href="/arrendatarios">{copy.link} <span aria-hidden="true">↗</span></Link>
        </Reveal>
        <Reveal className={styles.accountOverview}>
          <div className={styles.accountHeading}><span>{copy.panelKicker}</span><UiIcon name="home" /></div>
          <h3>{copy.panelTitle}</h3>
          <p>{copy.panelIntro}</p>
          <ol className={styles.accountList}>
            <li><UiIcon name="folder" /><div><strong>{copy.first}</strong><span>{copy.firstText}</span></div><span aria-hidden="true">01</span></li>
            <li><UiIcon name="document" /><div><strong>{copy.second}</strong><span>{copy.secondText}</span></div><span aria-hidden="true">02</span></li>
            <li><UiIcon name="check" /><div><strong>{copy.third}</strong><span>{copy.thirdText}</span></div><span aria-hidden="true">03</span></li>
          </ol>
          <div className={styles.accountNote}>{copy.note}</div>
        </Reveal>
      </div>
    </section>
  );
}

export function ContactSection({ copy = defaultCopy.cuenta } = {}) {
  return (
    <section className={styles.contact} aria-labelledby="contact-title">
      <EditorialPhoto fallback={defaultCopy.cuenta.contactPhoto} fallbackAlt="" className={styles.contactImage} src={copy.contactPhoto} alt="" width="960" height="540" loading="lazy" decoding="async" />
      <Reveal className={`container ${styles.contactContent}`}>
        <span className={styles.heroKicker}>{copy.contactKicker}</span>
        <h2 id="contact-title">{copy.contactTitle}</h2>
        <div><p>{copy.contactIntro}</p><Link className={`${styles.heroPrimary} button`} href={copy.contactHref}>{copy.contactButton} <span aria-hidden="true">↗</span></Link></div>
      </Reveal>
    </section>
  );
}

export function HomeSearch({copy}:Readonly<{copy:typeof defaultCopy.portada}>) {
  return (
    <div className={styles.searchPanel+' glass-panel'} id="buscar-inmueble">
          <div className={styles.searchHeading}><UiIcon name="search" /><h2>{copy.searchTitle}</h2></div>
          <Form action="/inmuebles" className={styles.heroSearch} aria-label="Buscar inmuebles en arriendo">
            <noscript><input type="hidden" name="vista" value="completa" /></noscript>
            <label htmlFor="home-search">{copy.searchLabel}<input id="home-search" name="search" type="search" placeholder="Ej. Chapinero o apartamento" /></label>
            <label htmlFor="home-city">{copy.cityLabel}<input id="home-city" name="city" placeholder="Ej. Bogotá" autoComplete="address-level2" /></label>
            <label htmlFor="home-max-rent">{copy.rentLabel}<input id="home-max-rent" name="maxRent" type="number" min="1" step="1" placeholder="Ej. 2500000" /></label>
            <button className="button" type="submit"><UiIcon name="search" />{copy.searchButton}</button>
          </Form>
        </div>
  );
}
