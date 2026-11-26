'use client';

import { useEffect, useRef } from 'react';

export function AiToolsPanel() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const element = frame.current!;
    let observer: ResizeObserver | undefined;
    function measure() {
      observer?.disconnect();
      const content = element.contentDocument?.getElementById('contenido');
      if (!content) return;
      const resize = () => { element.style.height = Math.ceil(content.getBoundingClientRect().height) + 'px'; };
      observer = new ResizeObserver(resize);
      observer.observe(content);
      resize();
    }
    measure();
    element.addEventListener('load',measure);
    return () => { element.removeEventListener('load',measure); observer?.disconnect(); };
  }, []);
  return <iframe ref={frame} src="/herramientas-ia/panel" title="Panel de herramientas de inteligencia artificial"
    style={{width:'100%', height:720, border:0, display:'block'}}/>;
}
