import { readSite } from '@/lib/read-site';
import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';

export const metadata: Metadata = { title: 'Ingresar' };
export default async function LoginPage() {
  const {formularios,portales}=await readSite();
  return <section className="authSection"><AuthForm copy={formularios} buttons={portales} mode="login" showRegistrationLink={isLocalRegistrationEnabled()} /></section>;
}
