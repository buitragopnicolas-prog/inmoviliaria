import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { fecha } from '@/lib/format';
import { requireUser } from '@/lib/auth';
import type { ContactMessage } from '@/lib/types';
import { AdminEmptyState, AdminListControls, AdminPagination } from '@/components/AdminListControls';
import { adminMatches, adminStatusLabel, paginateAdmin, readAdminQuery, type AdminSearchParams } from '@/lib/admin-lists';
import styles from '@/components/AdminWorkspace.module.css';
import { AdminContactStatusForm } from '@/components/AdminContactStatusForm';

export const metadata: Metadata = { title: 'Contactos recibidos' };
export const dynamic = 'force-dynamic';

export default async function AdminContactsPage({ searchParams }: Readonly<{ searchParams?: Promise<AdminSearchParams> }>) {
  await requireUser('ADMIN');
  const query = readAdminQuery(await searchParams);
  const messages = await apiFetch<ContactMessage[]>('/admin/contacts', {}, true);
  const result = paginateAdmin(messages.filter((message) => (!query.estado || message.status === query.estado) && adminMatches(query.buscar, message.name, message.email, message.phone, message.subject, message.message)), query.pagina);
  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración</span><h1>Solicitudes de contacto</h1><p>Revisa los mensajes enviados desde el sitio.</p></div>
      <div className="card tableCard"><div className="tableTitle"><h2>Bandeja de contactos</h2><span>{messages.length} mensajes</span></div>
        <AdminListControls path="/admin/contactos" query={query} placeholder="Nombre, correo, asunto o mensaje" statuses={[[ 'NEW', 'Nuevo' ], ['REVIEWED', 'Revisado'], ['CLOSED', 'Cerrado']]} />
        <div className="messages">{result.items.map((message) => <article className="card message" key={message.id}><div><span className={`status ${message.status === 'NEW' ? 'pending' : 'archived'}`}>{adminStatusLabel(message.status)}</span><time dateTime={message.createdAt}>{fecha(message.createdAt)}</time></div><h2>{message.subject}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{message.message}</p><footer>{message.name} · {message.email}{message.phone ? ` · ${message.phone}` : ''}</footer><div className={styles.messageActions}><a className="button outline small" href={`mailto:${message.email}?subject=${encodeURIComponent('Re: ' + message.subject)}`}>Responder por correo</a>{message.phone && /^[+\d\s().-]+$/.test(message.phone) && <a className="button ghost small" href={`tel:${message.phone.replace(/[^+\d]/g, '')}`}>Llamar</a>}</div><AdminContactStatusForm id={message.id} status={message.status} /></article>)}</div>
        {result.total === 0 && <AdminEmptyState filtered={Boolean(query.buscar || query.estado)} noun="mensajes" />}
        <AdminPagination path="/admin/contactos" query={query} {...result} />
      </div>
    </>
  );
}
