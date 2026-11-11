export type AdminSearchParams = Record<string, string | string[] | undefined>;
export type AdminQuery = { buscar: string; estado: string; pagina: number };

export function readAdminQuery(params: AdminSearchParams = {}): AdminQuery {
  const single = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';
  const page = Number(single(params.pagina));
  return {
    buscar: single(params.buscar).trim(),
    estado: single(params.estado),
    pagina: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function adminMatches(query: string, ...values: Array<string | null | undefined>): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const text = normalize(values.filter((value) => value != null).join(' '));
  return normalize(query).split(/\s+/).every((word) => text.includes(word));
}

export function paginateAdmin<T>(items: T[], requestedPage: number, pageSize = 15) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pages, pageSize };
}

export function adminListHref(path: string, query: AdminQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.buscar) params.set('buscar', query.buscar);
  if (query.estado) params.set('estado', query.estado);
  if (page > 1) params.set('pagina', String(page));
  return params.size ? `${path}?${params.toString()}` : path;
}

const labels: Record<string, string> = {
  AVAILABLE: 'Disponible', RENTED: 'Arrendado', ARCHIVED: 'Archivado',
  PENDING: 'Pendiente', OVERDUE: 'Vencida', PAID: 'Pagada', VOID: 'Anulada',
  NEW: 'Nuevo', REVIEWED: 'Revisado', CLOSED: 'Cerrado',
  RECEIVED: 'Recibida', MATCHED: 'Conciliada', REVIEW_REQUIRED: 'Requiere revisión',
  REJECTED: 'Rechazado', DUPLICATE: 'Duplicada', ERROR: 'Error',
  PROCESSING: 'En proceso', COMPLETED: 'Completada', COMPLETED_WITH_REVIEW: 'Completada con revisión', FAILED: 'Fallida',
  AWAITING_VERIFICATION: 'Por verificar', UNDER_REVIEW: 'En revisión', APPROVED: 'Aprobado',
  DECLINED: 'Rechazado', EXPIRED: 'Vencido', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado', VOIDED: 'Anulado',
};

export function adminStatusLabel(status: string): string {
  return labels[status] ?? 'Sin clasificar';
}
