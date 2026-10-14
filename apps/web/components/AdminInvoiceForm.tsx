'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { createInvoiceAction, type ActionState } from '@/app/actions';
import { pesos } from '@/lib/format';
import type { ChargeCatalogItem, Lease } from '@/lib/types';

interface DraftLine {
  itemId: string;
  quantity: number;
}

export function AdminInvoiceForm({
  leases,
  services,
  products,
}: {
  leases: Lease[];
  services: ChargeCatalogItem[];
  products: ChargeCatalogItem[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createInvoiceAction, {});
  const [serviceDraft, setServiceDraft] = useState<DraftLine[]>([]);
  const [productDraft, setProductDraft] = useState<DraftLine[]>([]);
  const [serviceItemId, setServiceItemId] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [productItemId, setProductItemId] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);

  const catalogById = useMemo(() => {
    const map = new Map<string, ChargeCatalogItem>();
    for (const item of [...services, ...products]) map.set(item.id, item);
    return map;
  }, [products, services]);

  const serviceTotal = serviceDraft.reduce((sum, line) => {
    const item = catalogById.get(line.itemId);
    return sum + (item ? item.unitPrice * line.quantity : 0);
  }, 0);
  const productTotal = productDraft.reduce((sum, line) => {
    const item = catalogById.get(line.itemId);
    return sum + (item ? item.unitPrice * line.quantity : 0);
  }, 0);

  function addDraftItem(
    kind: 'service' | 'product',
    itemId: string,
    quantity: number,
  ): void {
    if (!itemId) return;
    const numericQuantity = Number(quantity);
    const safeQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0 ? Math.floor(numericQuantity) : 1;
    const setter = kind === 'service' ? setServiceDraft : setProductDraft;
    setter((current) => {
      const found = current.find((line) => line.itemId === itemId);
      if (found) {
        return current.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + safeQuantity } : line));
      }
      return [...current, { itemId, quantity: safeQuantity }];
    });
    if (kind === 'service') {
      setServiceItemId('');
      setServiceQuantity(1);
      return;
    }
    setProductItemId('');
    setProductQuantity(1);
  }

  function removeDraftItem(kind: 'service' | 'product', itemId: string): void {
    const setter = kind === 'service' ? setServiceDraft : setProductDraft;
    setter((current) => current.filter((line) => line.itemId !== itemId));
  }

  return (
    <form className="form card adminForm" action={action}>
      <h2>Generar factura</h2>
      <label>Contrato<select name="leaseId" required><option value="">Seleccione</option>{leases.map((lease) => <option value={lease.id} key={lease.id}>{lease.user?.name ?? lease.tenant?.name ?? 'Sin arrendatario'} — {lease.property.title}</option>)}</select></label>
      <div className="twoCols"><label>Periodo<input type="date" name="period" required /></label><label>Vencimiento<input type="date" name="dueDate" required /></label></div>

      <div className="card" style={{ padding: 16 }}>
        <h3>Servicios cobrados</h3>
        <p className="muted">Seleccione cada servicio desde el catálogo del sistema.</p>
        <div className="threeCols">
          <label>Servicio<select value={serviceItemId} onChange={(event) => setServiceItemId(event.target.value)}><option value="">Seleccione</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} ({pesos(item.unitPrice)})</option>)}</select></label>
          <label>Cantidad<input type="number" min={1} value={serviceQuantity} onChange={(event) => setServiceQuantity(Number(event.target.value))} /></label>
          <button type="button" className="button ghost" onClick={() => addDraftItem('service', serviceItemId, serviceQuantity)}>Agregar servicio</button>
        </div>
        {serviceDraft.length > 0 && <ul className="adminList">{serviceDraft.map((line) => {
          const item = catalogById.get(line.itemId);
          if (!item) return null;
          return <li key={line.itemId}><span>{item.name} x {line.quantity} = {pesos(item.unitPrice * line.quantity)}</span><button type="button" className="button ghost small" onClick={() => removeDraftItem('service', line.itemId)}>Quitar</button></li>;
        })}</ul>}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <h3>Productos a cobrar</h3>
        <p className="muted">Agregue productos adicionales desde el catálogo del sistema.</p>
        <div className="threeCols">
          <label>Producto<select value={productItemId} onChange={(event) => setProductItemId(event.target.value)}><option value="">Seleccione</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} ({pesos(item.unitPrice)})</option>)}</select></label>
          <label>Cantidad<input type="number" min={1} value={productQuantity} onChange={(event) => setProductQuantity(Number(event.target.value))} /></label>
          <button type="button" className="button ghost" onClick={() => addDraftItem('product', productItemId, productQuantity)}>Agregar producto</button>
        </div>
        {productDraft.length > 0 && <ul className="adminList">{productDraft.map((line) => {
          const item = catalogById.get(line.itemId);
          if (!item) return null;
          return <li key={line.itemId}><span>{item.name} x {line.quantity} = {pesos(item.unitPrice * line.quantity)}</span><button type="button" className="button ghost small" onClick={() => removeDraftItem('product', line.itemId)}>Quitar</button></li>;
        })}</ul>}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <strong>Total calculado automáticamente: {pesos(serviceTotal + productTotal)}</strong>
      </div>

      <input type="hidden" name="services" value={JSON.stringify(serviceDraft)} />
      <input type="hidden" name="products" value={JSON.stringify(productDraft)} />
      {state.error && <p className="alert error">{state.error}</p>}
      {state.success && <p className="alert success">{state.success}</p>}
      <button type="submit" className="button" disabled={pending}>{pending ? 'Generando…' : 'Crear factura'}</button>
    </form>
  );
}
