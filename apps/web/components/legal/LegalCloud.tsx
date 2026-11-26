'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { UiIcon } from '../UiIcon';
import { fadeIn } from '@/lib/motion';
import type { SiteCopy } from '@/lib/site-content';
import { chatGptUrl } from './chat-link';
import styles from './legal.module.css';

export function LegalCloud({copy}:Readonly<{copy:SiteCopy['consultaLegal']}>) {
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const path=usePathname();
  useEffect(()=>{dialog.current?.close();},[path]);
  if(path==='/consulta-juridica' || path==='/herramientas-ia/panel')return null;
  return <><button type="button" ref={trigger} className={styles.bubble} aria-haspopup="dialog" aria-label={copy.title}
    onClick={()=>dialog.current?.showModal()}><UiIcon name="cloud"/><span>{copy.bubble}</span></button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="jb-legal-title" onClose={()=>trigger.current?.focus({preventScroll:true})}
      onToggle={event=>{if(event.currentTarget.open)fadeIn(event.currentTarget);}}>
      <form method="dialog"><button type="submit" className={styles.close} aria-label="Cerrar consulta"><UiIcon name="close"/></button></form>
      <h2 id="jb-legal-title">{copy.title}</h2><p>{copy.intro}</p>
      <div className={styles.actions}><Link href="/consulta-juridica" className="button" onClick={()=>dialog.current?.close()}>{copy.internal}</Link>
      <a href={chatGptUrl} target="_blank" rel="noopener noreferrer">{copy.external} ↗</a></div>
    </dialog><noscript><a className={styles.bubble} href="/consulta-juridica">{copy.bubble}</a></noscript></>;
}
