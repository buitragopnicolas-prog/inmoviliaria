import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { rentalFormats, type FormatKey, type RentalFormat } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';
import { PdfUploadForm } from '@/components/PdfUploadForm';

export default async function RentalFormsAdmin(){
  await requireUser('ADMIN');
  const records=await apiFetch<RentalFormat[]>('/documents/templates');
  return <><div className="pageHeading compact"><h1>Formatos de arrendamiento</h1><p>Publica los modelos en blanco que podrán consultar los visitantes de Arrendar.</p></div>
    {(Object.keys(rentalFormats) as FormatKey[]).map(key=>{
      const existing=records.find(row=>row.key===key);
      return <section className="card formPanel" key={key}><h2>{rentalFormats[key]}</h2>
        {existing?<DocumentLinks files={[existing.file]} scope="publicos"/>:<p>Aún no se ha publicado este formato.</p>}
        <PdfUploadForm kind="template" id={key} label={existing?'Reemplazar PDF':'Seleccionar PDF'}/>
      </section>;
    })}</>;
}
