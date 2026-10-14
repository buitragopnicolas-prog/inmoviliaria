'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  removeLeaseContractAction,
  uploadLeaseContractAction,
  type ActionState,
} from '@/app/actions';
import type { ContractFile } from '@/lib/types';

export function AdminLeaseContractForm({
  leaseId,
  userId,
  contractFile,
}: {
  leaseId: string;
  userId: string;
  contractFile?: ContractFile | null;
}) {
  const [uploadState, uploadAction, uploading] = useActionState<ActionState, FormData>(uploadLeaseContractAction, {});
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(removeLeaseContractAction, {});
  return (
    <div className="contractManager">
      {contractFile ? <div className="contractFileInfo">
        <div><strong>{contractFile.originalName}</strong><small>{formatBytes(contractFile.size)}</small></div>
        <div className="tableActions">
          <Link className="button ghost small" href={`/admin/contratos/${leaseId}`}>Visualizar</Link>
          <Link className="button ghost small" href={`/documentos/contratos/${leaseId}?download=1`}>Descargar</Link>
        </div>
      </div> : <p className="muted">Todavía no se ha cargado el contrato firmado.</p>}

      <form className="form contractUploadForm" action={uploadAction}>
        <input type="hidden" name="leaseId" value={leaseId} />
        <input type="hidden" name="userId" value={userId} />
        <label>{contractFile ? 'Reemplazar contrato PDF' : 'Subir contrato firmado en PDF'}<input type="file" name="file" accept="application/pdf,.pdf" required /></label>
        {uploadState.error && <p className="alert error">{uploadState.error}</p>}
        {uploadState.success && <p className="alert success">{uploadState.success}</p>}
        <button type="submit" className="button small" disabled={uploading}>{uploading ? 'Cargando…' : contractFile ? 'Reemplazar PDF' : 'Subir PDF'}</button>
      </form>

      {contractFile && <form
        action={removeAction}
        onSubmit={(event) => {
          if (!window.confirm('¿Retirar el PDF firmado de este contrato?')) event.preventDefault();
        }}
      >
        <input type="hidden" name="leaseId" value={leaseId} />
        <input type="hidden" name="userId" value={userId} />
        {removeState.error && <p className="alert error">{removeState.error}</p>}
        {removeState.success && <p className="alert success">{removeState.success}</p>}
        <button type="submit" className="button danger small" disabled={removing}>{removing ? 'Retirando…' : 'Retirar contrato'}</button>
      </form>}
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
