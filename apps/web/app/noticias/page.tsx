import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { loadPublicData } from '@/lib/public-data';
import { DataUnavailable } from '@/components/DataUnavailable';
import type { NewsPost } from '@/lib/types';
import { NewsCard } from '@/components/NewsCard';

export const metadata: Metadata = { title: 'Boletín jurídico y noticias' };
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const [news, { catalogos, identidad }] = await Promise.all([loadPublicData<NewsPost[]>('/news'), readSite()]);
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading"><h1>{catalogos.articleTitle}</h1><p>{catalogos.articleIntro}</p></div>
        {news === null ? <DataUnavailable label="las noticias" /> : news.length > 0 ? (
          <>{[false,true].map(external=>{const posts=news.filter(post=>Boolean(post.externalUrl)===external); return posts.length>0 && <section key={String(external)}><h2>{external?catalogos.pressTitle:identidad.name}</h2><div className="cardsGrid newsGrid">{posts.map(newsPost=><NewsCard key={newsPost.id} brand={identidad.name} newsPost={newsPost}/>)}</div></section>;})}</>
        ) : (
          <div className="card empty">{catalogos.emptyArticles}</div>
        )}
      </div>
    </section>
  );
}
