import { DesignHero, StylePicker, directions, type Direction } from '@/components/home/Directions';
import { readSite } from '@/lib/read-site';
import Link from 'next/link';
import { EditorialHome } from '@/components/home/EditorialHome';
import { Suspense } from 'react';
import { loadPublicData } from '@/lib/public-data';
import { DataUnavailable } from '@/components/DataUnavailable';
import type { NewsPost, Property } from '@/lib/types';
import { NewsCard } from '@/components/NewsCard';
import { PropertyCard } from '@/components/PropertyCard';
import { Reveal } from '@/components/Reveal';
import { HomeHero, ServiceIntroduction, DocumentsSection, DigitalSection, ContactSection } from '@/components/home/HomeSections';
import styles from '@/components/home/HomeSections.module.css';

export const dynamic = 'force-dynamic';

async function FeaturedProperties() {
  const {portada} = await readSite();
  const featured = await loadPublicData<Property[]>('/properties/featured');
  if (featured === null) return <DataUnavailable label="los inmuebles destacados" />;
  if (featured.length === 0) {
    return <div className="card empty">{portada.emptyFeatured} <Link className="textLink" href="/inmuebles">{portada.emptyFeaturedLink} →</Link></div>;
  }
  return (
    <div className={`cardsGrid ${styles.propertyGrid}`}>
      {featured.map((property, index) => <Reveal key={property.id} delay={index * 60}><PropertyCard property={property} /></Reveal>)}
    </div>
  );
}

async function FeaturedNews() {
  const [news,{identidad,portada}] = await Promise.all([loadPublicData<NewsPost[]>('/news/featured'), readSite()]);
  if (news === null) return <DataUnavailable label="las noticias" />;
  if (news.length === 0) return <p className={styles.newsEmpty}>{portada.emptyNews}</p>;
  return <div className="cardsGrid newsGrid">{news.map((post) => <NewsCard brand={identidad.name} newsPost={post} key={post.id} />)}</div>;
}

export default async function HomePage({searchParams}:{searchParams:Promise<{estilo?:string|string[]}>}) {
  const [copy,params] = await Promise.all([readSite(),searchParams]);
  const preview=process.env.APP_ENV==='local';
  const choice=params.estilo;
  const direction = preview && typeof choice === 'string' && Object.hasOwn(directions, choice) ? choice as Direction : undefined;
  const editorial = !direction && (preview || process.env.APP_ENV === 'development');
  return (
    <div className={styles.home}>
      {preview && direction && <StylePicker current={direction}/>}
      {editorial && <EditorialHome copy={copy.portada} />}
      {!editorial && (direction && direction !== 'original'
        ? <DesignHero direction={direction} copy={copy.portada} />
        : <HomeHero copy={copy.portada} brand={copy.identidad.name} />)}
      <section className={styles.properties} id="inmuebles-destacados" aria-labelledby="featured-title">
        <div className="container">
          <Reveal className={styles.sectionHeading}>
            <div><h2 id="featured-title">{copy.portada.featured}</h2></div>
            <div className={styles.headingAside}><p>{copy.portada.featuredIntro}</p><Link className={styles.arrowLink} href="/inmuebles">{copy.portada.featuredLink} <span aria-hidden="true">↗</span></Link></div>
          </Reveal>
          <Suspense fallback={<p role="status">Cargando inmuebles destacados…</p>}>
            <FeaturedProperties />
          </Suspense>
        </div>
      </section>
      <ServiceIntroduction copy={copy.accesos} />
      <DocumentsSection copy={copy.documentos} />
      <DigitalSection copy={copy.cuenta} />
      <section className={styles.news} aria-labelledby="news-title">
        <div className="container">
          <Reveal className={styles.sectionHeading}>
            <div><h2 id="news-title">{copy.portada.news}</h2></div>
            <Link className={styles.arrowLink} href="/noticias">{copy.portada.newsLink} <span aria-hidden="true">↗</span></Link>
          </Reveal>
          <Suspense fallback={<p role="status">Cargando noticias…</p>}>
            <FeaturedNews />
          </Suspense>
        </div>
      </section>
      <ContactSection copy={copy.cuenta} />
    </div>
  );
}
