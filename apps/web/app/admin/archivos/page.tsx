import type { Metadata } from 'next';
import { AdminFileUploadForm } from '@/components/AdminFileUploadForm';
import { apiFetch } from '@/lib/api';
import { fecha, publicApiUrl, tamanoArchivo } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { StoredFile } from '@/lib/types';
import { AdminCreatePanel } from '@/components/AdminCreatePanel';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminMatches, paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';

export const metadata: Metadata = { title: 'Archivos públicos' };
export const dynamic = 'force-dynamic';

export default async function AdminFilesPage({ searchParams }: { searchParams?: Promise<AdminSearchParams> }) {
  await requireUser('ADMIN');
  const params = await searchParams;
  const query = readAdminQuery(params);
  const files = await apiFetch<StoredFile[]>('/admin/files', {}, true);
  const result = paginateAdmin(files.filter((file) => adminMatches(query.buscar, file.originalName, file.mimeType, file.createdBy?.name)), query.pagina);
  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Archivos públicos</h1><p>Organiza documentos comerciales y comparte sus enlaces con clientes. Los archivos de esta biblioteca son públicos.</p></div>
      <AdminCreatePanel title="Subir archivos" description="Agrega documentos públicos a la biblioteca." open={params?.crear === '1'}><AdminFileUploadForm /></AdminCreatePanel>
      <div className="card tableCard"><div className="tableTitle"><h2>Biblioteca</h2><span>{files.length} registros</span></div>
        <AdminListControls path="/admin/archivos" query={query} placeholder="Nombre del archivo, tipo o responsable" />
        {result.total > 0 ? <div className="responsiveTable" role="region" aria-label="Biblioteca de archivos públicos" tabIndex={0}><table><thead><tr><th scope="col">Archivo</th><th scope="col">Tipo</th><th scope="col">Tamaño</th><th scope="col">Fecha</th><th scope="col">Acciones</th></tr></thead><tbody>{result.items.map((file) => {
          const url = `${publicApiUrl()}${file.publicPath}`;
          const downloadUrl = `${publicApiUrl()}${file.downloadPath ?? `${file.publicPath}?download=1`}`;
          return <tr key={file.id}>
            <td><strong>{file.originalName}</strong>{file.createdBy && <small className="tableHint">Por {file.createdBy.name}</small>}</td>
            <td>{file.mimeType}</td><td>{tamanoArchivo(file.size)}</td><td>{fecha(file.createdAt)}</td><td><a className="textLink" href={url} target="_blank" rel="noreferrer">Abrir</a> · <a className="textLink" href={downloadUrl} target="_blank" rel="noreferrer">Descargar</a></td>
          </tr>;
        })}</tbody></table></div> : <AdminEmptyState filtered={Boolean(query.buscar)} noun="archivos públicos" />}
        <AdminPagination path="/admin/archivos" query={query} {...result} />
      </div>
    </>
  );
}
