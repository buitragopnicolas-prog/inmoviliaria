'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { SiteCopy } from '@/lib/site-content';
import { instruments, marketRefreshMs, type MarketQuote, type MarketSnapshot } from '@/lib/markets';
import { LocationRotator } from './LocationRotator';

const numbers = new Intl.NumberFormat('es-CO', {maximumFractionDigits: 2, minimumFractionDigits: 2});
const dates = new Intl.DateTimeFormat('es-CO', {dateStyle:'short', timeStyle:'short', timeZone:'America/Bogota'});

function trend(change:number) {
  if (change===0) return '→';
  return change>0 ? '↑' : '↓';
}

function QuoteValue({quote,unit,copy}:Readonly<{quote?: MarketQuote;unit:string;copy:SiteCopy['mercados']}>) {
  if (!quote) return <span>{copy.unavailable}</span>;
  const change = quote.change;
  return <><b>{numbers.format(quote.value)} {unit}</b>
    {change !== null && <span data-trend={Math.sign(change)}>{trend(change)} {numbers.format(Math.abs(change))}%</span>}
    {quote.retained && <small>{copy.retained}</small>}</>;
}

export function FinancialTicker({copy,places}:Readonly<{copy:SiteCopy['mercados'];places:SiteCopy['presencia']}>) {
  const [snapshot,setSnapshot] = useState<MarketSnapshot | null>(null);
  const [paused,setPaused] = useState(false);
  const [details,setDetails] = useState(false);
  const [hover,setHover] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Tween | null>(null);
  const disclosure=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    function closeOnEscape(event:KeyboardEvent) {
      if (event.key !== 'Escape' || !disclosure.current?.open) return;
      disclosure.current.open=false;
      disclosure.current.querySelector('summary')?.focus();
    }
    document.addEventListener('keydown',closeOnEscape);
    return ()=>document.removeEventListener('keydown',closeOnEscape);
  },[]);
  const hold = paused || details || hover;
  const holding = useRef(hold);
  useEffect(()=>{
    holding.current = hold;
    animation.current?.paused(hold || document.hidden);
  },[hold]);

  useEffect(()=>{
    const controller = new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    let active = false;
    async function refresh() {
      clearTimeout(timer);
      if (document.hidden || active || controller.signal.aborted) return;
      active = true;
      try {
        const response = await fetch('/api/mercados',{signal:controller.signal,cache:'no-store'});
        if (!response.ok) throw new Error('Cotizaciones no disponibles');
        const data:MarketSnapshot = await response.json();
        if (!controller.signal.aborted) setSnapshot(data);
      } catch {
        if (!controller.signal.aborted) setSnapshot(previous=>({quotes:Object.fromEntries(
          Object.entries(previous?.quotes ?? {}).map(([id,quote])=>[id,{...quote,retained:true}])
        )}));
      } finally {
        active = false;
        if (!controller.signal.aborted && !document.hidden) timer=setTimeout(refresh,marketRefreshMs);
      }
    }
    void refresh();
    document.addEventListener('visibilitychange',refresh);
    return ()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);

  const loaded = snapshot !== null;
  useEffect(()=>{
    const rail = track.current;
    const group = rail?.firstElementChild;
    if (!rail || !group || !loaded || !window.matchMedia || !window.ResizeObserver) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      function measure(){
        const width = group!.getBoundingClientRect().width;
        if (!width) return;
        const progress = animation.current?.progress() ?? 0;
        animation.current?.kill();
        animation.current = gsap.fromTo(rail,{x:0},{x:-width,duration:width/38,ease:'none',repeat:-1,paused:true});
        animation.current.progress(progress).paused(holding.current || document.hidden);
      }
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(group);
      const visibility = ()=>animation.current?.paused(holding.current || document.hidden);
      document.addEventListener('visibilitychange',visibility);
      return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);animation.current?.kill();animation.current=null;gsap.set(rail,{clearProps:'transform'});};
    });
    return ()=>media.revert();
  },[loaded]);

  return <section className="businessBand" aria-label={copy.title}>
    <div className="container businessRow">
      <LocationRotator copy={places} paused={hold}/>
      <div className="quoteWindow" aria-hidden="true" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
        {snapshot ? <div className="quoteTrack" ref={track}>{[0,1].map(index=><div key={index} className="quoteGroup">
          {instruments.map(({id,unit})=><span className="quoteItem" key={id}><strong>{copy[id]}</strong><QuoteValue quote={snapshot.quotes[id]} unit={unit} copy={copy}/></span>)}
        </div>)}</div> : <span>{copy.pending}…</span>}
      </div>
      <button type="button" className="bandPause" aria-label={copy.pause} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'▷':'Ⅱ'}</button>
      <details className="quoteDetails" ref={disclosure} onToggle={event=>setDetails(event.currentTarget.open)}>
        <summary aria-label={copy.details}>{copy.title} <span aria-hidden="true">⌄</span></summary>
        <div className="quotePanel"><h2>{copy.details}</h2><p>{copy.note}</p>
          <ul>{instruments.map(({id,symbol,unit})=>{
            const quote=snapshot?.quotes[id];
            return <li key={id}><a href={'https://finance.yahoo.com/quote/'+encodeURIComponent(symbol)+'/'} target="_blank" rel="noreferrer">{copy[id]} ↗</a>
              <div>{snapshot ? <QuoteValue quote={quote} unit={unit} copy={copy}/> : copy.pending}</div>
              {quote && <time dateTime={quote.asOf}>{dates.format(new Date(quote.asOf))}</time>}</li>;
          })}</ul><p className="quotePlaces"><strong>{places.title}</strong><br/>{places.cities.split(/\r?\n/).join(' · ')}</p></div>
      </details>
    </div>
  </section>;
}
