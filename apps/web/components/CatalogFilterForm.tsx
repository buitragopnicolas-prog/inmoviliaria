'use client';

import Form from 'next/form';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { type readCatalogFilters } from '@/lib/catalog-filters';

export function CatalogFilterForm({ values, children }: Readonly<{
  values: ReturnType<typeof readCatalogFilters>['values'];
  children: ReactNode;
}>) {
  const form = useRef<HTMLFormElement>(null);
  const valuesInUrl = JSON.stringify([values.search, values.city, values.maxRent]);
  const lastSubmission = useRef(valuesInUrl);

  useLayoutEffect(() => {
    // History navigation restores the URL's defaults. An ordinary submit keeps any newer draft.
    if (lastSubmission.current !== valuesInUrl) form.current?.reset();
    lastSubmission.current = valuesInUrl;
  }, [valuesInUrl]);

  return <Form ref={form} action="/inmuebles" scroll={false} prefetch={false}
    className="filters" aria-label="Filtrar inmuebles en arriendo" onSubmit={(event) => {
      const data = new FormData(event.currentTarget);
      lastSubmission.current = JSON.stringify([data.get('search'), data.get('city'), data.get('maxRent')]);
    }}>
    {children}
  </Form>;
}
