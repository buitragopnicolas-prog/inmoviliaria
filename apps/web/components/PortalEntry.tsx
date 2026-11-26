import Link from 'next/link';
import { getCurrentUser } from '@/lib/api';
import { portalPaths, type Portal } from '@/lib/portals';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';
import { enterClientLogin } from '@/app/actions';
import { readSite } from '@/lib/read-site';
import { PortalPhoto } from './business/PortalPhoto';
import { Reveal } from './Reveal';

export async function PortalEntry({portal}:Readonly<{portal:Portal}>) {
  const [user,{catalogos:c,portales:p}]=await Promise.all([getCurrentUser(),readSite()]);
  const details={TENANT:[c.tenantTitle,c.tenantIntro],OWNER:[c.ownerTitle,c.ownerIntro],SERVICES:[c.clientTitle,c.clientIntro]}[portal];
  const current=user?.role==='USER' && user.portal===portal;
  const loginAction = user
    ? <form action={enterClientLogin}><button type="submit" className="button">{p.switchAccount}</button></form>
    : <Link className="button" href="/login">{p.signIn}</Link>;
  return <section className="section pageTop"><Reveal className="container portalCover"><div><div className="pageHeading">
    <h1>{details[0]}</h1><p>{details[1]}</p></div><div className="portalLinks">
    {current ? <Link className="button" href={portal==='OWNER'?'/propietarios/publicaciones':'/mi-cuenta'}>{portal==='OWNER'?p.manage:c.clientButton}</Link> :
      loginAction}
    {!user && isLocalRegistrationEnabled() && <Link className="button outline" href={'/registro?perfil='+portalPaths[portal].slice(1)}>{p.register}</Link>}
    {current && portal==='OWNER' && <Link className="textLink" href="/mi-cuenta">{p.billing}</Link>}
    </div></div><PortalPhoto portal={portal} copy={p}/></Reveal></section>;
}
