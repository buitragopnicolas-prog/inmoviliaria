'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { defaultCopy } from '@/lib/site-content';
import { ActiveLink } from './ActiveLink';
import { UiIcon } from './UiIcon';

export function PublicNavigation({ role, copy = defaultCopy.identidad }: Readonly<{ role?: 'ADMIN' | 'USER'; copy?: typeof defaultCopy.identidad }>) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function closeMenu() { setOpen(false); toggle.current?.focus(); }
  function handleEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') closeMenu();
  }
  const destinations = [
    { href: '/', label: copy.navHome },
    { href: '/inmuebles', label: copy.navRent },
    { href: '/comprar', label: copy.navBuy },
    { href: '/pinlau', label: copy.navPinlau },
    { href: '/noticias', label: copy.navNews },
    { href: '/nosotros', label: copy.navAbout },
    { href: '/contacto', label: copy.navContact },
    ...(role === 'ADMIN' ? [{ href: '/admin', label: copy.navAdmin }] : []),
    ...(role === 'USER' ? [{ href: '/mi-cuenta', label: copy.navAccount }] : []),
  ];
  const links = (mobile = false) => destinations.map(({ href, label }) =>
    <ActiveLink key={href} href={href} onClick={mobile ? closeMenu : undefined} onKeyDown={mobile ? handleEscape : undefined}>{label}</ActiveLink>);
  return <>
    <nav className="navLinks desktopNav" aria-label="Navegación principal">{links()}<span className="jbNavMarker" aria-hidden="true" hidden/></nav>
    <div className="mobileNavigation" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={toggle} type="button" className="button outline small menuToggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)} onKeyDown={handleEscape}>
        <UiIcon name={open ? 'close' : 'menu'} /><span>{copy.menu}</span>
      </button>
      <nav id="mobile-navigation" className="mobileLinks" aria-label="Navegación móvil" hidden={!open}>{links(true)}</nav>
    </div>
  </>;
}
