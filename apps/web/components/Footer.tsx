import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footerGrid">
        <div>
          <div className="footerBrand"><BrandLogo className="footerBrandLogo" stacked showTagline={false} /></div>
          <p>Administramos inmuebles para arriendo con claridad, respaldo y acompañamiento digital.</p>
        </div>
        <div><h2>Explora</h2><Link href="/inmuebles">Inmuebles</Link><Link href="/noticias">Noticias</Link><Link href="/nosotros">Quiénes somos</Link><Link href="/contacto">Contactar asesor</Link></div>
        <div><h2>Contacto</h2><p>Bogotá, Colombia</p><a href="tel:+576015550185">+57 601 555 0185</a><a href="mailto:contacto@asesoriainmobiliariajb.com">contacto@asesoriainmobiliariajb.com</a></div>
      </div>
      <div className="copyright">© 2026 Asesoría Inmobiliaria JB. Todos los derechos reservados.</div>
    </footer>
  );
}
