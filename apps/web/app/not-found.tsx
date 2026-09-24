import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading">
          <span className="eyebrow">Página no encontrada</span>
          <h1>No encontramos lo que buscas</h1>
          <p>Es posible que el enlace haya cambiado o que el contenido ya no esté disponible.</p>
        </div>
        <div className="detailActions">
          <Link className="button" href="/inmuebles">Explorar inmuebles</Link>
          <Link className="button outline" href="/">Ir al inicio</Link>
        </div>
      </div>
    </section>
  );
}
