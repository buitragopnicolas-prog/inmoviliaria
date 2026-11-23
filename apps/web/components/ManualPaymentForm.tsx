'use client';

import { useActionState, useState } from 'react';
import { reportManualPaymentAction } from '@/app/actions';
import type { ManualPaymentConfig, ManualPaymentMethodCode } from '@/lib/types';
import { pesos } from '@/lib/format';
import { ConsentField, usePublishedPolicy } from './ConsentField';
import { StatusNotice } from './StatusNotice';

export function ManualPaymentForm({ invoiceId, amount, idempotencyKey, config }: { invoiceId: string; amount: number; idempotencyKey: string; config: ManualPaymentConfig }) {
  const firstEnabled = config.methods.find((method) => method.enabled)?.code;
  const [selected, setSelected] = useState<ManualPaymentMethodCode | undefined>(firstEnabled);
  const [bankReference, setBankReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const policy=usePublishedPolicy();
  const [state, action, pending] = useActionState(reportManualPaymentAction, {});
  const selectedMethod = config.methods.find((method) => method.code === selected);

  return <div className="manualPaymentFlow">
    <div className="paymentSectionHeading"><div><span className="eyebrow">Medios autorizados</span><h2>Elige cómo realizar tu pago</h2></div><span className="secureLabel">Verificación administrativa</span></div>
    <div className="paymentMethods" role="radiogroup" aria-label="Medio de pago">
      {config.methods.map((method) => <label className={`paymentMethod ${selected === method.code ? 'selected' : ''} ${!method.enabled ? 'disabled' : ''}`} key={method.code}>
        <input type="radio" name="methodSelector" value={method.code} checked={selected === method.code} disabled={!method.enabled || pending} onChange={() => setSelected(method.code)} />
        <span className="paymentMethodMark" aria-hidden="true">{method.code === 'QR' ? '▦' : method.code === 'BREB' ? 'B' : method.code === 'BANK_TRANSFER' ? '↗' : '▤'}</span>
        <strong>{method.title}</strong><small>{method.enabled ? method.description : 'Pendiente de configuración'}</small>
      </label>)}
    </div>

    {!config.enabled && <p className="alert warning">Los datos bancarios autorizados todavía no están configurados. No realices pagos usando información recibida por canales no verificados.</p>}
    {selectedMethod?.enabled && <div key={selectedMethod.code} className="paymentInstructions">
      <div><span className="stepNumber">1</span><h3>Realiza el pago</h3></div>
      {selectedMethod.qrImageUrl && <img className="paymentQr" src={selectedMethod.qrImageUrl} alt="Código QR autorizado para realizar el pago" />}
      <dl>{selectedMethod.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
      {selectedMethod.instructions && <p>{selectedMethod.instructions}</p>}
      <div className="paymentConcept"><span>Concepto</span><strong>{invoiceId}</strong><span>Valor exacto</span><strong>{pesos(amount)}</strong></div>
    </div>}

    {selectedMethod?.enabled && <form className="form paymentReportForm" action={action}
      onSubmit={event => { if (pending || state.success) event.preventDefault(); }}>
      <div className="formStep"><span className="stepNumber">2</span><div><h3>Reporta el pago realizado</h3><p>Este reporte quedará pendiente hasta que el equipo confirme el movimiento.</p></div></div>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="method" value={selectedMethod.code} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="twoCols">
        <label>Referencia bancaria<input name="bankReference" value={bankReference} onChange={event => setBankReference(event.target.value)} minLength={3} maxLength={100} required autoComplete="off" readOnly={pending} /></label>
        <label>Fecha y hora del pago<input type="datetime-local" name="paidAt" value={paidAt} onChange={event => setPaidAt(event.target.value)} required max={new Date().toISOString().slice(0, 16)} readOnly={pending} /></label>
      </div>
      <label>Comprobante (opcional)<input type="file" name="receipt" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" /><span className="hint">JPG, PNG o PDF. Máximo 8 MB.</span></label>
      <ConsentField purpose="verificar mi soporte y conciliar el pago"/>
      {!pending && state.error && <StatusNotice message={state.error} tone="error" />}
      {!pending && state.success && <StatusNotice message={state.success} />}
      <button type="submit" className="button wide" aria-busy={pending} aria-disabled={pending} disabled={!policy.version || Boolean(state.success)}>{pending ? 'Enviando reporte…' : 'Ya realicé el pago'}</button>
      <p className="paymentNotice">{config.notice}</p>
    </form>}
  </div>;
}
