import Link from 'next/link';
import { loadPublicData } from '@/lib/public-data';
import { rentalFormats, type FormatKey, type RentalFormat } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';
import { DataUnavailable } from '@/components/DataUnavailable';
import { Reveal } from '@/components/Reveal';

export default async function RentalFormsPage(){
  const records=await loadPublicData<RentalFormat[]>('/documents/templates');
  return <section className="section pageTop"><div className="container"><Link href="/inmuebles">← Arrendar</Link>
    <div className="pageHeading"><h1>Solicitud de arrendamiento</h1><p>Consulta la solicitud y el contrato modelo de la inmobiliaria.</p></div>
    {records===null?<DataUnavailable label="los formatos de arrendamiento"/>:(Object.keys(rentalFormats) as FormatKey[]).map(key=>{
      const record=records.find(row=>row.key===key);
      return <Reveal key={key}><section className="card formPanel"><h2>{rentalFormats[key]}</h2>{record?<DocumentLinks files={[record.file]} scope="publicos"/>:<p>Este formato está pendiente de publicación.</p>}</section></Reveal>;
    })}
  </div></section>;
}
