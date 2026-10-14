import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
import { AdminNewsForm } from '@/components/AdminNewsForm';
import { archiveNewsAction } from '@/app/actions';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { fecha } from '@/lib/format';
import type { NewsPost } from '@/lib/types';

export const metadata: Metadata = { title: 'Administrar noticias' };
export const dynamic = 'force-dynamic';

export default async function AdminNewsPage() {
  await requireUser('ADMIN');
  const news = await apiFetch<NewsPost[]>('/admin/news', {}, true);
  return (
    <section className="section pageTop"><div className="container adminLayout"><AdminNav /><div className="adminContent">
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Noticias</h1><p>Publica noticias propias o enlaza artículos de periódicos digitales para el sitio público.</p></div>
      <AdminNewsForm />
      <div className="card tableCard"><div className="tableTitle"><h2>Publicaciones</h2><span>{news.length} registros</span></div>
        <div className="responsiveTable"><table><thead><tr><th>Titular</th><th>Fuente</th><th>Fecha</th><th>Estado</th><th /></tr></thead><tbody>{news.map((newsPost) => <tr key={newsPost.id}>
          <td>{newsPost.title}</td><td>{newsPost.sourceLabel || (newsPost.externalUrl ? 'Prensa digital' : 'Asesoría Inmobiliaria JB')}</td><td>{fecha(newsPost.createdAt)}</td><td><span className={`status ${newsPost.published ? 'published' : 'archived'}`}>{newsPost.published ? 'Publicada' : 'Oculta'}</span></td><td>{newsPost.published && <form action={archiveNewsAction}><input type="hidden" name="id" value={newsPost.id} /><button type="submit" className="textButton">Ocultar</button></form>}</td>
        </tr>)}</tbody></table></div>
      </div>
    </div></div></section>
  );
}