'use client';

import { usePathname } from 'next/navigation';

export function PublicSiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/herramientas-ia/panel' ? null : children;
}

export function SkipToContentLink() {
  const pathname = usePathname();
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (pathname === '/herramientas-ia/panel') return null;
  return <a className="skipLink" href={admin ? '#contenido-admin' : '#contenido'}>Saltar al contenido</a>;
}
