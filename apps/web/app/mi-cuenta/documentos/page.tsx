import Link from 'next/link';
import { readSite } from '@/lib/read-site';
import { requireUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { DocumentFile } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';

export default async function MyDocuments(){
  await requireUser('USER');
  const [files,{formularios:f,portales}]=await Promise.all([apiFetch<DocumentFile[]>('/documents/mine',{},true),readSite()]);
  return <section className="section pageTop"><div className="container"><Link href="/mi-cuenta">← Mi cuenta</Link>
    <div className="pageHeading"><h1>{portales.documents}</h1><p>{f.documentIntro}</p></div>
    {files.length?<DocumentLinks files={files} scope="privados"/>:<p className="card empty">{f.emptyDocuments}</p>}
  </div></section>;
}
