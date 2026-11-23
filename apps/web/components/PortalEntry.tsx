import Link from 'next/link';
import { getCurrentUser } from '@/lib/api';
import { portalPaths, type Portal } from '@/lib/portals';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';
import { enterClientLogin } from '@/app/actions';
import { readSite } from '@/lib/read-site';
import { Reveal } from './Reveal';

export async function PortalEntry({portal}:Readonly<{portal:Portal}>) {
  const [user,{catalogos:c}]=await Promise.all([getCurrentUser(),readSite()]);
  const details={TENANT:[c.tenantTitle,c.tenantIntro],OWNER:[c.ownerTitle,c.ownerIntro],SERVICES:[c.clientTitle,c.clientIntro]}[portal];
  const current=user?.role==='USER' && user.portal===portal;
  const loginAction = user
    ? <form action={enterClientLogin}><button type="submit" className="button">Cambiar de cuenta</button></form>
    : <Link className="button" href="/login">Ingresar</Link>;
  return <section className="section pageTop"><Reveal className="container"><div className="pageHeading">
    <h1>{details[0]}</h1><p>{details[1]}</p></div><div className="portalLinks">
    {current ? <Link className="button" href={portal==='OWNER'?'/propietarios/publicaciones':'/mi-cuenta'}>{portal==='OWNER'?'Administrar mis publicaciones':c.clientButton}</Link> :
      loginAction}
    {!user && isLocalRegistrationEnabled() && <Link className="button outline" href={'/registro?perfil='+portalPaths[portal].slice(1)}>Crear cuenta</Link>}
    {current && portal==='OWNER' && <Link className="textLink" href="/mi-cuenta">Mis facturas y documentos</Link>}
    </div></Reveal></section>;
}
