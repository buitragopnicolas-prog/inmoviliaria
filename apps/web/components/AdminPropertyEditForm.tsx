'use client';

import Image from 'next/image';
import { useActionState, useState } from 'react';
import { updatePropertyAction, type ActionState } from '@/app/actions';
import { assetUrl } from '@/lib/format';
import type { Property, TenantOption } from '@/lib/types';
import { PropertyAssignmentFields, type PropertyAssignmentMode } from './PropertyAssignmentFields';

export function AdminPropertyEditForm({ property, tenants }: { property: Property; tenants: TenantOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updatePropertyAction, {});
  const [assignmentMode, setAssignmentMode] = useState<PropertyAssignmentMode>('UNCHANGED');
  const [imageMode, setImageMode] = useState<'KEEP' | 'APPEND' | 'REPLACE' | 'DEFAULT'>('KEEP');
  const [tour360Mode, setTour360Mode] = useState<'KEEP' | 'REPLACE' | 'REMOVE'>('KEEP');
  const currentLease = property.leases?.[0];
  const currentTenantName = currentLease?.tenant?.name ?? currentLease?.user?.name ?? null;

  return (
    <form className="form adminForm card" action={action}>
      <input type="hidden" name="id" value={property.id} />
      <h2>Editar inmueble</h2>

      <div className="twoCols">
        <label>Título<input name="title" defaultValue={property.title} required minLength={1} /></label>
        <label>Ciudad<input name="city" defaultValue={property.city} required /></label>
      </div>
      <div className="twoCols">
        <label>Barrio<input name="neighborhood" defaultValue={property.neighborhood} required /></label>
        <label>Dirección<input name="address" defaultValue={property.address} required /></label>
      </div>
      <label>Descripción<textarea name="description" rows={4} defaultValue={property.description} /></label>
      <div className="threeCols">
        <label>Canon mensual<input name="monthlyRent" type="number" min="0" defaultValue={property.monthlyRent} required /></label>
        <label>Administración<input name="administrationFee" type="number" min="0" defaultValue={property.administrationFee} required /></label>
        <label>Depósito<input name="deposit" type="number" min="0" defaultValue={property.deposit} required /></label>
      </div>
      <div className="fourCols">
        <label>Habitaciones<input name="bedrooms" type="number" min="0" defaultValue={property.bedrooms} required /></label>
        <label>Baños<input name="bathrooms" type="number" min="0" defaultValue={property.bathrooms} required /></label>
        <label>Área m²<input name="areaM2" type="number" min="0" step="0.01" defaultValue={property.areaM2} required /></label>
        <label>Parqueaderos<input name="parking" type="number" min="0" defaultValue={property.parking} required /></label>
      </div>
      <label>Características <span className="hint">separadas por coma</span><input name="features" defaultValue={property.features.join(', ')} /></label>
      <div className="twoCols">
        <label>Video<input name="videoUrl" type="url" defaultValue={property.videoUrl ?? ''} placeholder="https://..." /></label>
        <label>
          Publicación
          <select name="published" defaultValue={String(property.published)}>
            <option value="true">Publicado</option>
            <option value="false">Oculto</option>
          </select>
        </label>
      </div>

      <fieldset className="formSection">
        <legend>Fotografías</legend>
        <div className="editImageGrid">
          {property.images.map((image) => (
            <div className="editImageItem" key={image.id}>
              <Image src={assetUrl(image.url)} alt={image.alt} fill sizes="140px" />
            </div>
          ))}
        </div>
        <label>
          Qué hacer con las fotografías
          <select name="imageMode" value={imageMode} onChange={(event) => setImageMode(event.target.value as typeof imageMode)}>
            <option value="KEEP">Conservar las actuales</option>
            <option value="APPEND">Agregar nuevas</option>
            <option value="REPLACE">Reemplazar todas</option>
            <option value="DEFAULT">Eliminar y usar imagen predeterminada</option>
          </select>
        </label>
        {(imageMode === 'APPEND' || imageMode === 'REPLACE') && (
          <label>
            Nuevas fotografías
            <input type="file" accept="image/jpeg,image/png,image/webp" name="photos" multiple required />
            <span className="hint">JPG, PNG o WEBP; máximo 10 archivos de 5 MB.</span>
          </label>
        )}
      </fieldset>

      <fieldset className="formSection">
        <legend>Foto 360</legend>
        <p className="hint">{property.tour360Url ? 'El inmueble tiene una foto 360 configurada.' : 'El inmueble no tiene foto 360.'}</p>
        <label>
          Qué hacer con la foto 360
          <select name="tour360Mode" value={tour360Mode} onChange={(event) => setTour360Mode(event.target.value as typeof tour360Mode)}>
            <option value="KEEP">Conservar</option>
            <option value="REPLACE">Reemplazar</option>
            <option value="REMOVE">Eliminar</option>
          </select>
        </label>
        {tour360Mode === 'REPLACE' && (
          <label>Nueva foto 360<input name="tour360" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
        )}
      </fieldset>

      <PropertyAssignmentFields
        tenants={tenants}
        mode={assignmentMode}
        onModeChange={setAssignmentMode}
        allowUnchanged
        currentTenantName={currentTenantName}
        defaultExpectedPayment={currentLease?.expectedMonthlyPayment}
        defaultStartDate={currentLease?.startDate}
        defaultEndDate={currentLease?.endDate}
      />

      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
    </form>
  );
}
