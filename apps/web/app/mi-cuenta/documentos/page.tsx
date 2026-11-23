import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { DocumentFile } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';

export default async function MyDocuments(){
  await requireUser('USER');
  const files=await apiFetch<DocumentFile[]>('/documents/mine',{},true);
  return <section className="section pageTop"><div className="container"><Link href="/mi-cuenta">← Mi cuenta</Link>
    <div className="pageHeading"><h1>Mis documentos PDF</h1><p>Archivos que la inmobiliaria ha compartido contigo.</p></div>
    {files.length?<DocumentLinks files={files} scope="privados"/>:<p className="card empty">Aún no tienes documentos asignados.</p>}
  </div></section>;
}
