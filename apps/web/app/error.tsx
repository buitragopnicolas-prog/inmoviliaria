'use client';

import Link from 'next/link';

export default function PageError({ retry }: { retry: () => void }) {
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading">
          <span className="eyebrow">Intenta nuevamente</span>
          <h1>No pudimos cargar esta página</h1>
          <p>Ocurrió un problema al consultar la información. Puedes volver a intentar o regresar al inicio.</p>
        </div>
        <div className="detailActions">
          <button className="button" type="button" onClick={retry}>Volver a intentar</button>
          <Link className="button outline" href="/">Ir al inicio</Link>
        </div>
      </div>
    </section>
  );
}
