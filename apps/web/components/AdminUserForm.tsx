'use client';

import { useActionState } from 'react';
import { createAdminUserAction, type ActionState } from '@/app/actions';

export function AdminUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createAdminUserAction, {});

  return (
    <form className="form card adminForm" action={action}>
      <h2>Crear usuario</h2>
      <p className="muted">Crea un perfil administrativo para asignarle inmuebles, cobros y pagos. La cuenta de acceso web puede vincularse después usando el mismo correo.</p>
      <div className="twoCols">
        <label>Nombre completo<input name="name" required minLength={3} /></label>
        <label>Documento<input name="documentNumber" /></label>
      </div>
      <div className="twoCols">
        <label>Correo<input name="email" type="email" /></label>
        <label>Teléfono<input name="phone" /></label>
      </div>
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Creando…' : 'Crear usuario'}</button>
    </form>
  );
}
