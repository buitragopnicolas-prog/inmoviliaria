import type { Metadata } from 'next';
import { Cormorant_Garamond, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const displayFont = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: { default: 'Asesoría Inmobiliaria JB | Arriendos con confianza', template: '%s | Asesoría Inmobiliaria JB' },
  description: 'Encuentra inmuebles en arriendo y administra tus pagos de forma sencilla.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <a className="skipLink" href="#contenido">Saltar al contenido</a>
        <Header />
        <main id="contenido" tabIndex={-1}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
