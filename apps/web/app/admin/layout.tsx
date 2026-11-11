import { AdminWorkspace } from '@/components/AdminWorkspace';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { logoutAction } from '@/app/actions';
import styles from '@/components/AdminWorkspace.module.css';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser('ADMIN');
  return <>
    <header className={styles.topbar}>
      <Link href="/" aria-label="Asesoría Inmobiliaria JB, inicio"><BrandLogo /></Link>
      <span className={styles.workspaceLabel}>Panel administrativo</span>
      <div className={styles.account}><span>{user.name}</span><form action={logoutAction}><button className="button outline small" type="submit">Salir</button></form></div>
    </header>
    <AdminWorkspace>{children}</AdminWorkspace>
  </>;
}
