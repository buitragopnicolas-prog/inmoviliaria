import { createHash } from 'node:crypto';
import { PolicyProvider } from '@/components/ConsentField';
import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { PublicSiteChrome, SkipToContentLink } from '@/components/PublicSiteChrome';

const displayFont = localFont({
  src: '../../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2',
  variable: '--font-display',
  weight: '500 700',
  display: 'swap',
});

const bodyFont = localFont({
  src: '../../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '400 700',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const { identidad } = await readSite();
  return {title: {default: identidad.name, template: '%s | '+identidad.name}, description: identidad.description};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { contacto } = await readSite();
  const text=contacto.policyText.trim();
  const href=contacto.policyHref.trim() || (text ? '/politica-de-datos' : '');
  const version=href ? createHash('sha256').update(JSON.stringify([href,text])).digest('hex') : '';
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <PolicyProvider value={{href,version}}><SkipToContentLink />
        <PublicSiteChrome><Header /></PublicSiteChrome>
        <main id="contenido" tabIndex={-1}>{children}</main>
        <PublicSiteChrome><Footer /></PublicSiteChrome></PolicyProvider>
      </body>
    </html>
  );
}
