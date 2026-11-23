'use client';

import { useEffect, useRef } from 'react';
import { fadeIn } from '@/lib/motion';

export function StatusNotice({ message, tone = 'info', focusOnRemoval = false }: Readonly<{
  message: string;
  tone?: 'info' | 'success' | 'error';
  focusOnRemoval?: boolean;
}>) {
  const notice = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const element = notice.current;
    if (!element) return;
    if (focusOnRemoval && document.activeElement === document.body) element.focus();
    return fadeIn(element);
  }, [message, tone, focusOnRemoval]);
  return <output ref={notice} className={`alert statusNotice ${tone}`} role={tone === 'error' ? 'alert' : undefined} tabIndex={focusOnRemoval ? -1 : undefined}>{message}</output>;
}
