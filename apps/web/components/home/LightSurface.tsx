'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'motion/react';
import styles from './Directions.module.css';

type OrientationSource = typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
const limit=(value:number)=>Math.max(0,Math.min(1,value));

export function LightSurface({image,alt,caption,children}:{image:string;alt:string;caption:string;children:ReactNode}) {
  const surface=useRef<HTMLDivElement>(null);
  const canvas=useRef<HTMLCanvasElement>(null);
  const lastSample=useRef(-Infinity);
  const [heat,setHeat]=useState(false);
  const [available,setAvailable]=useState(false);
  const [tilt,setTilt]=useState(false);
  const [notice,setNotice]=useState('');
  const x=useMotionValue(72),y=useMotionValue(38);
  const glow=useMotionTemplate`radial-gradient(ellipse 32% 52% at ${x}% ${y}%, rgba(250,213,149,.57), transparent 100%)`;
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const coarse=matchMedia('(pointer: coarse)');
    const read=()=>{
      const supported=window.isSecureContext && 'DeviceOrientationEvent' in window && coarse.matches && !reduced.matches;
      setAvailable(supported);if(!supported){setTilt(false);setNotice('');}
    };
    read();reduced.addEventListener('change',read);coarse.addEventListener('change',read);
    return ()=>{reduced.removeEventListener('change',read);coarse.removeEventListener('change',read);};
  },[]);
  useEffect(()=>{
    if(!tilt)return;
    let origin:{beta:number;gamma:number}|undefined;
    const timer=window.setTimeout(()=>{if(!origin)setNotice('Aún no hay lectura del sensor. También puedes tocar la foto.');},2300);
    const onOrientation=(event:DeviceOrientationEvent)=>{
      if(event.gamma==null || event.beta==null)return;
      if(!origin){origin={beta:event.beta,gamma:event.gamma};setNotice('Inclinación activa.');}
      x.set(limit(.5+(event.gamma-origin.gamma)/55)*100);
      y.set(limit(.5+(event.beta-origin.beta)/60)*100);
    };
    const stop=()=>{if(document.hidden){setTilt(false);setNotice('');}};
    window.addEventListener('deviceorientation',onOrientation);document.addEventListener('visibilitychange',stop);
    return ()=>{window.clearTimeout(timer);window.removeEventListener('deviceorientation',onOrientation);document.removeEventListener('visibilitychange',stop);};
  },[tilt,x,y]);
  async function toggleTilt(){
    if(tilt){setTilt(false);setNotice('');return;}
    try{
      const source=window.DeviceOrientationEvent as OrientationSource;
      if(source.requestPermission && await source.requestPermission()!=='granted'){
        setNotice('El sensor está desactivado. Puedes mover la luz tocando la foto.');return;
      }
      setNotice('Inclina el móvil para mover la luz.');setTilt(true);
    }catch{setNotice('El sensor no está disponible. Puedes tocar la foto.');}
  }
  function sample(clientX:number,clientY:number) {
    const bounds=surface.current?.getBoundingClientRect();
    if(!bounds || !bounds.width || !bounds.height)return;
    const u=limit((clientX-bounds.left)/bounds.width),v=limit((clientY-bounds.top)/bounds.height);
    if(!tilt){x.set(u*100);y.set(v*100);}
    if(!heat || !canvas.current || performance.now()-lastSample.current<35)return;
    const el=canvas.current,ctx=el.getContext('2d');
    if(!ctx)return;
    lastSample.current=performance.now();
    const px=u*el.width,py=v*el.height,r=14;
    const g=ctx.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,'rgba(255,128,22,.54)');g.addColorStop(.42,'rgba(255,194,57,.24)');g.addColorStop(1,'rgba(255,170,28,0)');
    ctx.fillStyle=g;ctx.fillRect(px-r,py-r,r*2,r*2);
  }
  return <div className={styles.lightFrame}>
    <div className={styles.lightArt} ref={surface} onPointerMove={e=>sample(e.clientX,e.clientY)} onPointerDown={e=>sample(e.clientX,e.clientY)}>
      <img className={styles.lightImage} src={image} alt={alt} width={1920} height={1081} fetchPriority="high"/>
      <motion.div aria-hidden="true" style={{backgroundImage:glow}} className={styles.glow}/>
      {heat && <canvas className={styles.heat} ref={canvas} width="400" height="200" aria-hidden="true"/>}
      {children}
    </div>
    <div className={styles.photoBar}><div className="container"><small>{caption}</small><div>
      <button type="button" title="Usa las flechas para mover la luz. Pulsa para centrarla." onClick={()=>{x.set(50);y.set(50);}}
        onKeyDown={event=>{
          const delta:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};
          const step=delta[event.key];
          if(!step)return;
          event.preventDefault();
          x.set(limit((x.get()+step[0])/100)*100);
          y.set(limit((y.get()+step[1])/100)*100);
        }}>Orientar luz</button>
      <button type="button" aria-pressed={heat} onClick={()=>setHeat(!heat)}>Mapa de calor</button>
      {heat && <button type="button" onClick={()=>{const el=canvas.current;el?.getContext('2d')?.clearRect(0,0,el.width,el.height);}}>Borrar huella</button>}
      {available && <button type="button" aria-pressed={tilt} onClick={toggleTilt}>Inclinación del móvil</button>}
    </div></div>{(heat||notice) && <p role="status" className="container">{heat?'La huella muestra por dónde pasas el puntero o tocas esta foto durante la prueba. ':''}{notice}</p>}</div>
  </div>;
}
