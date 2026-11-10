'use client';

import { useActionState } from 'react';
import { deletePropertyAction, type ActionState } from '@/app/actions';

export function AdminDeletePropertyButton({ id, title }: { id: string; title: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deletePropertyAction, {});

  return (
    <div>
      <form
        action={action}
        onSubmit={(event) => {
          const accepted = window.confirm(
            `¿Retirar “${title}” del catálogo? Si tiene contratos, facturas o pagos, quedará archivado para conservar todo el historial.`,
          );
          if (!accepted) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="textButton danger" disabled={pending}>
          {pending ? 'Retirando…' : 'Retirar'}
        </button>
      </form>
      {state.error && <small className="alert error" role="alert">{state.error}</small>}
      {state.success && <small className="alert success" role="status">{state.success}</small>}
    </div>
  );
}
