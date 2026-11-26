import { readSite } from '@/lib/read-site';
import Link from 'next/link';
import { loadPublicData } from '@/lib/public-data';
import { rentalFormats, type FormatKey, type RentalFormat } from '@/lib/documents';
import { DocumentLinks } from '@/components/DocumentLinks';
import { DataUnavailable } from '@/components/DataUnavailable';
import { Reveal } from '@/components/Reveal';

export default async function RentalFormsPage(){
  const [records,{formularios:f}]=await Promise.all([loadPublicData<RentalFormat[]>('/documents/templates'),readSite()]);
  return <section className="section pageTop"><div className="container"><Link href="/inmuebles">← Arrendar</Link>
    <div className="pageHeading"><h1>{f.rentalTitle}</h1><p>{f.rentalIntro}</p></div>
    {records===null?<DataUnavailable label="los formatos de arrendamiento" retryHref="/solicitud-de-arrendamiento"/>:(Object.keys(rentalFormats) as FormatKey[]).map(key=>{
      const record=records.find(row=>row.key===key);
      return <Reveal key={key}><section className="card formPanel"><h2>{rentalFormats[key]}</h2>{record?<DocumentLinks files={[record.file]} scope="publicos"/>:<p>{f.pendingFormat}</p>}</section></Reveal>;
    })}
  </div></section>;
}
