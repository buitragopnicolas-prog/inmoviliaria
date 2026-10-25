'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ActiveLink } from './ActiveLink';
import { UiIcon } from './UiIcon';

export function PublicNavigation({ role }: { role?: 'ADMIN' | 'USER' }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function closeMenu() { setOpen(false); toggle.current?.focus(); }
  function handleEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') closeMenu();
  }
  const destinations = [
    { href: '/', label: 'Inicio' },
    { href: '/inmuebles', label: 'Inmuebles' },
    { href: '/noticias', label: 'Noticias' },
    { href: '/nosotros', label: 'Nosotros' },
    { href: '/contacto', label: 'Contacto' },
    { href: '/herramientas-ia', label: 'Herramientas IA' },
    ...(role === 'ADMIN' ? [{ href: '/admin', label: 'Administración' }] : []),
    ...(role === 'USER' ? [{ href: '/mi-cuenta', label: 'Mi cuenta' }] : []),
  ];
  const links = (mobile = false) => destinations.map(({ href, label }) =>
    <ActiveLink key={href} href={href} reload={href === '/herramientas-ia'} onClick={mobile ? closeMenu : undefined} onKeyDown={mobile ? handleEscape : undefined}>{label}</ActiveLink>);
  return <>
    <nav className="navLinks desktopNav" aria-label="Navegación principal">{links()}</nav>
    <div className="mobileNavigation" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={toggle} type="button" className="button outline small menuToggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)} onKeyDown={handleEscape}>
        <UiIcon name={open ? 'close' : 'menu'} /><span>Menú</span>
      </button>
      <nav id="mobile-navigation" className="mobileLinks" aria-label="Navegación móvil" hidden={!open}>{links(true)}</nav>
    </div>
  </>;
}
