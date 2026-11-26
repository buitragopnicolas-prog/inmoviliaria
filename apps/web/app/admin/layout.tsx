import { readSite } from '@/lib/read-site';
import { AdminWorkspace } from '@/components/AdminWorkspace';
import { requireUser } from '@/lib/auth';
import { FinancialTicker } from '@/components/business/FinancialTicker';
import { WorldClocks } from '@/components/business/WorldClocks';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { logoutAction } from '@/app/actions';
import styles from '@/components/AdminWorkspace.module.css';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, { identidad, mercados, presencia, relojes }] = await Promise.all([requireUser('ADMIN'), readSite()]);
  return <>
    <header className={styles.adminHeader}><div className={styles.topbar}>
      <Link href="/" aria-label={`${identidad.name}, inicio`}><BrandLogo image={identidad.headerLogo} name={identidad.name} /></Link>
      <span className={styles.workspaceLabel}>Panel administrativo</span>
      <div className={styles.account}><span>{user.name}</span><form action={logoutAction}><button className="button outline small" type="submit">{identidad.logout}</button></form></div>
    </div><FinancialTicker copy={mercados} places={presencia}/></header>
    <AdminWorkspace>{children}</AdminWorkspace>
    <footer><WorldClocks copy={relojes} initialTime={Date.now()}/></footer>
  </>;
}
