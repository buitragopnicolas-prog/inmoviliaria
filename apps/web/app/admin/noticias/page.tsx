import type { Metadata } from 'next';
import { AdminTableRegion } from '@/components/AdminTableRegion';
import { AdminNewsForm } from '@/components/AdminNewsForm';
import { archiveNewsAction } from '@/app/actions';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { fecha } from '@/lib/format';
import type { NewsPost } from '@/lib/types';
import { AdminCreatePanel } from '@/components/AdminCreatePanel';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminMatches, paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';

export const metadata: Metadata = { title: 'Administrar noticias' };
export const dynamic = 'force-dynamic';

export default async function AdminNewsPage({ searchParams }: Readonly<{ searchParams?: Promise<AdminSearchParams> }>) {
  await requireUser('ADMIN');
  const params = await searchParams;
  const query = readAdminQuery(params);
  const news = await apiFetch<NewsPost[]>('/admin/news', {}, true);
  const result = paginateAdmin(news.filter((post) => (!query.estado || (post.published ? 'PUBLISHED' : 'HIDDEN') === query.estado) && adminMatches(query.buscar, post.title, post.sourceLabel, post.summary)), query.pagina);
  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Noticias</h1><p>Publica noticias propias o enlaza artículos de periódicos digitales para el sitio público.</p></div>
      <AdminCreatePanel title="Publicar noticia" description="Comparte una novedad propia o un artículo de prensa." open={params?.crear === '1'}><AdminNewsForm /></AdminCreatePanel>
      <div className="card tableCard"><div className="tableTitle"><h2>Publicaciones</h2><span>{news.length} registros</span></div>
        <AdminListControls path="/admin/noticias" query={query} placeholder="Titular, fuente o contenido" statuses={[[ 'PUBLISHED', 'Publicada' ], ['HIDDEN', 'Oculta']]} />
        {result.total > 0 ? <AdminTableRegion label="Noticias publicadas y ocultas"><table><thead><tr><th scope="col">Titular</th><th scope="col">Fuente</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{result.items.map((newsPost) => <tr key={newsPost.id}>
          <td>{newsPost.title}</td><td>{newsPost.sourceLabel || (newsPost.externalUrl ? 'Prensa digital' : 'Asesoría Inmobiliaria JB')}</td><td>{fecha(newsPost.createdAt)}</td><td><span className={`status ${newsPost.published ? 'published' : 'archived'}`}>{newsPost.published ? 'Publicada' : 'Oculta'}</span></td><td>{newsPost.published && <form action={archiveNewsAction}><input type="hidden" name="id" value={newsPost.id} /><button type="submit" className="textButton">Ocultar</button></form>}</td>
        </tr>)}</tbody></table></AdminTableRegion> : <AdminEmptyState filtered={Boolean(query.buscar || query.estado)} noun="noticias" />}
        <AdminPagination path="/admin/noticias" query={query} {...result} />
      </div>
    </>
  );
}
