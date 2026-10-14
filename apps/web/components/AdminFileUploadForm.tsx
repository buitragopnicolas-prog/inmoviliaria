'use client';

import { useActionState } from 'react';
import { uploadFilesAction, type ActionState } from '@/app/actions';

export function AdminFileUploadForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadFilesAction, {});
  return (
    <form className="form adminForm card" action={action}>
      <h2>Subir archivos</h2>
      <label>Carpeta lógica <span className="hint">opcional; útil para separar fichas o documentos comerciales</span><input name="folder" placeholder="clientes/documentos" /></label>
      <label>Archivos <span className="hint">cualquier tipo; hasta 20 archivos, 25 MB por archivo y 70 MB en total</span><input type="file" name="files" multiple required /></label>
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Cargando…' : 'Cargar archivos'}</button>
    </form>
  );
}