import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { AiTools } from '@/components/AiTools';

export const metadata: Metadata = { title: 'Herramientas IA', description: 'Herramientas de imágenes, audio y texto que se procesan en tu navegador.' };

export default async function AiToolsPage() {
  const {catalogos} = await readSite();
  return <section className="section pageTop"><div className="container">
    <div className="pageHeading"><span className="eyebrow">{catalogos.toolsKicker}</span><h1>{catalogos.toolsTitle}</h1><p>{catalogos.toolsIntro}</p></div>
    <AiTools />
  </div></section>;
}
