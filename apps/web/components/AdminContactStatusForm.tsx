'use client';

import { useActionState } from 'react';
import { updateContactStatusAction } from '@/app/actions';
import styles from './AdminWorkspace.module.css';

export function AdminContactStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateContactStatusAction, {});
  return <form className={styles.contactStatus} action={action} aria-busy={pending}>
    <input type="hidden" name="id" value={id} />
    <label>Estado del contacto<select name="status" defaultValue={status} disabled={pending}><option value="NEW">Nuevo</option><option value="REVIEWED">Revisado</option><option value="CLOSED">Cerrado</option></select></label>
    <button type="submit" className="button small" disabled={pending}>{pending ? 'Guardando…' : 'Actualizar estado'}</button>
    {state.error && <p className="alert error" role="alert">{state.error}</p>}
    {state.success && <p className="alert success" role="status">{state.success}</p>}
  </form>;
}
