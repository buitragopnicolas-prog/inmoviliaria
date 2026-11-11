import Link from 'next/link';
import { adminListHref, type AdminQuery } from '@/lib/admin-lists';
import styles from './AdminWorkspace.module.css';

export function AdminListControls({ path, query, placeholder, statuses = [] }: Readonly<{
  path: string; query: AdminQuery; placeholder: string; statuses?: Array<[string, string]>;
}>) {
  return <form key={`${query.buscar}:${query.estado}`} className={styles.listControls} action={path} method="get" role="search" aria-label="Filtrar registros">
    <label className={styles.searchField}>Buscar registros<input type="search" name="buscar" defaultValue={query.buscar} placeholder={placeholder} /></label>
    {statuses.length > 0 && <label>Estado<select name="estado" defaultValue={query.estado}><option value="">Todos los estados</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <button className="button small" type="submit">Filtrar</button>
    {(query.buscar || query.estado) && <Link className="button ghost small" href={path}>Limpiar filtros</Link>}
  </form>;
}

export function AdminPagination({ path, query, page, pages, total, pageSize }: Readonly<{
  path: string; query: AdminQuery; page: number; pages: number; total: number; pageSize: number;
}>) {
  return <nav className={styles.pagination} aria-label="Páginas de resultados">
    <p>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total} registros` : '0 registros'}</p>
    {pages > 1 && <div>
      {page > 1 ? <Link className="button ghost small" href={adminListHref(path, query, page - 1)}>Anterior</Link> : <span className={styles.disabledPage}>Anterior</span>}
      <span aria-current="page">{page} de {pages}</span>
      {page < pages ? <Link className="button ghost small" href={adminListHref(path, query, page + 1)}>Siguiente</Link> : <span className={styles.disabledPage}>Siguiente</span>}
    </div>}
  </nav>;
}

export function AdminEmptyState({ filtered, noun }: Readonly<{ filtered: boolean; noun: string }>) {
  return <output className={styles.emptyState}><strong>{filtered ? 'No encontramos coincidencias' : `Todavía no hay ${noun}`}</strong><span>{filtered ? 'Prueba con otro término o limpia los filtros para ver todos los registros.' : 'Los registros aparecerán aquí cuando se agreguen.'}</span></output>;
}
