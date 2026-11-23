import { animate } from 'motion/mini';

export function fadeIn(element: HTMLElement | null) {
  const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!element?.animate || !preference || preference.matches) return;
  const animation = animate(element, { opacity: [0.78, 1] }, { duration: 0.18 });
  const stop = () => animation.cancel();
  preference.addEventListener('change', stop);
  return () => {
    preference.removeEventListener('change', stop);
    stop();
  };
}
