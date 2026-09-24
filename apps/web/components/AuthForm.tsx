'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { ActionState } from '@/app/actions';
import { loginAction, registerAction } from '@/app/actions';

const initial: ActionState = {};

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const [state, action, pending] = useActionState(mode === 'login' ? loginAction : registerAction, initial);
  return (
    <form className="form card authForm" action={action}>
      <h1>{mode === 'login' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</h1>
      <p className="muted">{mode === 'login' ? 'Consulta tus facturas y pagos.' : 'Administra tus pagos de arriendo de forma segura.'}</p>
      {mode === 'register' && <label>Nombre completo<input name="name" autoComplete="name" required minLength={3} /></label>}
      <label>Correo electrónico<input type="email" name="email" autoComplete="email" placeholder="nombre@correo.com" required /></label>
      {mode === 'register' && <label>Teléfono<input name="phone" type="tel" autoComplete="tel" /></label>}
      <label>Contraseña<input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} /></label>
      {state.error && <p className="alert error" role="alert">{state.error}</p>}
      <button className="button wide" disabled={pending}>{pending ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      <p className="center muted">{mode === 'login' ? <>¿No tienes cuenta? <Link href="/registro">Regístrate</Link></> : <>¿Ya tienes cuenta? <Link href="/login">Ingresa</Link></>}</p>
    </form>
  );
}
