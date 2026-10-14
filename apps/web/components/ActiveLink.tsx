'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ActiveLink({ href, children, exact = false, onClick, onKeyDown }: { href: string; children: React.ReactNode; exact?: boolean; onClick?: React.MouseEventHandler<HTMLAnchorElement>; onKeyDown?: React.KeyboardEventHandler<HTMLAnchorElement> }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && href !== '/' && pathname.startsWith(`${href}/`));
  return <Link href={href} aria-current={active ? 'page' : undefined} onClick={onClick} onKeyDown={onKeyDown}>{children}</Link>;
}
