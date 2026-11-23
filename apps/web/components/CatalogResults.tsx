'use client';

import { useEffect, useRef, useState } from 'react';
import { fadeIn } from '@/lib/motion';
import type { CatalogProperty } from '@/lib/public-catalog';
import { DataUnavailable } from './DataUnavailable';
import { PropertyCard } from './PropertyCard';

type CatalogSource = { query: string; initial?: never } | { initial: CatalogProperty[] | null; query?: never };

export function CatalogResults({ query, initial }: CatalogSource) {
  const [inventory, setInventory] = useState<CatalogProperty[] | null>();
  const status = useRef<HTMLParagraphElement>(null);
  const properties = query === undefined ? initial : inventory;

  useEffect(() => {
    if (query === undefined) return;
    const controller = new AbortController();
    async function search() {
      try {
        const response = await fetch(`/api/catalogo?${query}`, { signal: controller.signal, cache: 'no-store' });
        const rows: CatalogProperty[] | null = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setInventory(rows);
      } catch {
        if (!controller.signal.aborted) setInventory(null);
      }
    }
    void search();
    return () => controller.abort();
  }, [query]);

  useEffect(() => fadeIn(status.current), [properties]);
  if (properties === null) return <DataUnavailable label="los inmuebles" />;
  return <>
    <p ref={status} className="results" role="status">{properties === undefined
      ? 'Buscando inmuebles…'
      : `${properties.length} ${properties.length === 1 ? 'inmueble encontrado' : 'inmuebles encontrados'}`}</p>
    {properties?.length === 0 && <div className="empty">No hay inmuebles que coincidan con los filtros seleccionados.</div>}
    {!!properties?.length && <div className="cardsGrid">{properties.map((property) =>
      <PropertyCard property={property} key={property.id} />)}</div>}
  </>;
}
