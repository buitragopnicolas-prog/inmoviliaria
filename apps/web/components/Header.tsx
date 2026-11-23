import { readSite } from '@/lib/read-site';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/api';
import { logoutAction } from '@/app/actions';
import { BrandLogo } from '@/components/BrandLogo';
import { PublicNavigation } from '@/components/PublicNavigation';

export async function Header() {
  const [user, { identidad }] = await Promise.all([getCurrentUser(), readSite()]);
  return (
    <header className="header">
      <div className="container nav">
        <Link className="brand" href="/">
          <BrandLogo name={identidad.name} tagline={identidad.tagline} />
        </Link>
        <PublicNavigation copy={identidad} role={user?.role} />
        <div className="navAuth">
          {user ? (
            <form action={logoutAction}>
              <span className="welcome">Hola, {user.name.split(' ')[0]}</span>
              <button className="button ghost small" type="submit">Salir</button>
            </form>
          ) : (
            <Link className="button small" href="/login">Ingresar</Link>
          )}
        </div>
      </div>
    </header>
  );
}
