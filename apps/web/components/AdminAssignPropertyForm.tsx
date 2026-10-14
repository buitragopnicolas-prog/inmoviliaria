'use client';

import { useActionState, useState } from 'react';
import { assignPropertyToUserAction, type ActionState } from '@/app/actions';
import { pesos } from '@/lib/format';
import type { Property } from '@/lib/types';

export function AdminAssignPropertyForm({ userId, properties }: { userId: string; properties: Property[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(assignPropertyToUserAction, {});
  const [propertyId, setPropertyId] = useState('');
  const [expectedPayment, setExpectedPayment] = useState('');
  const today = new Date();
  const due = new Date();
  due.setDate(due.getDate() + 5);

  return (
    <form className="form card adminForm" action={action}>
      <h2>Asignar inmueble</h2>
      <p className="muted">Al guardar, el inmueble cambia a arrendado y deja de aparecer en el catálogo de disponibles.</p>
      <input type="hidden" name="userId" value={userId} />
      <label>
        Inmueble disponible
        <select name="propertyId" required value={propertyId} onChange={(event) => {
          const nextId = event.target.value;
          setPropertyId(nextId);
          const property = properties.find((item) => item.id === nextId);
          setExpectedPayment(property ? String(property.monthlyRent) : '');
        }}>
          <option value="">Seleccione un inmueble…</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.title} · {property.address} · {pesos(property.monthlyRent)}
            </option>
          ))}
        </select>
      </label>
      {properties.length === 0 && <p className="alert error">No hay inmuebles disponibles para asignar.</p>}
      <div className="threeCols">
        <label>Inicio del contrato<input name="leaseStartDate" type="date" defaultValue={dateInput(today)} /></label>
        <label>Fin del contrato<input name="leaseEndDate" type="date" /></label>
        <label>Valor mensual<input name="expectedMonthlyPayment" type="number" min="0" value={expectedPayment} onChange={(event) => setExpectedPayment(event.target.value)} placeholder="Seleccione un inmueble" /></label>
      </div>
      <fieldset className="formSection">
        <legend>Cobro inicial</legend>
        <label className="checkLabel"><input type="checkbox" name="createCurrentInvoice" value="true" defaultChecked /> Crear factura del periodo actual</label>
        <label>Fecha de vencimiento<input name="invoiceDueDate" type="date" defaultValue={dateInput(due)} /></label>
        <p className="hint">La factura permite ver de inmediato si el usuario tiene saldo pendiente y conservar el historial cuando pague.</p>
      </fieldset>
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending || properties.length === 0}>{pending ? 'Asignando…' : 'Asignar inmueble'}</button>
    </form>
  );
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
