import { notFound } from 'next/navigation';
import { ManualPaymentForm } from '@/components/ManualPaymentForm';
import type { ManualPaymentConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

const safePreview: ManualPaymentConfig = {
  mode: 'manual', enabled: false,
  notice: 'Vista local: ningún dato bancario ha sido configurado y no se puede enviar un reporte.',
  methods: [
    ['QR', 'Código QR', 'Realiza el pago desde la aplicación de tu entidad financiera.'],
    ['BREB', 'Bre-B / llave', 'Transfiere con la llave autorizada por la empresa.'],
    ['BANK_TRANSFER', 'Transferencia bancaria', 'Transfiere desde tu banco a la cuenta autorizada.'],
    ['BANK_DEPOSIT', 'Consignación', 'Realiza una consignación y conserva el comprobante.'],
  ].map(([code, title, description]) => ({ code, title, description, enabled: false, details: [] })) as ManualPaymentConfig['methods'],
};

export default function ManualPaymentsLabPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <section className="section pageTop"><div className="container paymentWrap">
    <div className="pageHeading compact"><span className="eyebrow">Laboratorio local</span><h1>Pagos manuales verificables</h1><p>Vista segura del módulo antes de configurar datos financieros autorizados.</p></div>
    <div className="card paymentMainCard"><ManualPaymentForm invoiceId="FAC-LOCAL-PREVIEW" amount={3_920_000} idempotencyKey="local-preview-disabled" config={safePreview} /></div>
  </div></section>;
}
