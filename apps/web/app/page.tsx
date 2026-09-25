import Link from 'next/link';
import { loadPublicData } from '@/lib/public-data';
import { DataUnavailable } from '@/components/DataUnavailable';
import type { NewsPost, Property } from '@/lib/types';
import { NewsCard } from '@/components/NewsCard';
import { PropertyCard } from '@/components/PropertyCard';
import { Reveal } from '@/components/Reveal';
import { HomeHero, ServiceIntroduction, DocumentsSection, DigitalSection, ContactSection } from '@/components/home/HomeSections';
import styles from '@/components/home/HomeSections.module.css';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [featured, featuredNews] = await Promise.all([
    loadPublicData<Property[]>('/properties/featured'),
    loadPublicData<NewsPost[]>('/news/featured'),
  ]);

  return (
    <div className={styles.home}>
      <HomeHero />
      <ServiceIntroduction />
      <section className={styles.properties} id="inmuebles-destacados" aria-labelledby="featured-title">
        <div className="container">
          <Reveal className={styles.sectionHeading}>
            <div><span className={styles.kicker}>02 / Encuentra tu lugar</span><h2 id="featured-title">Espacios para tu<br /><em>próxima etapa.</em></h2></div>
            <div className={styles.headingAside}><p>Conoce los inmuebles disponibles en arriendo. Cada detalle cuenta al elegir.</p><Link className={styles.arrowLink} href="/inmuebles">Explorar el catálogo <span aria-hidden="true">↗</span></Link></div>
          </Reveal>
          {featured === null ? <DataUnavailable label="los inmuebles destacados" /> : (
            <div className={`cardsGrid ${styles.propertyGrid}`}>{featured.map((property, index) => <Reveal key={property.id} delay={index * 60}><PropertyCard property={property} /></Reveal>)}</div>
          )}
          {featured?.length === 0 && <div className="card empty">Consulta el catálogo para conocer los inmuebles disponibles. <Link className="textLink" href="/inmuebles">Explorar inmuebles →</Link></div>}
        </div>
      </section>
      <DocumentsSection />
      <DigitalSection />
      <section className={styles.news} aria-labelledby="news-title">
        <div className="container">
          <Reveal className={styles.sectionHeading}>
            <div><span className={styles.kicker}>05 / Una mirada al sector</span><h2 id="news-title">Información para<br /><em>decidir mejor.</em></h2></div>
            <Link className={styles.arrowLink} href="/noticias">Noticias y actualidad <span aria-hidden="true">↗</span></Link>
          </Reveal>
          {featuredNews === null ? <DataUnavailable label="las noticias" /> : featuredNews.length > 0 ? (
            <div className="cardsGrid newsGrid">{featuredNews.map((newsPost) => <NewsCard newsPost={newsPost} key={newsPost.id} />)}</div>
          ) : <p className={styles.newsEmpty}>Pronto publicaremos novedades inmobiliarias y enlaces a medios digitales relevantes.</p>}
        </div>
      </section>
      <ContactSection />
    </div>
  );
}
