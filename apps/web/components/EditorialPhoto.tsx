'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';

type PhotoProps = Omit<ComponentProps<'img'>,'src'|'onError'> & {src:string;fallback:string;fallbackAlt:string};

export function EditorialPhoto({src,alt,fallback,fallbackAlt,...props}:Readonly<PhotoProps>) {
  const [failed,setFailed]=useState<string | null>(null);
  const useFallback=!src || failed===src;
  return <img {...props} src={useFallback ? fallback : src} alt={useFallback ? fallbackAlt : alt}
    onError={useFallback || src===fallback ? undefined : ()=>setFailed(src)}/>;
}
