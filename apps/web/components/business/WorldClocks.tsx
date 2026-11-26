'use client';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import type { SiteCopy } from '@/lib/site-content';

const cities = ['london','newYork','beijing','dubai'] as const;
export function WorldClocks({copy,initialTime}:Readonly<{copy:SiteCopy['relojes'];initialTime:number}>) {
  const [now,setNow]=useState(initialTime);
  useEffect(()=>{
    let interval:ReturnType<typeof setInterval> | undefined;
    function sync(){
      clearInterval(interval);
      if(document.hidden)return;
      setNow(Date.now());
      interval=setInterval(()=>setNow(Date.now()),1000);
    }
    sync();
    document.addEventListener('visibilitychange',sync);
    return ()=>{clearInterval(interval);document.removeEventListener('visibilitychange',sync);};
  },[]);
  return <section className="worldClocks glass-panel-jb" aria-label={copy.title}>
    <h2>{copy.title}</h2><div className="worldClockGrid">{cities.map(key=>{
      const city=DateTime.fromMillis(now,{zone:copy[`${key}Zone`],locale:'en-US'});
      return <div key={key}><h3>{copy[key]}</h3><time dateTime={city.toISO()??undefined}>{city.toFormat('HH:mm:ss')}</time>
        <small>{city.toFormat('dd/MM/yyyy')} · {city.toFormat('a')}</small></div>;
    })}</div>
  </section>;
}
