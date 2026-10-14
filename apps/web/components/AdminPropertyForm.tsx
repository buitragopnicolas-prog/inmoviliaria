'use client';

import { useActionState, useState } from 'react';
import { createPropertyAction, type ActionState } from '@/app/actions';
import { PropertyAssignmentFields, type PropertyAssignmentMode } from './PropertyAssignmentFields';
import type { TenantOption } from '@/lib/types';

export function AdminPropertyForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPropertyAction, {});
  const [assignmentMode, setAssignmentMode] = useState<PropertyAssignmentMode>('NONE');

  return (
    <form className="form adminForm card" action={action}>
      <h2>Publicar inmueble</h2>
      <div className="twoCols"><label>Título<input name="title" required /></label><label>Ciudad<input name="city" defaultValue="Bogotá" required /></label></div>
      <div className="twoCols"><label>Barrio<input name="neighborhood" required /></label><label>Dirección<input name="address" required /></label></div>
      <label>Descripción<textarea name="description" rows={4} required minLength={30} /></label>
      <div className="threeCols">
        <label>Canon mensual<input name="monthlyRent" type="number" min="1" required /></label>
        <label>Administración<input name="administrationFee" type="number" min="0" defaultValue="0" required /></label>
        <label>Depósito<input name="deposit" type="number" min="0" defaultValue="0" required /></label>
      </div>
      <div className="fourCols">
        <label>Habitaciones<input name="bedrooms" type="number" min="0" required /></label><label>Baños<input name="bathrooms" type="number" min="0" required /></label><label>Área m²<input name="areaM2" type="number" min="1" required /></label><label>Parqueaderos<input name="parking" type="number" min="0" defaultValue="0" required /></label>
      </div>
      <label>Características <span className="hint">separadas por coma</span><input name="features" placeholder="Balcón, vigilancia, pet friendly" /></label>
      <label>
        Fotografías <span className="hint">Opcionales. Si no subes ninguna, se mostrará automáticamente una imagen predeterminada. JPG, PNG o WEBP; máximo 10 archivos de 5 MB.</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" name="photos" multiple />
      </label>
      <div className="twoCols">
        <label>Foto 360 <span className="hint">Opcional; máximo 15 MB</span><input name="tour360" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label>Video <span className="hint">URL de YouTube, Vimeo o archivo MP4/WebM</span><input name="videoUrl" type="url" placeholder="https://..." /></label>
      </div>

      <PropertyAssignmentFields
        tenants={tenants}
        mode={assignmentMode}
        onModeChange={setAssignmentMode}
      />

      <input type="hidden" name="published" value="true" />
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Publicando…' : 'Publicar inmueble'}</button>
    </form>
  );
}
