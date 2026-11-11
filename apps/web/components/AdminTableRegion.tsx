'use client';

import { useCallback, type ReactNode } from 'react';

export function AdminTableRegion({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  const watchOverflow = useCallback((region: HTMLElement | null) => {
    if (!region) return;

    const updateTabStop = () => {
      if (region.scrollWidth > region.clientWidth) region.tabIndex = 0;
      else region.removeAttribute('tabindex');
    };

    updateTabStop();
    const observer = new ResizeObserver(updateTabStop);
    observer.observe(region);
    const table = region.querySelector('table');
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, []);

  return <section ref={watchOverflow} className="responsiveTable" aria-label={label}>{children}</section>;
}
