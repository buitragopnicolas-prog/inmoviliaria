import { readSite } from '@/lib/read-site';
import { FinancialTicker } from './business/FinancialTicker';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/api';
import { logoutAction } from '@/app/actions';
import { BrandLogo } from '@/components/BrandLogo';
import { PublicNavigation } from '@/components/PublicNavigation';

export async function Header() {
  const [user, { identidad, mercados, presencia, portales }] = await Promise.all([getCurrentUser(), readSite()]);
  return (
    <header className="header glass-panel glass-panel-jb">
      <div className="container nav">
        <Link className="brand" href="/">
          <BrandLogo image={identidad.headerLogo} name={identidad.name} />
        </Link>
        <PublicNavigation copy={identidad} role={user?.role} />
        <div className="navAuth">
          {user ? (
            <form action={logoutAction}>
              <span className="welcome">Hola, {user.name.split(' ')[0]}</span>
              <button className="button ghost small" type="submit">{identidad.logout}</button>
            </form>
          ) : (
            <Link className="button small" href="/login">{portales.signIn}</Link>
          )}
        </div>
      </div>
      <FinancialTicker copy={mercados} places={presencia}/>
    </header>
  );
}
