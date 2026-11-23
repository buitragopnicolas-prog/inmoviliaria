'use client';

import { useEffect } from 'react';
import { fadeIn } from '@/lib/motion';

export function AdminReturnFocus({ target, listHref }: { target?: string; listHref: string }) {
  useEffect(() => {
    if (!target) return;
    let stop: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(target);
      if (!element) return;
      window.history.replaceState(null, '', `${listHref}#${encodeURIComponent(target)}`);
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      stop = fadeIn(element);
    });
    return () => { cancelAnimationFrame(frame); stop?.(); };
  }, [target, listHref]);
  return target === 'resultados-edicion'
    ? <p role="status">El registro ya no aparece con los filtros actuales.</p>
    : null;
}
