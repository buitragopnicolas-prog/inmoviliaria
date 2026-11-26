import Form from 'next/form';
import { portalNames } from '@/lib/portals';
import { requireUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { DocumentAccount, DocumentFile } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';
import { PdfUploadForm } from '@/components/PdfUploadForm';

export default async function AccountDocuments({searchParams}:Readonly<{searchParams:Promise<{cliente?:string}>}>) {
  await requireUser('ADMIN');
  const accounts=await apiFetch<DocumentAccount[]>('/admin/documents/accounts',{},true);
  const requested=(await searchParams).cliente;
  const account=accounts.find(item=>item.id===requested);
  const files=account?await apiFetch<DocumentFile[]>('/admin/documents/accounts/'+encodeURIComponent(account.id),{},true):[];
  return <><div className="pageHeading compact"><h1>Documentos por cliente</h1><p>Asigna PDF privados a una cuenta registrada.</p></div>
    <Form action="/admin/documentos" className="form card formPanel"><label>Cuenta del cliente<select name="cliente" defaultValue={account?.id??''} required>
      <option value="">Selecciona una cuenta</option>{accounts.map(item=><option key={item.id} value={item.id}>{portalNames[item.portal]} · {item.name} · {item.email}</option>)}
    </select></label><button type="submit" className="button">Ver documentos</button></Form>
    {requested&&!account&&<p role="alert">La cuenta seleccionada no está disponible.</p>}
    {account && <section className="card formPanel" key={account.id}><h2>{account.name}</h2><p>{account.email}</p>
      <PdfUploadForm kind="account" id={account.id} service={account.portal==='SERVICES'} label={account.portal==='SERVICES'?'Contrato de prestación de servicios (PDF)':'Documento para esta cuenta'}/>
      {files.length?<DocumentLinks files={files} scope="privados"/>:<p>Esta cuenta todavía no tiene PDF asignados.</p>}
    </section>}</>;
}
