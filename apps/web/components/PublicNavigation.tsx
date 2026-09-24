'use client';

import { useRef, useState } from 'react';
import { ActiveLink } from './ActiveLink';
import { UiIcon } from './UiIcon';

export function PublicNavigation({ role }: { role?: 'ADMIN' | 'USER' }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const links = <>
    <ActiveLink href="/">Inicio</ActiveLink>
    <ActiveLink href="/inmuebles">Inmuebles</ActiveLink>
    <ActiveLink href="/noticias">Noticias</ActiveLink>
    <ActiveLink href="/nosotros">Nosotros</ActiveLink>
    <ActiveLink href="/contacto">Contacto</ActiveLink>
    {role === 'ADMIN' && <ActiveLink href="/admin">Administración</ActiveLink>}
    {role === 'USER' && <ActiveLink href="/mi-cuenta">Mi cuenta</ActiveLink>}
  </>;
  return <>
    <nav className="navLinks desktopNav" aria-label="Navegación principal">{links}</nav>
    <div className="mobileNavigation" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); }
    }}>
      <button ref={toggle} type="button" className="button outline small menuToggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)}>
        <UiIcon name={open ? 'close' : 'menu'} /><span>Menú</span>
      </button>
      <nav id="mobile-navigation" className="mobileLinks" aria-label="Navegación móvil" hidden={!open} onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) { setOpen(false); toggle.current?.focus(); }
      }}>{links}</nav>
    </div>
  </>;
}
