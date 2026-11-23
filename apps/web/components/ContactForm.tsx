'use client';

import { useActionState } from 'react';
import { contactAction } from '@/app/actions';
import { ConsentField, usePublishedPolicy } from './ConsentField';
import { StatusNotice } from './StatusNotice';

export function ContactForm({ propertyTitle, initialSubject = '' }: Readonly<{ propertyTitle?: string; initialSubject?: string }>) {
  const [state, action, pending] = useActionState(contactAction, {});
  const policy=usePublishedPolicy();
  const draft = state.values;
  return (
    <form className="form contactForm" action={action} onSubmit={event => { if (pending) event.preventDefault(); }}>
      <label>Nombre<input name="name" autoComplete="name" defaultValue={draft?.name ?? ''} readOnly={pending} minLength={3} maxLength={120} required /></label>
      <div className="twoCols">
        <label>Correo<input type="email" name="email" autoComplete="email" placeholder="nombre@correo.com" defaultValue={draft?.email ?? ''} readOnly={pending} maxLength={254} required /></label>
        <label>Teléfono<input name="phone" type="tel" autoComplete="tel" defaultValue={draft?.phone ?? ''} readOnly={pending} maxLength={30} /></label>
      </div>
      <label>Asunto<input name="subject" defaultValue={draft?.subject ?? (propertyTitle ? `Información: ${propertyTitle}` : initialSubject)} readOnly={pending} minLength={3} maxLength={160} required /></label>
      <label>Mensaje<textarea name="message" rows={5} defaultValue={draft?.message ?? (propertyTitle ? 'Me interesa este inmueble. Deseo recibir información y agendar una visita.' : '')} readOnly={pending} minLength={10} maxLength={4000} required /></label>
      <ConsentField/>
      {!pending && state.error && <StatusNotice message={state.error} tone="error" />}
      {!pending && state.success && <StatusNotice message={state.success} tone="success" />}
      <button type="submit" className="button" disabled={!policy.version} aria-busy={pending} aria-disabled={pending}>{pending ? 'Enviando…' : 'Enviar solicitud'}</button>
    </form>
  );
}
