import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { fecha } from '@/lib/format';
import type { NewsPost } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getNewsPost(slug: string): Promise<NewsPost> {
  try {
    return await apiFetch<NewsPost>(`/news/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const newsPost = await getNewsPost(slug);
  return { title: newsPost.title, description: newsPost.summary };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const newsPost = await getNewsPost(slug);
  const paragraphs = newsPost.content.split(/\r?\n\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const sourceLabel = newsPost.sourceLabel?.trim() || 'Asesoría Inmobiliaria JB';
  return (
    <section className="section pageTop">
      <div className="container">
        <article className="newsArticle card">
          <span className="eyebrow">Noticias</span>
          <div className="newsMeta"><strong>{sourceLabel}</strong><span>{fecha(newsPost.createdAt)}</span></div>
          <h1>{newsPost.title}</h1>
          <p className="newsSummary">{newsPost.summary}</p>
          <div className="newsParagraphs">{paragraphs.map((paragraph, index) => <p key={`${newsPost.id}-${index}`}>{paragraph}</p>)}</div>
          <div className="detailActions">
            <Link className="button ghost small" href="/noticias">Volver a noticias</Link>
            {newsPost.externalUrl && <a className="button small" href={newsPost.externalUrl} rel="noreferrer noopener" target="_blank">Abrir fuente original</a>}
          </div>
        </article>
      </div>
    </section>
  );
}
