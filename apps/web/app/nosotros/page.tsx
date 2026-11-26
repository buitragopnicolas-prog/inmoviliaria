import { EditorialPhoto } from '@/components/EditorialPhoto';
import { defaultCopy } from '@/lib/site-content';
import { readSite } from '@/lib/read-site';
import { BrandIcon } from '@/components/BrandIcon';
import { Reveal } from '@/components/Reveal';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Quiénes somos' };

export default async function AboutPage() {
  const { nosotros: copy } = await readSite();
  return (
    <>
      <section className="section pageTop aboutHero">
        <div className="container aboutGrid">
          <div className="pageHeading"><span className="eyebrow">{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.intro}</p><Link href="/contacto" className="button">{copy.button}</Link></div>
          <Reveal><figure className="editorialFigure"><EditorialPhoto fallback={defaultCopy.nosotros.photo} fallbackAlt={defaultCopy.nosotros.alt} src={copy.photo} alt={copy.alt}/><figcaption>{copy.caption}</figcaption></figure></Reveal>
        </div>
      </section>
      <section className="sectionAlt"><div className="container purpose"><div><span className="eyebrow">{copy.purpose}</span><h2>{copy.purposeTitle}</h2><p>{copy.purposeText}</p></div><div className="card values">{(['first','second','third'] as const).map(k=><article key={k}><BrandIcon name={({ first: "trust", second: "closeness", third: "professionalism" } as const)[k]}/><strong>{copy[k]}</strong><p>{copy[`${k}Text`]}</p></article>)}</div></div></section>
    </>
  );
}
