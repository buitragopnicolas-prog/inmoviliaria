'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { fadeIn } from '@/lib/motion';

export function NewsReadingPosition({ articleId, children }: { articleId: string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const paragraphs = Array.from(content.current!.querySelectorAll('p'));
    if (!paragraphs.length) return;
    const path = location.pathname;
    const key = `jb:lectura:${articleId}`;
    const readingLine = () => (document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0) + 12;
    let stopMotion: (() => void) | undefined;
    let frame = 0;
    function remember() {
      frame = 0;
      if (location.pathname !== path || !content.current?.getClientRects().length) return;
      const line = readingLine();
      const index = paragraphs.findLastIndex(p => p.getBoundingClientRect().top <= line);
      try {
        if (index < 0) { sessionStorage.removeItem(key); return; }
        const rect = paragraphs[index].getBoundingClientRect();
        sessionStorage.setItem(key, JSON.stringify({ index, fraction: Math.min(1, (line - rect.top) / Math.max(1, rect.height)) }));
      } catch { /* El historial nativo sigue disponible si el almacenamiento está restringido. */ }
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(remember);
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      const paragraph = saved && paragraphs[saved.index];
      if (!location.hash && paragraph && Number.isFinite(saved.fraction)) {
        const rect = paragraph.getBoundingClientRect();
        const offset = rect.top + Math.max(0, Math.min(1, saved.fraction)) * rect.height - readingLine();
        window.scrollBy({ top: offset, behavior: 'instant' });
        stopMotion = fadeIn(paragraph);
      }
    } catch { /* Un marcador caducado deja el artículo en su posición natural. */ }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', remember);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', remember);
      stopMotion?.();
    };
  }, [articleId]);
  return <div ref={content} className="newsParagraphs">{children}</div>;
}
