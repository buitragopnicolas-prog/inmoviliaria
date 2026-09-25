import Link from 'next/link';
import { Reveal } from '../Reveal';
import { UiIcon } from '../UiIcon';
import styles from './HomeSections.module.css';

export function HomeHero() {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <picture className={styles.heroImage}>
        <source media="(max-width: 680px)" srcSet="/images/jb-architecture-hero-960.webp" />
        <img src="/images/jb-architecture-hero-1920.webp" alt="" width="1920" height="1081" fetchPriority="high" />
      </picture>
      <div className={`container ${styles.heroContent}`}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>Bogotá, Colombia · Asesoría inmobiliaria JB</span>
          <h1 id="home-title">Tu inmueble.<br />Nuestro <em>compromiso.</em></h1>
          <p>Arriendos y administración con acompañamiento cercano. Espacios para vivir y claridad para cuidar tu patrimonio.</p>
          <div className={styles.heroActions}>
            <Link className={`${styles.heroPrimary} button`} href="/inmuebles">Ver inmuebles <span aria-hidden="true">↗</span></Link>
            <Link className={styles.heroSecondary} href="/contacto">Hablar con un asesor <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className={styles.heroFoot}>
          <a className={styles.discoverLink} href="#nuestro-enfoque"><span aria-hidden="true">↓</span> Descubre nuestro enfoque</a>
          <span className={styles.imageCredit}>Arquitectura contemporánea · Imagen de referencia</span>
        </div>
      </div>
    </section>
  );
}

export function ServiceIntroduction() {
  return (
    <section className={styles.introduction} id="nuestro-enfoque" aria-labelledby="approach-title">
      <div className="container">
        <Reveal className={styles.introHeading}>
          <span className={styles.kicker}>01 / Una mirada integral</span>
          <div><h2 id="approach-title">Detrás de cada inmueble,<br />hay una <em>decisión importante.</em></h2><p>Encontrar un lugar, administrar un arriendo o tener tus documentos a mano. Conectamos cada parte de esa experiencia con información clara y atención cercana.</p></div>
        </Reveal>
        <div className={styles.serviceRows}>
          <Reveal><Link href="/inmuebles" className={styles.serviceLink}><span className={styles.serviceNumber}>01</span><div><h3>Encuentra tu espacio</h3><p>Ubicación, características y valores para elegir con información.</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
          <Reveal delay={70}><Link href="/contacto" className={styles.serviceLink}><span className={styles.serviceNumber}>02</span><div><h3>Conversemos de tu inmueble</h3><p>Cuéntanos qué necesitas para su administración y arriendo.</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
          <Reveal delay={140}><Link href="/mi-cuenta" className={styles.serviceLink}><span className={styles.serviceNumber}>03</span><div><h3>Tu información, a mano</h3><p>Consulta tus contratos, facturas e historial desde tu cuenta.</p></div><span className={styles.serviceArrow} aria-hidden="true">↗</span></Link></Reveal>
        </div>
      </div>
    </section>
  );
}

export function DocumentsSection() {
  return (
    <section className={styles.documents} aria-labelledby="documents-title">
      <div className={`container ${styles.documentsGrid}`}>
        <Reveal className={styles.interiorFigure}>
          <figure>
            <img src="/images/jb-interior-1200.webp" width="1200" height="900" alt="Interior arquitectónico de ambientación, con materiales naturales y luz de día" loading="lazy" decoding="async" />
            <figcaption>Espacios pensados para vivir · Imagen de referencia</figcaption>
          </figure>
          <span className={styles.figureIndex} aria-hidden="true">JB / HABITAR</span>
        </Reveal>
        <Reveal className={styles.documentCopy}>
          <span className={styles.kicker}>03 / Contratos y gestión documental</span>
          <h2 id="documents-title">La tranquilidad<br />también está<br /><em>en los detalles.</em></h2>
          <p>Un arriendo reúne mucho más que un inmueble. También son sus condiciones, sus documentos y la información que necesitas consultar.</p>
          <ul className={styles.documentList}>
            <li><UiIcon name="document" /><div><h3>Documentos disponibles</h3><p>Accede a los contratos asociados a tu cuenta.</p></div></li>
            <li><UiIcon name="message" /><div><h3>Acompañamiento cercano</h3><p>Contacta a nuestro equipo cuando necesites orientación sobre tu arriendo.</p></div></li>
          </ul>
          <Link className={styles.lightArrowLink} href="/contacto">Conversemos <span aria-hidden="true">↗</span></Link>
        </Reveal>
      </div>
    </section>
  );
}

export function DigitalSection() {
  return (
    <section className={styles.digital} aria-labelledby="digital-title">
      <div className={`container ${styles.digitalGrid}`}>
        <Reveal className={styles.digitalCopy}>
          <span className={styles.kicker}>04 / Cercanía también en digital</span>
          <h2 id="digital-title">Menos búsquedas.<br /><em>Más claridad.</em></h2>
          <p>La información de tu arriendo tiene un lugar. Desde tu cuenta puedes consultar documentos, revisar facturas y encontrar tu historial de pagos.</p>
          <Link className={styles.arrowLink} href="/mi-cuenta">Ir a mi cuenta <span aria-hidden="true">↗</span></Link>
        </Reveal>
        <Reveal className={styles.accountOverview}>
          <div className={styles.accountHeading}><span>EL ESPACIO DE TU ARRIENDO</span><UiIcon name="home" /></div>
          <h3>Tu cuenta, en orden.</h3>
          <p>Lo que puedes consultar al ingresar</p>
          <ol className={styles.accountList}>
            <li><UiIcon name="folder" /><div><strong>Contratos</strong><span>Documentos asociados a tu arriendo</span></div><span aria-hidden="true">01</span></li>
            <li><UiIcon name="document" /><div><strong>Facturas</strong><span>Valores, vencimientos y estados</span></div><span aria-hidden="true">02</span></li>
            <li><UiIcon name="check" /><div><strong>Historial</strong><span>Consulta de tus pagos registrados</span></div><span aria-hidden="true">03</span></li>
          </ol>
          <div className={styles.accountNote}>Disponible para arrendatarios con cuenta.</div>
        </Reveal>
      </div>
    </section>
  );
}

export function ContactSection() {
  return (
    <section className={styles.contact} aria-labelledby="contact-title">
      <img className={styles.contactImage} src="/images/jb-architecture-hero-960.webp" alt="" width="960" height="540" loading="lazy" decoding="async" />
      <Reveal className={`container ${styles.contactContent}`}>
        <span className={styles.heroKicker}>Un buen comienzo es una conversación</span>
        <h2 id="contact-title">Hablemos de tu<br /><em>próximo paso.</em></h2>
        <div><p>¿Buscas un lugar o necesitas acompañamiento con tu inmueble? Estamos para escucharte.</p><Link className={`${styles.heroPrimary} button`} href="/contacto">Hablar con un asesor <span aria-hidden="true">↗</span></Link></div>
      </Reveal>
    </section>
  );
}
