import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import type { Property } from '@/lib/types';
import { PropertyCard } from '@/components/PropertyCard';

export const metadata: Metadata = { title: 'Inmuebles en arriendo' };
export const dynamic = 'force-dynamic';

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ search?: string; city?: string; maxRent?: string }> }) {
  const filters = await searchParams;
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.city) params.set('city', filters.city);
  if (filters.maxRent) params.set('maxRent', filters.maxRent);
  const properties = await apiFetch<Property[]>(`/properties?${params}`);
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="pageHeading"><span className="eyebrow">Catálogo</span><h1>Inmuebles en arriendo</h1><p>Explora espacios disponibles y encuentra el adecuado para ti.</p></div>
        <form className="filters" method="get">
          <label>Barrio o inmueble<input name="search" defaultValue={filters.search} placeholder="Ej. Chapinero" /></label>
          <label>Ciudad<input name="city" defaultValue={filters.city} placeholder="Ej. Bogotá" /></label>
          <label>Canon máximo (COP)<input name="maxRent" defaultValue={filters.maxRent} type="number" placeholder="Ej. 2500000" /></label>
          <button className="button" type="submit">Buscar</button>
        </form>
        <p className="results">{properties.length} inmuebles encontrados</p>
        <div className="cardsGrid">{properties.map((property) => <PropertyCard property={property} key={property.id} />)}</div>
        {properties.length === 0 && <div className="empty">No hay inmuebles que coincidan con los filtros seleccionados.</div>}
      </div>
    </section>
  );
}
