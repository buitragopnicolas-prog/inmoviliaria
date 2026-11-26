import { portalPaths, type Portal } from '@/lib/portals';
import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { notFound } from 'next/navigation';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';

export const metadata: Metadata = { title: 'Crear cuenta' };
export default async function RegisterPage({searchParams}:Readonly<{searchParams:Promise<{perfil?:string}>}>) {
  if (!isLocalRegistrationEnabled()) notFound();
  const {perfil}=await searchParams;
  const portal=(Object.keys(portalPaths) as Portal[]).find(key=>portalPaths[key]==='/'+perfil) ?? 'TENANT';
  const {formularios,portales}=await readSite();
  return <section className="authSection"><AuthForm copy={formularios} buttons={portales} mode="register" portal={portal} /></section>;
}
