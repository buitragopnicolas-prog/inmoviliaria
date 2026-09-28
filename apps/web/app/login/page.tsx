import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';

export const metadata: Metadata = { title: 'Ingresar' };
export default function LoginPage() {
  return <section className="authSection"><AuthForm mode="login" showRegistrationLink={isLocalRegistrationEnabled()} /></section>;
}
