import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import type { NewsPost, Property } from '@/lib/types';
import { NewsCard } from '@/components/NewsCard';
import { PropertyCard } from '@/components/PropertyCard';
import { assetUrl } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [featured, featuredNews] = await Promise.all([
    apiFetch<Property[]>('/properties/featured'),
    apiFetch<NewsPost[]>('/news/featured'),
  ]);
  // Seed illustrations contain text and must not be cropped as property photos.
  const heroProperty = featured.find((property) => property.images[0]?.url && !/\.svg(?:\?|$)/i.test(property.images[0].url));
  return (
    <>
      <section className="hero">
        <div className="container heroGrid">
          <div className="heroCopy">
            <span className="eyebrow">Asesoría y administración inmobiliaria</span>
            <h1>Tu inmueble.<br />Un patrimonio que merece atención.</h1>
            <p>Arriendos y administración en Bogotá, con acompañamiento para propietarios y arrendatarios. Contratos, facturas y pagos en un mismo lugar.</p>
            <div className="heroButtons"><Link className="button" href="/inmuebles">Ver inmuebles</Link><Link className="button outline" href="/contacto">Hablar con un asesor</Link></div>
            <div className="trust"><div><strong>Inmuebles</strong><span>Información del arriendo</span></div><div><strong>Contratos</strong><span>Consulta documental</span></div><div><strong>Tu cuenta</strong><span>Facturas e historial</span></div></div>
          </div>
          <div className="heroVisual">
            <Image className="heroPhoto" src={heroProperty ? assetUrl(heroProperty.images[0].url) : '/architecture.svg'} alt={heroProperty ? heroProperty.images[0].alt || heroProperty.title : ''} fill sizes="(max-width: 1000px) 100vw, 50vw" priority />
            <div className="heroCaption">
              <span>{heroProperty ? `${heroProperty.neighborhood} · ${heroProperty.city}` : 'Asesoría Inmobiliaria JB'}</span>
              <h2>{heroProperty?.title ?? 'Gestión cercana. Información clara.'}</h2>
              <Link href={heroProperty ? `/inmuebles/${heroProperty.slug}` : '/nosotros'}>{heroProperty ? 'Conoce este inmueble' : 'Conoce nuestra empresa'} <span aria-hidden="true">&nbsp;↗</span></Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="sectionHeading"><div><span className="eyebrow">Destacados</span><h2>Inmuebles disponibles</h2></div><Link className="textLink" href="/inmuebles">Ver todos →</Link></div>
          <div className="cardsGrid">{featured.map((property) => <PropertyCard property={property} key={property.id} />)}</div>
          {featured.length === 0 && <div className="card empty">Consulta el catálogo para conocer los inmuebles disponibles. <Link className="textLink" href="/inmuebles">Explorar inmuebles →</Link></div>}
        </div>
      </section>
      <section className="sectionAlt">
        <div className="container">
          <div className="sectionHeading"><div><span className="eyebrow">Noticias</span><h2>Novedades y prensa del sector</h2></div><Link className="textLink" href="/noticias">Ver noticias →</Link></div>
          {featuredNews.length > 0 ? (
            <div className="cardsGrid newsGrid">{featuredNews.map((newsPost) => <NewsCard newsPost={newsPost} key={newsPost.id} />)}</div>
          ) : (
            <div className="card empty">Pronto publicaremos novedades inmobiliarias y enlaces a medios digitales relevantes.</div>
          )}
        </div>
      </section>
      <section className="benefits sectionAlt">
        <div className="container benefitsGrid">
          <div><span className="eyebrow">Por qué elegirnos</span><h2>Una experiencia inmobiliaria simple y confiable</h2></div>
          <article><strong>01</strong><h3>Información del inmueble</h3><p>Consulta el canon, la administración, la ubicación y las características antes de solicitar una visita.</p></article>
          <article><strong>02</strong><h3>Cuenta digital</h3><p>Consulta tus facturas mensuales y el historial de pagos desde cualquier dispositivo.</p></article>
          <article><strong>03</strong><h3>Gestión documental</h3><p>Accede a los contratos disponibles en tu cuenta y consulta la información de tu arriendo.</p></article>
        </div>
      </section>
    </>
  );
}
