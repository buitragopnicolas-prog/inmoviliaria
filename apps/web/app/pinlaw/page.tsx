import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { EditorialPhoto } from '@/components/EditorialPhoto';
import { Reveal } from '@/components/Reveal';
import { pinlauDirectory } from '@/lib/pinlau';
import { readSite } from '@/lib/read-site';
import { defaultCopy } from '@/lib/site-content';
import { readTeam } from '../../../../shared/pinlau-team.mjs';
import styles from './pinlaw.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const {pinlau} = await readSite();
  return {title: pinlau.title, description: pinlau.intro};
}

export default async function PinlawPage() {
  const site = await readSite();
  const copy = site.pinlau;
  const areas = pinlauDirectory(site);
  const people = readTeam(copy.people) ?? [];
  const contact = <Link className="button" href="/contacto?pinlaw=general">{copy.general}</Link>;
  return <div className={'container ' + styles.page}>
    <header className={styles.hero}>
      <div className="pageHeading"><span className="eyebrow">{copy.kicker}</span>
        <h1>{copy.title}</h1><p>{copy.intro}</p>{contact}
      </div>
      <EditorialPhoto className={styles.cover} src={copy.photo} alt={copy.alt} fallback={defaultCopy.pinlau.photo} fallbackAlt={defaultCopy.pinlau.alt} width={720} height={480}/>
    </header>
    <section aria-labelledby="pinlau-catalogo" className={styles.directory}>
      <aside className={styles.index}><h2 id="pinlau-catalogo">{copy.catalog}</h2>
        <nav aria-labelledby="pinlau-catalogo">{areas.map(area => <a key={area.id} href={'#' + area.id}>{area.heading}</a>)}<a href="#equipo">{copy.team}</a></nav>
      </aside>
      <div className={styles.groups}>{areas.map(area => <section id={area.id} aria-labelledby={area.id + '-title'} key={area.id}>
        <Reveal><h3 id={area.id + '-title'}>{area.heading}</h3></Reveal>
        {area.services.map(service => <details className={styles.service} key={service.key}>
          <summary>{service.title}</summary>
          <div><p className="formattedCopy">{service.description}</p>
            <Link prefetch={false} className="textLink" aria-label={copy.contact + ' · ' + service.title} href={'/contacto?pinlaw=' + service.key}>{copy.contact} →</Link>
          </div>
        </details>)}
      </section>)}</div>
    </section>
    <section id="equipo" aria-labelledby="pinlau-equipo" className={styles.team}>
      <Reveal><h2 id="pinlau-equipo">{copy.team}</h2><p>{copy.teamIntro}</p></Reveal>
      {people.length > 0 && <ul>{people.map(person => <li key={person.photo + person.name + person.role}>
        <Image width={240} height={300} alt="" src={person.photo}/><h3>{person.name}</h3><p>{person.role}</p>
      </li>)}</ul>}
      {contact}
    </section>
  </div>;
}
