import { serviceMenu } from '@/lib/service-menu';
import Link from 'next/link';
import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { contactSubject } from '@/lib/contact-interests';

export const metadata: Metadata = { title: 'Contacto' };

export default async function ContactPage({ searchParams }: Readonly<{
  searchParams: Promise<{ interes?: string | string[]; servicio?: string }>;
}>) {
  const [params, { contacto, servicios, alianzas, formularios }] = await Promise.all([searchParams, readSite()]);
  const subjects: Record<string,string> = Object.fromEntries(serviceMenu(servicios).map(item=>[item.key,item.name]));
  subjects.alianzas = alianzas.cta;
  const subject = params.servicio && Object.hasOwn(subjects, params.servicio) ? subjects[params.servicio] : contactSubject(params.interes);
  return (
    <section className="section pageTop">
      <div className="container contactGrid">
        <div className="pageHeading"><span className="eyebrow">{contacto.contact}</span><h1>{contacto.heading}</h1><p>{contacto.intro}</p><div className="contactInfo"><p><Link className="textLink" href="/sugerencias">{formularios.suggestionTitle} →</Link></p><p><strong>Teléfono</strong><br />{contacto.phone}</p><p><strong>Correo</strong><br />{contacto.email}</p><p><strong>Horario</strong><br />{contacto.hours}</p></div></div>
        <div className="card formPanel"><ContactForm key={subject} initialSubject={subject} /></div>
      </div>
    </section>
  );
}
