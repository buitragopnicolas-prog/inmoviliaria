import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Visualizar contrato' };
export const dynamic = 'force-dynamic';

export default async function AdminContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser('ADMIN');
  const { id } = await params;
  return (
    <>
      <div className="pageHeading compact"><span className="eyebrow">Administración · Contratos</span><h1>Contrato firmado</h1><p>Documento privado asociado al contrato del usuario.</p><Link className="textLink" href="/admin/usuarios">← Volver a usuarios</Link></div>
      <div className="card contractViewerCard">
        <div className="contractViewerActions"><a className="button ghost small" href={`/documentos/contratos/${id}`} target="_blank" rel="noreferrer">Abrir en otra pestaña</a><Link className="button ghost small" href={`/documentos/contratos/${id}?download=1`}>Descargar PDF</Link></div>
        <iframe className="contractFrame" src={`/documentos/contratos/${id}`} title="Contrato firmado en PDF" />
      </div>
    </>
  );
}
