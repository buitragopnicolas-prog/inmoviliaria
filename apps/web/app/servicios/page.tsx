import { readSite } from '@/lib/read-site';
import { serviceMenu } from '@/lib/service-menu';
import { BrandIcon } from '@/components/BrandIcon';
import { Reveal } from '@/components/Reveal';
import Link from 'next/link';
export default async function ServicesPage(){
  const {servicios:s}=await readSite();
  return <section className="section pageTop"><div className="container"><div className="pageHeading"><h1>{s.title}</h1><p>{s.intro}</p></div>
    <div className="cardsGrid">{serviceMenu(s).map((item,i)=><Reveal key={item.key} delay={i*40}><article className="card serviceCard">
      <BrandIcon name={item.key==='inmobiliarios' ? 'purchase' : item.key==='contables' ? 'investment' : 'advice'}/><h2>{item.name}</h2><p className="formattedCopy">{item.description}</p><Link className="textLink" href={item.href} aria-label={s.button+' · '+item.name}>{s.button} →</Link>
    </article></Reveal>)}</div></div></section>;
}
