'use client';

import { defaultCopy } from '@/lib/site-content';
import { useActionState } from 'react';
import { ConsentField, usePublishedPolicy } from './ConsentField';
import { portalNames, type Portal } from '@/lib/portals';
import Link from 'next/link';
import { loginAction, registerAction } from '@/app/actions';
import { StatusNotice } from './StatusNotice';

export function AuthForm({ mode, copy = defaultCopy.formularios, buttons = defaultCopy.portales, showRegistrationLink = false, portal = 'TENANT' }: Readonly<{ copy?: typeof defaultCopy.formularios; buttons?: typeof defaultCopy.portales; mode: 'login' | 'register'; portal?: Portal; showRegistrationLink?: boolean }>) {
  const [state, action, pending] = useActionState(mode === 'login' ? loginAction : registerAction, {});
  const policy=usePublishedPolicy();
  const draft = state.values;
  const submitLabel = mode === 'login' ? buttons.signIn : buttons.register;
  return (
    <form className="form card authForm" action={action} onSubmit={event => { if (pending) event.preventDefault(); }}>
      <h1>{mode === 'login' ? copy.loginTitle : copy.registerTitle}</h1>
      <p className="muted">{mode === 'login' ? copy.loginIntro : copy.registerIntro}</p>
      {mode === 'register' && <label>Perfil de la cuenta<select name="portal" defaultValue={state.values?.portal ?? portal}>{Object.entries(portalNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>}
      {mode === 'register' && <label>Nombre completo<input name="name" autoComplete="name" defaultValue={draft?.name ?? ''} readOnly={pending} required minLength={3} /></label>}
      <label>Correo electrónico<input type="email" name="email" autoComplete="email" placeholder="nombre@correo.com" defaultValue={draft?.email ?? ''} readOnly={pending} required /></label>
      {mode === 'register' && <label>Teléfono<input name="phone" type="tel" autoComplete="tel" defaultValue={draft?.phone ?? ''} readOnly={pending} /></label>}
      <label>Contraseña<input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} readOnly={pending} required minLength={8} /></label>
      {mode === 'register' && <ConsentField purpose="crear y administrar mi cuenta"/>}
      {!pending && state.error && <StatusNotice message={state.error} tone="error" />}
      <button type="submit" className="button wide" disabled={mode === 'register' && !policy.version} aria-busy={pending} aria-disabled={pending}>{pending ? 'Procesando…' : submitLabel}</button>
      {(mode === 'register' || showRegistrationLink) && (
        <p className="center muted">{mode === 'login' ? <>¿No tienes cuenta? <Link href="/registro">Regístrate</Link></> : <>¿Ya tienes cuenta? <Link href="/login">Ingresa</Link></>}</p>
      )}
    </form>
  );
}
