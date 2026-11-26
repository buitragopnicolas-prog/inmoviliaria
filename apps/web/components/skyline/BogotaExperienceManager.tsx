'use client';

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { animate } from 'motion/mini';
import type { createSkyline, ExperienceState } from './createSkyline';
import { PropertySelection } from './PropertySelection';
import './skyline.css';
import '../market/home-market.css';
import './immersive.css';
import './brand.css';
import './mobile-depth.css';

const Experience = createContext<ExperienceState | null>(null);
const subscribeFrame=()=>()=>{};
const desktopMotion = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function BogotaExperienceManager({children}: Readonly<{children: ReactNode}>) {
  const path = usePathname();
  const embedded=useSyncExternalStore(subscribeFrame,()=>window.self!==window.top,()=>path==='/herramientas-ia/panel');
  const state = useRef<ExperienceState>({path, scroll:0, street:0, camera:{x:0,y:0,zoom:1}});
  useEffect(()=>{
    const main=document.getElementById('contenido');
    if(!main)return;
    const pref=matchMedia(desktopMotion);
    let disposed=false,cleanup:(()=>void)|undefined;
    async function setup(){
      cleanup?.();cleanup=undefined;
      if(!pref.matches)return;
      const {animateSurfaces}=await import('./surfaceMotion');
      if(!disposed && pref.matches && !cleanup)cleanup=animateSurfaces(main!);
    }
    void setup();pref.addEventListener('change',setup);
    return ()=>{disposed=true;cleanup?.();pref.removeEventListener('change',setup);};
  },[path]);
  return <Experience.Provider value={state.current}>
    {!embedded && <CityViewport path={path}/>}
    <PropertySelection path={path}>{children}</PropertySelection>
  </Experience.Provider>;
}

function CityViewport({path}: Readonly<{path:string}>) {
  const experience = useContext(Experience)!;
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Awaited<ReturnType<typeof createSkyline>>>(undefined);
  const entrance = useRef<() => void>(() => {});

  useEffect(() => {
    if (experience.path === path) return;
    experience.path = path;
    engine.current?.navigate(path);
    entrance.current();
  }, [experience,path]);

  useEffect(() => {
    const element = frame.current!;
    const surface = canvas.current!;
    const preference = matchMedia(desktopMotion);
    const life = new AbortController();
    let loading = false;
    async function updatePreference() {
      if (engine.current) {
        engine.current.setMotion(preference.matches);
      } else if (!loading && preference.matches) {
        loading = true;
        try {
          const {createSkyline} = await import('./createSkyline');
          if (life.signal.aborted || !preference.matches) return;
          const next = await createSkyline(element,surface,experience,life.signal);
          if (life.signal.aborted) { next?.dispose(); return; }
          engine.current = next;
          next?.setMotion(preference.matches);
        } catch {
          // CSS supplies the complete city and the street illustration independently.
        } finally { loading = false; }
      }
    }
    void updatePreference();
    preference.addEventListener('change',updatePreference);
    return () => {
      life.abort();
      preference.removeEventListener('change',updatePreference);
      engine.current?.dispose();
      engine.current = undefined;
    };
  }, [experience]);

  useEffect(() => {
    const main = document.getElementById('contenido');
    if (!main) return;
    const preference = matchMedia(desktopMotion);
    let animation: ReturnType<typeof animate> | undefined;
    let reset: ReturnType<typeof setTimeout> | undefined;
    function cancel() {
      clearTimeout(reset);
      animation?.cancel();
      main!.style.removeProperty('opacity');
    }
    function arrive() {
      const opacity = Number(getComputedStyle(main!).opacity);
      cancel();
      if (preference.matches) {
        animation = animate(main!,{opacity:[Math.min(.82,opacity),1]},{duration:.24});
        animation.then(()=>main!.style.removeProperty('opacity'),()=>{});
      }
    }
    function depart() {
      cancel();
      if (!preference.matches) return;
      animation = animate(main!,{opacity:[1,.60]},{duration:.12});
      // A cancelled navigation or a slow response must leave the current page usable.
      reset = setTimeout(arrive,450);
    }
    function onClick(event: MouseEvent) {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (link && (!link.target || link.target === '_self') && !link.hasAttribute('download') &&
          link.origin === location.origin && link.pathname !== location.pathname) depart();
    }
    entrance.current = arrive;
    document.addEventListener('click',onClick,true);
    window.addEventListener('popstate',depart);
    preference.addEventListener('change',cancel);
    return () => {
      cancel();
      entrance.current = () => {};
      document.removeEventListener('click',onClick,true);
      window.removeEventListener('popstate',depart);
      preference.removeEventListener('change',cancel);
    };
  }, []);

  return <>
    <div className="jbSkyline" data-workspace={path.startsWith('/admin') ? 'admin' : 'public'} aria-hidden="true">
      <div className="jbSkylineFrame" ref={frame}><canvas ref={canvas}/></div>
    </div>
    <div aria-hidden="true" className="jbCityEdges"/>
  </>;
}
