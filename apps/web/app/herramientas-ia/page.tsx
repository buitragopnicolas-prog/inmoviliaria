import type { Metadata } from 'next';
import { AiTools } from '@/components/AiTools';

export const metadata: Metadata = { title: 'Herramientas IA', description: 'Herramientas de imágenes, audio y texto que se procesan en tu navegador.' };

export default function AiToolsPage() {
  return <section className="section pageTop"><div className="container">
    <div className="pageHeading"><span className="eyebrow">Tecnología a tu servicio</span><h1>Herramientas IA</h1><p>Prepara fotografías, transcribe notas y trabaja con tus textos desde tu dispositivo.</p></div>
    <AiTools />
  </div></section>;
}
