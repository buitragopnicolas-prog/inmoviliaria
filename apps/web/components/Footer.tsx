import { UiIcon } from './UiIcon';
import { WorldClocks } from './business/WorldClocks';
import Link from 'next/link';
import { readSite } from '@/lib/read-site';
import { BrandLogo } from '@/components/BrandLogo';

export async function Footer() {
  const { contacto: c, identidad, relojes, formularios } = await readSite();
  const links = c.links.split(/\r?\n/).filter(Boolean).map(line=>line.split('|').map(part=>part.trim()));
  const whatsapp=c.whatsapp.replace(/\D/g,'');
  const policy = c.policyHref || '/politica-de-datos';
  return (
    <footer className="footer cityFooter" id="contacto-jb">
      <div className="container footerGrid">
        <div className="glass-panel glass-panel-jb">
          <div className="footerBrand"><BrandLogo image={identidad.footerLogo} name={identidad.name} tone="white" stacked /></div>
          <p>{c.footerText}</p>
        </div>
        <div className="glass-panel glass-panel-jb"><h2>{c.explore}</h2>{links.filter(([,href])=>href).map(([label,href])=><Link key={JSON.stringify([label,href])} href={href==='/herramientas-ia'?'/consulta-juridica':href} prefetch={false}>{href === '/herramientas-ia' ? 'Consulta jurídica IA' : label}</Link>)}<Link href="/sugerencias">{formularios.suggestionTitle}</Link>{policy && <Link href={policy} prefetch={false}>{c.policyLabel}</Link>}</div>
        <div className="glass-panel glass-panel-jb"><h2>{c.contact}</h2><address>
          <p>{c.streetAddress && <>{c.streetAddress}<br/></>}{c.city}</p>
          <a href={'tel:'+c.phone.replace(/[^+\d]/g,'')}>{c.phone}</a>
          <a href={'mailto:'+c.email}>{c.email}</a>
        </address></div>
      </div>
      <WorldClocks copy={relojes} initialTime={Date.now()}/>
      <a className="whatsappBubble" href={'https://wa.me/'+whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Abrir chat de WhatsApp con la inmobiliaria"><UiIcon name="message"/><span>WhatsApp</span></a>
      <div className="copyright">© {new Date().getFullYear()} {identidad.name}. {c.rights}</div>
    </footer>
  );
}
