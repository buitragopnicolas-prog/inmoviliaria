'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { pesos, propertyPhotoUrl } from '@/lib/format';
import { usePropertySelection } from '@/components/skyline/PropertySelection';

export interface DisplayAsset {
  id:string; href:string; title:string; price:number; image?:string; place:string;
  details:string; badge?:string; latitude?:number|null; longitude?:number|null;
}
type Props = { items:DisplayAsset[]; label:string; kind:'rent'|'sale'|'goods' };

export function AssetRail({items,label,kind}:Readonly<Props>) {
  const {slug,select}=usePropertySelection();
  const start=kind==='rent' ? items.findIndex(item=>item.id===slug) : -1;
  const [active,setActive]=useState(start>=0 ? start : items.length>=3 ? 1 : 0);
  const track=useRef<HTMLDivElement>(null);
  const current=useRef(active);
  const previous=useRef(active);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const from=previous.current;
    previous.current=active;
    if(from===active || !track.current)return;
    const motion=matchMedia('(prefers-reduced-motion: no-preference)');
    let disposed=false;
    let stop:(()=>void)|undefined;
    if(motion.matches)void import('gsap').then(({gsap})=>{
      if(disposed || !motion.matches)return;
      const ctx=gsap.context(()=>{
        track.current?.querySelectorAll<HTMLElement>('.assetCard').forEach((card,i)=>{
          const start=Math.sign(from-i),end=Math.sign(active-i);
          if(start===end)return;
          gsap.fromTo(card,{rotationY:start*18,scale:start ? .86 : 1},{
            rotationY:end*18,scale:end ? .86 : 1,duration:.32,ease:'power2.out',clearProps:'transform'
          });
        });
      });
      stop=()=>ctx.revert();
    });
    const reset=()=>stop?.();
    motion.addEventListener('change',reset);
    return ()=>{disposed=true;reset();motion.removeEventListener('change',reset);};
  },[active]);
  function center(index:number,smooth:boolean) {
    const el=track.current;
    const item=el?.children[index] as HTMLElement|undefined;
    if(!el || !item)return;
    el.scrollTo({left:item.offsetLeft+(item.offsetWidth-el.clientWidth)/2,
      behavior:smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  }
  useEffect(()=>{
    const el=track.current!;
    center(current.current,false);
    setReady(true);
    let frame=0;
    function read(){
      frame=0;
      const mid=el.scrollLeft+el.clientWidth/2;
      let index=0,distance=Infinity;
      Array.from(el.children).forEach((child,i)=>{
        const card=child as HTMLElement;
        const d=Math.abs(card.offsetLeft+card.offsetWidth/2-mid);
        if(d<distance){index=i;distance=d;}
      });
      current.current=index;setActive(index);
    }
    function onScroll(){if(!frame)frame=requestAnimationFrame(read);}
    const observer=new ResizeObserver(()=>center(current.current,false));
    observer.observe(el);
    el.addEventListener('scroll',onScroll,{passive:true});
    return ()=>{el.removeEventListener('scroll',onScroll);observer.disconnect();cancelAnimationFrame(frame);};
  },[items]);
  return <div className={'assetRail rail-'+kind} role="region" aria-roledescription="carrusel" aria-label={label}>
    <div className="assetRailTrack" ref={track} data-single={items.length===1 || undefined}
      onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault();
        const next=e.key==='Home'?0:e.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowRight'?1:-1)));
        (track.current?.children[next]?.querySelector('a') as HTMLElement)?.focus({preventScroll:true});center(next,true);
      }}}>
      {items.map((item,i)=><div className="assetSlide" key={item.id} data-side={i===active?'center':i<active?'left':'right'}>
        <Link href={item.href} className="assetCard glass-panel-total glass-panel-jb" data-heat-panel="" data-lat={item.latitude??undefined} data-lng={item.longitude??undefined}
          onFocus={()=>center(i,false)} onClick={()=>{if(kind==='rent')select(item.id);}}>
          <div className="assetPhoto"><img src={propertyPhotoUrl(item.image)} alt={item.image?item.title:'Sin fotografía publicada'} loading={i<3?'eager':'lazy'}/>
            {item.badge && <small>{item.badge}</small>}
          </div>
          <div className="assetCopy"><p>{item.place}</p><h3>{item.title}</h3><strong>{pesos(item.price)}{kind==='rent' && <small> / mes</small>}</strong>
            <span>{item.details}</span><b>{kind==='rent'?'Ver inmueble':'Ver oferta'} ↗</b></div>
        </Link>
      </div>)}
    </div>
    {items.length>1 && <div className="railControls" hidden={!ready}>
      <button type="button" aria-label="Anterior" disabled={active===0} onClick={()=>center(active-1,true)}>←</button>
      <output aria-live="polite">{active+1} de {items.length}</output>
      <button type="button" aria-label="Siguiente" disabled={active===items.length-1} onClick={()=>center(active+1,true)}>→</button>
    </div>}
  </div>;
}
