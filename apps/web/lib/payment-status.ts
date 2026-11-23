const labels = new Map([
  ['PENDING', 'Pago pendiente'],
  ['AWAITING_VERIFICATION', 'Pendiente de verificación'],
  ['UNDER_REVIEW', 'Pago en revisión'],
  ['APPROVED', 'Pago aprobado'],
  ['REJECTED', 'Pago rechazado'],
  ['DECLINED', 'Pago declinado'],
  ['EXPIRED', 'Pago vencido'],
  ['CANCELLED', 'Pago cancelado'],
  ['REFUNDED', 'Pago reembolsado'],
  ['VOIDED', 'Pago anulado'],
  ['ERROR', 'Error en el pago'],
]);

export function paymentStatusLabel(status: string) {
  return labels.get(status) ?? 'Estado del pago por verificar';
}

export function paymentAccountHref(reference: string) {
  return `/mi-cuenta?referencia=${encodeURIComponent(reference)}`;
}
