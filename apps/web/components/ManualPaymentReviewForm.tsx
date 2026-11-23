'use client';

import { createContext, useActionState, useContext, useMemo, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { reviewManualPaymentAction, type ActionState } from '@/app/actions';
import { StatusNotice } from './StatusNotice';

const ReviewContext = createContext<{
  action: (formData: FormData) => void;
  result: ActionState & { paymentId?: string };
} | null>(null);

export function ManualPaymentReviewQueue({ children }: Readonly<{ children: ReactNode }>) {
  const [result, action, pending] = useActionState(reviewManualPaymentAction, {});
  const review = useMemo(() => ({ action, result }), [action, result]);
  return <ReviewContext.Provider value={review}>
    {!pending && result.success && <StatusNotice message={result.success} focusOnRemoval />}
    {children}
  </ReviewContext.Provider>;
}

const decisions = [
  ['CONFIRM', 'Confirmar', 'Confirmando pago…', 'button small'],
  ['REVIEW', 'Solicitar revisión', 'Registrando revisión…', 'button outline small'],
  ['REJECT', 'Rechazar', 'Registrando rechazo…', 'button danger small'],
] as const;

function ReviewActions() {
  const { pending, data } = useFormStatus();
  const decision = data?.get('decision');
  const selected = decisions.find(([value]) => value === decision);
  return <>
    <div className="reviewActions">
      {decisions.map(([value, label, , className]) => <button key={value} type="submit" className={className}
        name="decision" value={value} aria-disabled={pending} aria-busy={pending && decision === value}
        onClick={event => { if (pending) event.preventDefault(); }}>{label}</button>)}
    </div>
    {pending && selected && <StatusNotice message={selected[2]} />}
  </>;
}

export function ManualPaymentReviewForm({ paymentId }: { paymentId: string }) {
  const context = useContext(ReviewContext);
  const [note, setNote] = useState('');
  if (!context) throw new Error('El formulario de revisión requiere la cola de conciliación.');
  return <form className="manualReviewForm" action={context.action}>
    <input type="hidden" name="paymentId" value={paymentId} />
    <label>Nota de revisión<textarea name="note" rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Motivo para rechazo o revisión" /></label>
    <ReviewActions />
    {context.result.paymentId === paymentId && context.result.error && <StatusNotice message={context.result.error} tone="error" />}
  </form>;
}
