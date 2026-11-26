'use client';

import {useEffect,useRef} from 'react';
import {gsap} from 'gsap';
import type {SiteCopy} from '@/lib/site-content';
import {UiIcon} from '../UiIcon';

export function LocationRotator({copy,paused}:Readonly<{copy:SiteCopy['presencia'];paused:boolean}>) {
  const cities=copy.cities.split(/\r?\n/).map(city=>city.trim()).filter(Boolean);
  const list=useRef<HTMLSpanElement>(null);
  const motion=useRef<gsap.core.Timeline | null>(null);
  const held=useRef(paused);
  useEffect(()=>{
    held.current=paused;
    motion.current?.paused(paused || document.hidden);
  },[paused]);
  useEffect(()=>{
    const items=list.current?.children;
    if(!items || items.length<2 || !window.matchMedia)return;
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      const cycle=gsap.timeline({repeat:-1,paused:true});
      motion.current=cycle;
      Array.from(items).forEach((item,index)=>{
        const start=(index+1)*3-.22;
        cycle.to(item,{opacity:0,y:-4,duration:.22},start)
          .fromTo(items[(index+1)%items.length],{opacity:0,y:4},{opacity:1,y:0,duration:.22,immediateRender:false},start);
      });
      const visibility=()=>cycle.paused(held.current || document.hidden);
      visibility();
      document.addEventListener('visibilitychange',visibility);
      return ()=>{document.removeEventListener('visibilitychange',visibility);motion.current=null;};
    });
    return ()=>media.revert();
  },[copy.cities]);
  return <div className="presence"><UiIcon name="pin"/><span className="placeNames" ref={list} aria-hidden="true">
    {cities.map((city,index)=><span key={index}>{city}</span>)}</span>
    <span className="businessSr">{copy.title}: {cities.join(', ')}</span></div>;
}
