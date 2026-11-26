'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Selection = {slug:string | null; select:(slug:string | null)=>void};
const Context=createContext<Selection | null>(null);

export function PropertySelection({path,children}:Readonly<{path:string;children:ReactNode}>) {
  const [slug,select]=useState<string | null>(null);
  useEffect(()=>{
    const detail=/^\/inmuebles\/([^/]+)$/.exec(path);
    if(detail) {
      try { select(decodeURIComponent(detail[1])); } catch { select(null); }
    }
    else if(path!=='/' && path!=='/inmuebles') select(null);
  },[path]);
  const value=useMemo(()=>({slug,select}),[slug]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePropertySelection() {
  const shared=useContext(Context);
  const [slug,select]=useState<string | null>(null);
  return shared ?? {slug,select};
}
