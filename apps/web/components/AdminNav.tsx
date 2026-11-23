import { ActiveLink } from './ActiveLink';
import { UiIcon, type IconName } from './UiIcon';
import styles from './AdminWorkspace.module.css';

const groups: Array<{ label: string; items: Array<[string, string, IconName]> }> = [
  { label: 'Operación', items: [['/admin', 'Resumen', 'grid'], ['/admin/usuarios', 'Usuarios', 'users']] },
  { label: 'Cobros y atención', items: [['/admin/facturas', 'Facturación', 'document'], ['/admin/conciliacion', 'Conciliación', 'check'], ['/admin/contactos', 'Contactos', 'message'], ['/admin/sugerencias','Buzón de sugerencias','message']] },
  { label: 'Ofertas', items: [['/admin/inmuebles', 'Inmuebles en arriendo', 'home'], ['/admin/ofertas', 'Ofertas de venta', 'grid']] },
  { label: 'Documentación', items: [['/admin/documentos', 'Documentos por cliente', 'users'], ['/admin/formatos', 'Formatos de arrendamiento', 'folder']] },
  { label: 'Contenido', items: [['/admin/contenido', 'Contenido del sitio', 'grid'], ['/admin/noticias', 'Boletín jurídico y noticias', 'document'], ['/admin/archivos', 'Archivos', 'folder']] },
];

export function AdminNav({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  return (
    <nav className={styles.navigation} aria-label="Administración">
      <div className={styles.navBrand}><span>JB</span><div><strong>Administración</strong><small>Asesoría Inmobiliaria</small></div></div>
      {groups.map((group) => <div className={styles.navGroup} key={group.label}><p>{group.label}</p>{group.items.map(([href, label, icon]) => <ActiveLink key={href} href={href} exact={href === '/admin'} onClick={onNavigate}><UiIcon name={icon} />{label}</ActiveLink>)}</div>)}
      <div className={styles.navFooter}><ActiveLink href="/" onClick={onNavigate}><UiIcon name="home" />Ver sitio público <span aria-hidden="true">↗</span></ActiveLink></div>
    </nav>
  );
}
