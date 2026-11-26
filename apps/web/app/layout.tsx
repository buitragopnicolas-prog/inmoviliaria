import { createHash } from 'node:crypto';
import { PolicyProvider } from '@/components/ConsentField';
import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import '@/components/business/business.css';
import { LegalCloud } from '@/components/legal/LegalCloud';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PublicSiteChrome, SkipToContentLink } from '@/components/PublicSiteChrome';
import { BogotaExperienceManager } from '@/components/skyline/BogotaExperienceManager';

const displayFont = localFont({
  src: '../../../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2',
  variable: '--font-display',
  weight: '400 900',
  display: 'swap',
});

const bodyFont = localFont({
  src: '../../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { identidad } = await readSite();
  return {title: {default: identidad.name, template: '%s | '+identidad.name}, description: identidad.description};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { contacto, consultaLegal } = await readSite();
  const text=contacto.policyText.trim();
  const href=contacto.policyHref.trim() || (text ? '/politica-de-datos' : '');
  const version=href ? createHash('sha256').update(JSON.stringify([href,text])).digest('hex') : '';
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body data-jb-ui="inmersivo" className={`${bodyFont.variable} ${displayFont.variable}`}>
        <PolicyProvider value={{href,version}}>
          <BogotaExperienceManager>
            <SkipToContentLink />
            <PublicSiteChrome><Header /></PublicSiteChrome>
            <main id="contenido" className="glass-panel-total glass-panel-jb" tabIndex={-1}>{children}</main>
            <PublicSiteChrome><Footer /></PublicSiteChrome>
            <LegalCloud copy={consultaLegal}/>
          </BogotaExperienceManager>
        </PolicyProvider>
      </body>
    </html>
  );
}
