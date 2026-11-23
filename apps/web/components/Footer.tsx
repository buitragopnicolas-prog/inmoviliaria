import { UiIcon } from './UiIcon';
import { readSite } from '@/lib/read-site';
import { BrandLogo } from '@/components/BrandLogo';

export async function Footer() {
  const { contacto: c, identidad } = await readSite();
  const links = c.links.split(/\r?\n/).filter(Boolean).map(line=>line.split('|').map(part=>part.trim()));
  const whatsapp=c.whatsapp.replace(/\D/g,'');
  const policy = c.policyHref || '/politica-de-datos';
  return (
    <footer className="footer">
      <div className="container footerGrid">
        <div>
          <div className="footerBrand"><BrandLogo name={identidad.name} tagline={identidad.tagline} tone="dark" stacked showTagline={false} /></div>
          <p>{c.footerText}</p>
        </div>
        <div><h2>{c.explore}</h2>{links.map(([label,href])=><a key={JSON.stringify([label,href])} href={href}>{label}</a>)}<a href="/sugerencias">Buzón de sugerencias</a>{policy && <a href={policy}>{c.policyLabel}</a>}</div>
        <div><h2>{c.contact}</h2><p>{c.city}</p><a href={'tel:'+c.phone.replace(/[^+\d]/g,'')}>{c.phone}</a><a href={'mailto:'+c.email}>{c.email}</a></div>
      </div>
      <a className="whatsappBubble" href={'https://wa.me/'+whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Abrir chat de WhatsApp con la inmobiliaria"><UiIcon name="message"/><span>WhatsApp</span></a>
      <div className="copyright">© {new Date().getFullYear()} {identidad.name}. {c.rights}</div>
    </footer>
  );
}
