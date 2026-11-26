import Link from 'next/link';
import { defaultCopy, type SiteCopy } from '@/lib/site-content';
import { EditorialPhoto } from '../EditorialPhoto';
import { Reveal } from '../Reveal';

export function AllianceSection({copy}:Readonly<{copy:SiteCopy['alianzas']}>) {
  return <section className="allianceSection" aria-labelledby="alliance-title"><Reveal className="container allianceCard glass-panel-jb">
    <EditorialPhoto src={copy.photo} alt={copy.alt} fallback={defaultCopy.alianzas.photo} fallbackAlt={defaultCopy.alianzas.alt}
      width={1200} height={800} loading="lazy" decoding="async"/>
    <div><h2 id="alliance-title">{copy.title}</h2><p>{copy.intro}</p>
      <Link className="button" href={copy.href}>{copy.cta} <span aria-hidden="true">↗</span></Link></div>
  </Reveal></section>;
}
