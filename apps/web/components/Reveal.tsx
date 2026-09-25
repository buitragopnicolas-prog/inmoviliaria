'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styles from './Reveal.module.css';

/** Wrap below-the-fold content; delay is in milliseconds (limited to 240 ms). */
export function Reveal({ children, className = '', delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const element = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const completed = useRef(false);
  const [state, setState] = useState<'idle' | 'pending' | 'revealed'>('idle');

  function reveal() {
    completed.current = true;
    observer.current?.disconnect();
    setState('revealed');
  }

  useEffect(() => {
    const node = element.current;
    if (!node || completed.current || typeof window.IntersectionObserver !== 'function' || typeof window.matchMedia !== 'function') return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || node.contains(document.activeElement)) return;
    let disposed = false;

    function show() {
      if (disposed) return;
      completed.current = true;
      observer.current?.disconnect();
      setState('revealed');
    }

    const onMotionChange = () => {
      if (motion.matches) show();
    };
    const intersection = new IntersectionObserver(([entry]) => {
      if (!entry || disposed || completed.current) return;
      if (entry.isIntersecting || entry.boundingClientRect.top < (entry.rootBounds?.bottom ?? window.innerHeight)) {
        show();
      } else {
        // SSR stays fully visible. Only a confirmed, observed element below the viewport is prepared.
        setState('pending');
      }
    }, { threshold: 0 });
    observer.current = intersection;
    motion.addEventListener('change', onMotionChange);
    intersection.observe(node);

    return () => {
      disposed = true;
      intersection.disconnect();
      motion.removeEventListener('change', onMotionChange);
      if (observer.current === intersection) observer.current = null;
    };
  }, []);

  const style = { '--reveal-delay': `${Number.isFinite(delay) ? Math.min(240, Math.max(0, delay)) : 0}ms` } as CSSProperties;

  return <div ref={element} className={`${styles.reveal} ${className}`.trim()} data-reveal-state={state} style={style} onFocusCapture={reveal}>{children}</div>;
}
