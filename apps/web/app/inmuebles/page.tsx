import type { Metadata } from 'next';
import { loadPublicData } from '@/lib/public-data';
import type { Property } from '@/lib/types';
import { PropertyCard } from '@/components/PropertyCard';
import { readCatalogFilters, type CatalogSearchParams } from '@/lib/catalog-filters';
import { DataUnavailable } from '@/components/DataUnavailable';

export const metadata: Metadata = { title: 'Inmuebles en arriendo' };
export const dynamic = 'force-dynamic';

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const { values: filters, errors, query, invalid } = readCatalogFilters(await searchParams);
  const properties = invalid ? null : await loadPublicData<Property[]>(`/properties?${query}`);
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading"><span className="eyebrow">Catálogo</span><h1>Inmuebles en arriendo</h1><p>Explora espacios disponibles y encuentra el adecuado para ti.</p></div>
        <form className="filters" method="get">
          <label>Barrio o inmueble<input name="search" defaultValue={filters.search} placeholder="Ej. Chapinero" aria-invalid={!!errors.search} aria-describedby={errors.search ? 'search-error' : undefined} />{errors.search && <span className="alert error" id="search-error">{errors.search}</span>}</label>
          <label>Ciudad<input name="city" defaultValue={filters.city} placeholder="Ej. Bogotá" aria-invalid={!!errors.city} aria-describedby={errors.city ? 'city-error' : undefined} />{errors.city && <span className="alert error" id="city-error">{errors.city}</span>}</label>
          <label>Canon máximo (COP)<input name="maxRent" defaultValue={filters.maxRent} type="number" min={1} step="any" placeholder="Ej. 2500000" aria-invalid={!!errors.maxRent} aria-describedby={errors.maxRent ? 'max-rent-error' : undefined} />{errors.maxRent && <span className="alert error" id="max-rent-error">{errors.maxRent}</span>}</label>
          <button className="button" type="submit">Buscar</button>
        </form>
        {invalid ? <p className="results" role="alert">Revisa los filtros indicados para consultar los inmuebles.</p> : properties === null ? <DataUnavailable label="los inmuebles" /> : <>
          <p className="results">{properties.length} {properties.length === 1 ? 'inmueble encontrado' : 'inmuebles encontrados'}</p>
          <div className="cardsGrid">{properties.map((property) => <PropertyCard property={property} key={property.id} />)}</div>
          {properties.length === 0 && <div className="empty">No hay inmuebles que coincidan con los filtros seleccionados.</div>}
        </>}
      </div>
    </section>
  );
}
