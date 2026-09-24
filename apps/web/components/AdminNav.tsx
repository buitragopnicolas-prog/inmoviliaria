import { ActiveLink } from './ActiveLink';
import { UiIcon, type IconName } from './UiIcon';

const items: Array<[string, string, IconName]> = [
  ['/admin', 'Resumen', 'grid'],
  ['/admin/inmuebles', 'Inmuebles', 'home'],
  ['/admin/usuarios', 'Usuarios', 'users'],
  ['/admin/noticias', 'Noticias', 'document'],
  ['/admin/archivos', 'Archivos', 'folder'],
  ['/admin/facturas', 'Facturas', 'document'],
  ['/admin/conciliacion', 'Conciliación', 'check'],
  ['/admin/contactos', 'Contactos', 'message'],
  ['/inmuebles', 'Ver sitio público', 'home'],
];

export function AdminNav() {
  return (
    <nav className="adminNav card" aria-label="Administración">
      <p className="navLabel">Panel administrativo</p>
      {items.map(([href, label, icon]) => <ActiveLink key={href} href={href} exact={href === '/admin'}><UiIcon name={icon} />{label}</ActiveLink>)}
    </nav>
  );
}
