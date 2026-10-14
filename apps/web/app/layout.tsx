import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

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

export const metadata: Metadata = {
  title: { default: 'Asesoría Inmobiliaria JB | Arriendos con confianza', template: '%s | Asesoría Inmobiliaria JB' },
  description: 'Encuentra inmuebles en arriendo y administra tus pagos de forma sencilla.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <a className="skipLink" href="#contenido">Saltar al contenido</a>
        <Header />
        <main id="contenido" tabIndex={-1}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
