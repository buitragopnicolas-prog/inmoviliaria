import Link from 'next/link';
import { fecha } from '@/lib/format';
import type { NewsPost } from '@/lib/types';

export function NewsCard({ newsPost, brand = 'Asesoría Inmobiliaria JB' }: Readonly<{ newsPost: NewsPost; brand?: string }>) {
  const externalUrl = newsPost.externalUrl?.trim();
  const href = `/noticias/${newsPost.slug}`;
  const sourceLabel = newsPost.sourceLabel?.trim() || (externalUrl ? 'Prensa digital' : brand);
  const content = (
    <>
      <div className="newsMeta"><strong>{sourceLabel}</strong><span>{fecha(newsPost.createdAt)}</span></div>
      <div className="newsBody">{newsPost.category && <small>{newsPost.category}</small>}<h3>{newsPost.title}</h3><p>{newsPost.summary.length>280?newsPost.summary.slice(0,277)+'…':newsPost.summary}</p></div>
      <span className="newsCta">Leer publicación →</span>
    </>
  );

  return (
    <Link id={`noticia-${newsPost.id}`} className="newsCard card" href={href}>
      {content}
    </Link>
  );
}
