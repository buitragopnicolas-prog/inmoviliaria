'use client';

import { useActionState } from 'react';
import { reviewManualPaymentAction } from '@/app/actions';

export function ManualPaymentReviewForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(reviewManualPaymentAction, {});
  return <form className="manualReviewForm" action={action}>
    <input type="hidden" name="paymentId" value={paymentId} />
    <label>Nota de revisión<textarea name="note" rows={2} placeholder="Motivo para rechazo o revisión" /></label>
    <div className="reviewActions">
      <button className="button small" name="decision" value="CONFIRM" disabled={pending}>Confirmar</button>
      <button className="button outline small" name="decision" value="REVIEW" disabled={pending}>Solicitar revisión</button>
      <button className="button danger small" name="decision" value="REJECT" disabled={pending}>Rechazar</button>
    </div>
    {state.error && <p className="alert error" role="alert">{state.error}</p>}
    {state.success && <p className="alert success" role="status">{state.success}</p>}
  </form>;
}
