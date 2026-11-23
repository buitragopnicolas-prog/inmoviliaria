import Link from 'next/link';
import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { CatalogFilterForm } from '@/components/CatalogFilterForm';
import { headers } from 'next/headers';
import { userAgentFromString } from 'next/server';
import { CatalogResults } from '@/components/CatalogResults';
import { loadPublicCatalog } from '@/lib/public-catalog';
import { readCatalogFilters, type CatalogSearchParams } from '@/lib/catalog-filters';

export const metadata: Metadata = { title: 'Inmuebles en arriendo' };
export const dynamic = 'force-dynamic';

export default async function PropertiesPage({ searchParams }: Readonly<{ searchParams: Promise<CatalogSearchParams & { vista?: string | string[] }> }>) {
  const [params, { catalogos }] = await Promise.all([searchParams, readSite()]);
  const { values: filters, errors, query, invalid } = readCatalogFilters(params);
  const fullView = new URLSearchParams(query);
  fullView.set('vista', 'completa');
  let results;
  if (invalid) {
    results = <p className="results" role="alert">Revisa los filtros indicados para consultar los inmuebles.</p>;
  } else if (params.vista === 'completa' || userAgentFromString((await headers()).get('user-agent') ?? '').isBot) {
    results = <CatalogResults retryHref={`/inmuebles?${fullView}`} initial={await loadPublicCatalog(query)} />;
  } else {
    results = (
      <>
        <CatalogResults retryHref={`/inmuebles?${query}`} key={query} query={query} />
        <noscript><a className="textLink" href={`?${fullView}`}>Ver resultados de la búsqueda</a></noscript>
      </>
    );
  }
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading"><span className="eyebrow">Catálogo</span><h1>{catalogos.rentTitle}</h1><p>{catalogos.rentIntro}</p></div>
        <nav className="pdfActions rentalNav" aria-label="Arriendos"><a aria-current="page" href="/inmuebles">Inmuebles en arriendo</a><Link href="/solicitud-de-arrendamiento">Solicitud de arrendamiento</Link></nav>
        <CatalogFilterForm values={filters}>
          <noscript><input type="hidden" name="vista" value="completa" /></noscript>
          <label>Barrio o inmueble<input name="search" defaultValue={filters.search} placeholder="Ej. Chapinero" aria-invalid={!!errors.search} aria-describedby={errors.search ? 'search-error' : undefined} />{errors.search && <span className="alert error" id="search-error">{errors.search}</span>}</label>
          <label>Ciudad<input name="city" defaultValue={filters.city} placeholder="Ej. Bogotá" aria-invalid={!!errors.city} aria-describedby={errors.city ? 'city-error' : undefined} />{errors.city && <span className="alert error" id="city-error">{errors.city}</span>}</label>
          <label>Canon máximo (COP)<input name="maxRent" defaultValue={filters.maxRent} type="number" min={1} step="any" placeholder="Ej. 2500000" aria-invalid={!!errors.maxRent} aria-describedby={errors.maxRent ? 'max-rent-error' : undefined} />{errors.maxRent && <span className="alert error" id="max-rent-error">{errors.maxRent}</span>}</label>
          <button className="button" type="submit">Buscar</button>
        </CatalogFilterForm>
        {results}
      </div>
    </section>
  );
}
