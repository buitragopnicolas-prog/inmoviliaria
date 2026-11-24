'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import Link from 'next/link';
import { PropertyGallery } from '../PropertyGallery';
import styles from './works-wheel.module.css';

export type WheelItem = {id:string; title:string; image:string; alt:string; href:string; detail:string};
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

// Ring to vertical drum, adapted from crafterui's Works Wheel on 21st.
// Turn 0 is the ring. Every whole turn thereafter puts another photo in front.
export function WorksWheel({items, portfolio = false}:Readonly<{items:WheelItem[]; portfolio?:boolean}>) {
  const stage=useRef<HTMLButtonElement>(null);
  const wheel=useRef<HTMLSpanElement>(null);
  const cards=useRef<(HTMLSpanElement|null)[]>([]);
  const turn=useRef(0);
  const target=useRef(0);
  const swiped=useRef(false);
  const tween=useRef<ReturnType<typeof animate>|null>(null);
  const drag=useRef<{x:number;y:number}|null>(null);
  const [position,setPosition]=useState(0);
  const [measured,setMeasured]=useState(false);
  const [reduced,setReduced]=useState(false);
  const size=useRef({width:0,height:0});
  const count=items.length;
  const active=items[clamp(position-1,0,count-1)];
  const draw=useCallback((value:number)=>{
    turn.current=value;
    const {width,height}=size.current;
    if(!wheel.current || !width || !height) return;
    const cardW=Math.min(width*.53,height*.71),cardH=cardW/1.45;
    const ringRadius=Math.min(width*.31,height*.34),drumRadius=cardH*2.22;
    const morph=Math.min(1,value),front=Math.max(0,value-1);
    const ringScale=clamp((2*Math.PI*ringRadius/count)*.80/cardW,.18,.84);
    wheel.current.style.transform='translateZ('+(-morph*drumRadius)+'px)';
    cards.current.forEach((node,i)=>{
      if(!node) return;
      const d=i-front, angle=d*40;
      const bow=-cardH*1.82*(1-Math.cos(angle*Math.PI/180));
      node.style.width=cardW+'px';
      node.style.transform='translate(-50%,-50%) translateX('+morph*bow+'px) rotateZ('+((1-morph)*d*360/count)+'deg) translateY('+(-(1-morph)*ringRadius)+'px) rotateX('+morph*angle+'deg) translateZ('+morph*drumRadius+'px) scale('+(ringScale+(1-ringScale)*morph)+')';
      node.style.opacity=morph>.55 && Math.abs(d)>1.5?'0':'1';
      node.style.zIndex=String(Math.round(100-Math.abs(d)*3));
    });
  },[count]);

  useLayoutEffect(()=>{
    const el=stage.current;
    if(!el)return;
    function measure(){
      if(!el)return;
      size.current={width:el.clientWidth,height:el.clientHeight};
      el.style.perspective=(Math.min(el.clientWidth*.53,el.clientHeight*.71)*2.8)+'px';
      draw(turn.current);setMeasured(true);
    }
    measure();
    const observer=new ResizeObserver(measure);observer.observe(el);
    return ()=>observer.disconnect();
  },[draw]);
  useEffect(()=>{
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const read=()=>{setReduced(preference.matches);if(preference.matches){tween.current?.stop();draw(target.current);}};
    read();preference.addEventListener('change',read);
    return ()=>{preference.removeEventListener('change',read);tween.current?.stop();};
  },[draw]);
  const go=useCallback((next:number)=>{
    next=clamp(next,0,count);
    target.current=next;setPosition(next);tween.current?.stop();
    if(reduced){draw(next);return;}
    tween.current=animate(turn.current,next,{duration:.48,ease:[.22,.78,.21,1],onUpdate:draw});
  },[count,reduced,draw]);
  useEffect(()=>{
    const el=stage.current;
    if(!el)return;
    let last=0;
    function onWheel(event:WheelEvent){
      if(document.activeElement!==el || event.ctrlKey || Math.abs(event.deltaY)<2) return;
      const next=clamp(target.current+Math.sign(event.deltaY),0,count);
      if(next===target.current)return;
      event.preventDefault();
      const now=performance.now();if(now-last<340)return;
      last=now;go(next);
    }
    el.addEventListener('wheel',onWheel,{passive:false});
    return ()=>el.removeEventListener('wheel',onWheel);
  },[go,count]);
  if(!active)return null;
  const flat=reduced || count===1;
  const shown=flat?Math.max(1,position):position;
  const overview=shown===0;
  return <div className={styles.gallery} data-portfolio={portfolio}>
    {portfolio && !flat && <fieldset className={styles.modes} aria-label="Forma de la galería">
      <button type="button" aria-pressed={overview} onClick={()=>go(0)}>Anillo</button>
      <button type="button" aria-pressed={!overview} onClick={()=>go(Math.max(1,position))}>Tambor</button>
    </fieldset>}
    <button type="button" ref={stage} aria-label={(overview ? "Explorar fotos. " : "") + "Galería de inmuebles. Usa las flechas para cambiar de foto."} onClick={()=>{
      if (!swiped.current) go(shown+1);
      swiped.current=false;
    }} className={styles.stage} data-ready={measured} data-flat={flat} data-overview={overview}
      onKeyDown={event=>{
        const next=({ArrowRight:shown+1,ArrowLeft:shown-1,ArrowDown:shown+1,ArrowUp:shown-1,Home:0,End:count,Escape:0} as Record<string,number>)[event.key];
        if(next===undefined || event.target!==event.currentTarget)return;
        event.preventDefault();go(flat?Math.max(1,next):next);
      }}
      onPointerDown={e=>{if(e.button===0){swiped.current=false;drag.current={x:e.clientX,y:e.clientY};}}}
      onPointerCancel={()=>{drag.current=null;}}
      onPointerUp={e=>{const start=drag.current;drag.current=null;if(!start)return;
        const dx=e.clientX-start.x,dy=e.clientY-start.y;
        if(Math.abs(dx)>32 && Math.abs(dx)>Math.abs(dy)){swiped.current=true;go(clamp(shown+(dx<0?1:-1),flat?1:0,count));}
      }}>
      <span className={styles.guides} aria-hidden="true"/>
      <span ref={wheel} className={styles.wheel} aria-hidden="true">{items.map((item,i)=><span ref={node=>{cards.current[i]=node;}} className={styles.card} key={item.id}>
        <img src={item.image} alt="" draggable={false}/></span>)}</span>
      <img className={styles.flat} src={active.image} alt={active.alt} draggable={false}/>
      {overview && <span className={styles.open}>Explorar fotos <span aria-hidden="true">↗</span></span>}
    </button>
    <div className={styles.legend}><div aria-live="polite" aria-atomic="true">
      <small>{overview?'Galería de arriendos':('Foto '+Math.max(1,position)+' de '+count)}</small>
      {overview?<strong>{count} vistas del inventario</strong>:<><Link href={active.href}>{active.title} ↗</Link><small>{active.detail}</small></>}
    </div><div className={styles.controls}>
      <button type="button" aria-label="Foto anterior" disabled={shown<=(flat?1:0)} onClick={()=>go(position-1)}>←</button>
      <button type="button" aria-label="Foto siguiente" disabled={shown>=count} onClick={()=>go(shown+1)}>→</button>
    </div></div>
    {portfolio && <PropertyGallery title="Galería de arriendos" previewIndex={Math.max(0, position-1)}
      images={items.map((item, sortOrder) => ({ id:item.id, url:item.image, alt:item.alt, sortOrder }))} />}
    {portfolio && count > 1 && <fieldset className={styles.pager} aria-label="Elegir fotografía">
      {items.map((item,i)=><button key={item.id} type="button" aria-label={'Ver foto '+(i+1)} aria-pressed={!overview && shown===i+1} onClick={()=>go(i+1)}>{i+1}</button>)}
    </fieldset>}
    <noscript><ul>{items.filter((item,i)=>items.findIndex(other=>other.href===item.href)===i).map(item=><li key={item.id}><a href={item.href}>{item.title}</a></li>)}</ul></noscript>
  </div>;
}
