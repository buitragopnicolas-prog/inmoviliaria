import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { notFound } from 'next/navigation';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';

export const metadata: Metadata = { title: 'Crear cuenta' };
export default function RegisterPage() {
  if (!isLocalRegistrationEnabled()) notFound();
  return <section className="authSection"><AuthForm mode="register" /></section>;
}
