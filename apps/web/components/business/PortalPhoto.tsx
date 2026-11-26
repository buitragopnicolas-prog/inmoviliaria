import { defaultCopy, type SiteCopy } from '@/lib/site-content';
import type { Portal } from '@/lib/portals';
import { EditorialPhoto } from '../EditorialPhoto';

export const portalKey = {TENANT:'tenant',OWNER:'owner',SERVICES:'client'} as const;
export function PortalPhoto({portal,copy}:Readonly<{portal:Portal;copy:SiteCopy['portales']}>) {
  const key=portalKey[portal];
  return <EditorialPhoto className="portalPhoto" src={copy[`${key}Photo`]} alt={copy[`${key}Alt`]}
    fallback={defaultCopy.portales[`${key}Photo`]} fallbackAlt={defaultCopy.portales[`${key}Alt`]} width={1200} height={800}/>;
}
