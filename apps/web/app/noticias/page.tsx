import type { Metadata } from 'next';
import { loadPublicData } from '@/lib/public-data';
import { DataUnavailable } from '@/components/DataUnavailable';
import type { NewsPost } from '@/lib/types';
import { NewsCard } from '@/components/NewsCard';

export const metadata: Metadata = { title: 'Noticias' };
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const news = await loadPublicData<NewsPost[]>('/news');
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading"><span className="eyebrow">Noticias</span><h1>Actualidad inmobiliaria y enlaces de prensa</h1><p>Consulta nuestras novedades o abre directamente noticias publicadas en medios digitales.</p></div>
        {news === null ? <DataUnavailable label="las noticias" /> : news.length > 0 ? (
          <div className="cardsGrid newsGrid">{news.map((newsPost) => <NewsCard newsPost={newsPost} key={newsPost.id} />)}</div>
        ) : (
          <div className="card empty">Aún no hay noticias publicadas.</div>
        )}
      </div>
    </section>
  );
}
