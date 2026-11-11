'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AdminNav } from './AdminNav';
import { UiIcon } from './UiIcon';
import styles from './AdminWorkspace.module.css';

const sections: Record<string, string> = {
  inmuebles: 'Inmuebles', usuarios: 'Usuarios', facturas: 'Facturación',
  conciliacion: 'Conciliación', contactos: 'Contactos', noticias: 'Noticias', archivos: 'Archivos', contratos: 'Contratos',
};
const details: Record<string, string> = { inmuebles: 'Editar inmueble', contratos: 'Contrato firmado' };

export function AdminWorkspace({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;
  const parts = pathname.split('/').filter(Boolean);
  const section = parts[1];
  const detail = parts.length > 2 ? details[section] ?? 'Detalle de usuario' : null;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setOpenPath(null);
        toggle.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return <div className={styles.workspace}>
    <div className={styles.mobileBar}>
      <span>Administración JB</span>
      <button ref={toggle} type="button" className="button outline small" aria-expanded={open} aria-controls="admin-menu" onClick={() => setOpenPath(open ? null : pathname)}><UiIcon name={open ? 'close' : 'menu'} />{open ? 'Cerrar menú' : 'Menú'}</button>
    </div>
    <aside id="admin-menu" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}><AdminNav onNavigate={() => { setOpenPath(null); if (open) toggle.current?.focus(); }} /></aside>
    <div className={styles.main}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación"><ol>
        <li>{section ? <Link href="/admin">Resumen</Link> : <span aria-current="page">Resumen</span>}</li>
        {section && <li>{detail && section !== 'contratos' ? <Link href={`/admin/${section}`}>{sections[section] ?? 'Administración'}</Link> : <span aria-current={detail ? undefined : 'page'}>{sections[section] ?? 'Administración'}</span>}</li>}
        {detail && <li><span aria-current="page">{detail}</span></li>}
      </ol></nav>
      <div className="adminContent" id="contenido-admin" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
