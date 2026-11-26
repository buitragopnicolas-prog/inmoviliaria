'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function DataUnavailable({ label, retryHref = '/' }: Readonly<{ label: string; retryHref?: string }>) {
  const router = useRouter();
  return (
    <div className="card dataUnavailable">
      <output>No pudimos cargar {label}. Intenta de nuevo en unos momentos.</output>
      <Link className="button outline" href={retryHref} prefetch={false} onNavigate={event => {
        const destination = new URL(retryHref, window.location.href);
        if (destination.pathname === location.pathname && destination.search === location.search) {
          event.preventDefault();
          router.refresh();
        }
      }}>Volver a intentar</Link>
    </div>
  );
}
