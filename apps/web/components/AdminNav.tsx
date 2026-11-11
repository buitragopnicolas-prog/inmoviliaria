import { ActiveLink } from './ActiveLink';
import { UiIcon, type IconName } from './UiIcon';
import styles from './AdminWorkspace.module.css';

const groups: Array<{ label: string; items: Array<[string, string, IconName]> }> = [
  { label: 'Operación', items: [['/admin', 'Resumen', 'grid'], ['/admin/inmuebles', 'Inmuebles', 'home'], ['/admin/usuarios', 'Usuarios', 'users']] },
  { label: 'Cobros y atención', items: [['/admin/facturas', 'Facturación', 'document'], ['/admin/conciliacion', 'Conciliación', 'check'], ['/admin/contactos', 'Contactos', 'message']] },
  { label: 'Contenido', items: [['/admin/noticias', 'Noticias', 'document'], ['/admin/archivos', 'Archivos', 'folder']] },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className={styles.navigation} aria-label="Administración">
      <div className={styles.navBrand}><span>JB</span><div><strong>Administración</strong><small>Asesoría Inmobiliaria</small></div></div>
      {groups.map((group) => <div className={styles.navGroup} key={group.label}><p>{group.label}</p>{group.items.map(([href, label, icon]) => <ActiveLink key={href} href={href} exact={href === '/admin'} onClick={onNavigate}><UiIcon name={icon} />{label}</ActiveLink>)}</div>)}
      <div className={styles.navFooter}><ActiveLink href="/inmuebles" onClick={onNavigate}><UiIcon name="home" />Ver sitio público <span aria-hidden="true">↗</span></ActiveLink></div>
    </nav>
  );
}
