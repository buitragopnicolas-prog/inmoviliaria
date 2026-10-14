'use client';

import { useActionState } from 'react';
import { createNewsAction, type ActionState } from '@/app/actions';

export function AdminNewsForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createNewsAction, {});
  return (
    <form className="form adminForm card" action={action}>
      <h2>Publicar noticia</h2>
      <div className="twoCols"><label>Título<input name="title" required minLength={5} maxLength={140} /></label><label>Fuente <span className="hint">Opcional: nombre del periódico o portal</span><input name="sourceLabel" maxLength={80} placeholder="Portafolio, El Tiempo, Blog JB" /></label></div>
      <label>Resumen<textarea name="summary" rows={3} required minLength={20} maxLength={280} /></label>
      <label>Contenido<textarea name="content" rows={8} required minLength={30} placeholder="Escribe la noticia o un resumen ampliado para la página interna." /></label>
      <label>Enlace externo <span className="hint">Opcional. Si lo completas, la tarjeta pública abrirá esa noticia en el medio digital.</span><input name="externalUrl" type="url" placeholder="https://..." /></label>
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Publicando…' : 'Publicar noticia'}</button>
    </form>
  );
}