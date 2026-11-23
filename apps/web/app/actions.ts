'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { paymentAccountHref, paymentStatusLabel } from '@/lib/payment-status';
import { isLocalRegistrationEnabled } from '@/lib/registration-policy';
import { adminReturnHref, readAdminQuery } from '@/lib/admin-lists';

export type ActionState = { error?: string; success?: string };
export type AuthState = ActionState & { values?: { email: string; name?: string; phone?: string; portal?: string } };
export type ContactState = ActionState & { values?: { name: string; email: string; phone: string; subject: string; message: string } };

function textField(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

const authCookieMaxAge = Math.min(Math.max(Number(process.env.AUTH_COOKIE_MAX_AGE_SECONDS ?? 3600) || 3600, 300), 3600);

export async function loginAction(_previous: AuthState, formData: FormData): Promise<AuthState> {
  try {
    const response = await apiFetch<{ accessToken: string; user: { role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: formData.get('email'), password: formData.get('password') }),
    });
    (await cookies()).set('inmo_token', response.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: authCookieMaxAge,
    });
    redirect(response.user.role === 'ADMIN' ? '/admin' : '/mi-cuenta');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: messageOf(error), values: { email: textField(formData, 'email') } };
  }
}

export async function registerAction(_previous: AuthState, formData: FormData): Promise<AuthState> {
  if (!isLocalRegistrationEnabled()) return { error: 'El registro público no está habilitado. Solicita la activación de tu cuenta a un asesor.' };
  try {
    const response = await apiFetch<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        authorized: formData.get('authorized')==='true', policyVersion:formData.get('policyVersion'), portal:formData.get('portal'),
        name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone'), password: formData.get('password'),
      }),
    });
    (await cookies()).set('inmo_token', response.accessToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: authCookieMaxAge });
    redirect('/mi-cuenta');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: messageOf(error), values: { email: textField(formData, 'email'), name: textField(formData, 'name'), phone: textField(formData, 'phone'), portal:textField(formData,'portal') } };
  }
}

export async function enterClientLogin(): Promise<void> {
  (await cookies()).delete('inmo_token');
  redirect('/login');
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete('inmo_token');
  redirect('/');
}

export async function contactAction(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const values = {
    name: textField(formData, 'name'), email: textField(formData, 'email'), phone: textField(formData, 'phone'),
    subject: textField(formData, 'subject'), message: textField(formData, 'message'),
  };
  try {
    await apiFetch('/contacts', {
      method: 'POST',
      body: JSON.stringify({...values, authorized:formData.get('authorized')==='true', policyVersion:formData.get('policyVersion')}),
    });
    return { success: 'Recibimos tu solicitud. Un asesor se comunicará contigo.' };
  } catch (error) {
    return { error: messageOf(error), values };
  }
}

export async function updateContactStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id');
  const status = formData.get('status');
  if (typeof id !== 'string' || !id || typeof status !== 'string' || !['NEW', 'REVIEWED', 'CLOSED'].includes(status)) {
    return { error: 'Selecciona un estado válido para el contacto.' };
  }
  try {
    await apiFetch(`/admin/contacts/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, true);
    revalidatePath('/admin/contactos');
    revalidatePath('/admin');
    return { success: 'Estado del contacto actualizado.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function createPropertyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/admin/properties', { method: 'POST', body: formData }, true);
    revalidatePath('/admin/inmuebles');
    revalidatePath('/inmuebles');
    return { success: 'El inmueble fue publicado correctamente.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function updatePropertyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const id = textField(formData, 'id');
  const list = formData.get('lista');
  const payload = new FormData();
  for (const [key, value] of formData) {
    if (key !== 'id' && key !== 'lista' && !key.startsWith('$ACTION_')) payload.append(key, value);
  }
  try {
    await apiFetch(`/admin/properties/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }, true);
    revalidatePath('/admin/inmuebles');
    revalidatePath(`/admin/inmuebles/${id}/editar`);
    revalidatePath('/inmuebles');
    revalidatePath('/');
  } catch (error) {
    return { error: messageOf(error) };
  }
  if (typeof list === 'string') redirect(adminReturnHref('/admin/inmuebles', readAdminQuery(Object.fromEntries(new URLSearchParams(list))), id));
  return { success: 'El inmueble fue actualizado correctamente.' };
}

export async function deletePropertyAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch(`/admin/properties/${String(formData.get('id'))}`, { method: 'DELETE' }, true);
    revalidatePath('/admin/inmuebles');
    revalidatePath('/inmuebles');
    revalidatePath('/');
    return { success: 'El inmueble fue retirado del catálogo. Cuando existe historial, queda archivado para conservar contratos, facturas y pagos.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}


export async function createAdminUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        documentNumber: formData.get('documentNumber'),
      }),
    }, true);
    revalidatePath('/admin/usuarios');
    return { success: 'El usuario fue creado correctamente.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function assignPropertyToUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const userId = String(formData.get('userId'));
    await apiFetch(`/admin/users/${userId}/assign-property`, {
      method: 'POST',
      body: JSON.stringify({
        propertyId: formData.get('propertyId'),
        leaseStartDate: formData.get('leaseStartDate'),
        leaseEndDate: formData.get('leaseEndDate'),
        expectedMonthlyPayment: formData.get('expectedMonthlyPayment'),
        createCurrentInvoice: formData.get('createCurrentInvoice') === 'true',
        invoiceDueDate: formData.get('invoiceDueDate'),
      }),
    }, true);
    revalidatePath('/admin/usuarios');
    revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/admin/inmuebles');
    revalidatePath('/admin/facturas');
    revalidatePath('/inmuebles');
    revalidatePath('/');
    return { success: 'El inmueble fue asignado y retirado del listado de disponibles.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function createNewsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const sourceLabel = String(formData.get('sourceLabel') ?? '').trim();
    const externalUrl = String(formData.get('externalUrl') ?? '').trim();
    const id = textField(formData,'id');
    const body = new FormData();
    for (const key of ['title','summary','content','category']) {
      if (formData.has(key)) body.set(key, textField(formData,key));
    }
    if (sourceLabel) body.set('sourceLabel',sourceLabel);
    if (externalUrl) body.set('externalUrl',externalUrl);
    if (formData.has('additionalLinks')) {
      const links=textField(formData,'additionalLinks').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
      if (links.length) for (const link of links) body.append('additionalLinks',link);
      else body.set('additionalLinks','');
    }
    body.set('published',String(formData.get('visibility')!=='draft'));
    for (const value of formData.getAll('removePdfIds')) body.append('removePdfIds',String(value));
    const pdfs=formData.getAll('pdfs').filter((file):file is File=>file instanceof File && file.size>0);
    if(pdfs.length>3 || pdfs.some(file=>file.size>8_000_000)) return {error:'Selecciona hasta tres PDF de 8 MB cada uno.'};
    for (const file of pdfs) body.append('pdfs',file);
    await apiFetch(id ? '/admin/news/'+encodeURIComponent(id) : '/admin/news', {
      method: id ? 'PUT' : 'POST', body,
    }, true);
    revalidatePath('/admin/noticias');
    revalidatePath('/noticias');
    revalidatePath('/');
    return { success: formData.get('visibility') === 'draft' ? 'Borrador guardado.' : 'Artículo publicado.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function archiveNewsAction(formData: FormData): Promise<void> {
  await apiFetch(`/admin/news/${String(formData.get('id'))}`, { method: 'DELETE' }, true);
  revalidatePath('/admin/noticias');
  revalidatePath('/noticias');
  revalidatePath('/');
}

export async function createInvoiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const services = parseInvoiceItems(formData.get('services'));
    const products = parseInvoiceItems(formData.get('products'));
    await apiFetch('/admin/invoices', {
      method: 'POST',
      body: JSON.stringify({
        ...(String(formData.get('leaseId')).startsWith('account:') ? {accountId:String(formData.get('leaseId')).slice(8)} : {leaseId:formData.get('leaseId')}),
        period: formData.get('period'),
        dueDate: formData.get('dueDate'),
        services,
        products,
      }),
    }, true);
    revalidatePath('/admin/facturas');
    return { success: 'Factura generada exitosamente.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function updateInvoiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = String(formData.get('id'));
    const tenantId = String(formData.get('tenantId') ?? '');
    const amount = Number(formData.get('amount'));
    await apiFetch(`/admin/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : undefined,
        status: formData.get('status'),
        period: formData.get('period'),
        dueDate: formData.get('dueDate'),
        note: formData.get('note'),
      }),
    }, true);
    revalidatePath('/admin/facturas');
    revalidatePath('/admin/usuarios');
    if (tenantId) revalidatePath(`/admin/usuarios/${tenantId}`);
    revalidatePath('/mi-cuenta');
    return { success: 'La factura y su saldo fueron actualizados.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function deleteInvoiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = String(formData.get('id'));
    const tenantId = String(formData.get('tenantId') ?? '');
    await apiFetch(`/admin/invoices/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: formData.get('reason') }),
    }, true);
    revalidatePath('/admin/facturas');
    revalidatePath('/admin/usuarios');
    if (tenantId) revalidatePath(`/admin/usuarios/${tenantId}`);
    revalidatePath('/mi-cuenta');
    return { success: 'La factura fue eliminada del sistema visible. Su trazabilidad técnica se conserva.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function uploadLeaseContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const leaseId = String(formData.get('leaseId'));
    const userId = String(formData.get('userId') ?? '');
    formData.delete('leaseId');
    formData.delete('userId');
    await apiFetch(`/admin/leases/${leaseId}/contract`, { method: 'POST', body: formData }, true);
    revalidatePath('/admin/usuarios');
    if (userId) revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/mi-cuenta');
    return { success: 'El contrato firmado quedó disponible para el usuario.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function removeLeaseContractAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const leaseId = String(formData.get('leaseId'));
    const userId = String(formData.get('userId') ?? '');
    await apiFetch(`/admin/leases/${leaseId}/contract`, { method: 'DELETE' }, true);
    revalidatePath('/admin/usuarios');
    if (userId) revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/mi-cuenta');
    return { success: 'El PDF del contrato fue retirado.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function uploadFilesAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/admin/files', { method: 'POST', body: formData }, true);
    revalidatePath('/admin/archivos');
    return { success: 'Los archivos quedaron cargados y disponibles para compartir.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function beginPaymentAction(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get('invoiceId'));
  const intent = await apiFetch<{ provider: string; checkoutUrl: string | null; payment: { reference: string } }>(`/payments/invoices/${invoiceId}/intent`, { method: 'POST' }, true);
  if (intent.checkoutUrl) redirect(intent.checkoutUrl);
  redirect(`/mi-cuenta/facturas/${invoiceId}/pagar?reference=${encodeURIComponent(intent.payment.reference)}`);
}

export async function approveMockAction(formData: FormData): Promise<void> {
  const reference = String(formData.get('reference'));
  const payment = await apiFetch<{ reference: string }>(`/payments/mock/${encodeURIComponent(reference)}/approve`, { method: 'POST' }, true);
  revalidatePath('/mi-cuenta');
  redirect(paymentAccountHref(payment.reference));
}

export async function reportManualPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const invoiceId = String(formData.get('invoiceId'));
    const report = new FormData();
    for (const key of ['method', 'amount', 'bankReference', 'paidAt', 'idempotencyKey', 'receipt', 'authorized', 'policyVersion']) {
      const value = formData.get(key);
      if (value !== null) report.set(key, value);
    }
    const payment = await apiFetch<{ status: string; reference: string }>(`/payments/invoices/${encodeURIComponent(invoiceId)}/manual-report`, { method: 'POST', body: report }, true);
    revalidatePath(`/mi-cuenta/facturas/${invoiceId}/pagar`);
    revalidatePath('/mi-cuenta');
    return { success: `${paymentStatusLabel(payment.status)}. Referencia ${payment.reference}.` };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function reviewManualPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState & { paymentId?: string }> {
  const paymentId = String(formData.get('paymentId'));
  try {
    const payment = await apiFetch<{ invoiceId: string; reference: string; status: string }>(`/payments/manual/${encodeURIComponent(paymentId)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision: formData.get('decision'), note: formData.get('note') || undefined }),
    }, true);
    revalidatePath('/admin/conciliacion');
    revalidatePath('/admin/facturas');
    revalidatePath('/mi-cuenta');
    revalidatePath(`/mi-cuenta/facturas/${payment.invoiceId}/pagar`);
    return { success: `${paymentStatusLabel(payment.status)}. Referencia ${payment.reference}.`, paymentId };
  } catch (error) {
    return { error: messageOf(error), paymentId };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'No fue posible procesar la solicitud.';
}

function isRedirectError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'digest' in error && String((error as { digest?: string }).digest).startsWith('NEXT_REDIRECT');
}

function parseInvoiceItems(raw: FormDataEntryValue | null): Array<{ itemId: string; quantity: number }> {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ itemId?: unknown; quantity?: unknown }>;
    return parsed
      .filter((item) => typeof item.itemId === 'string' && item.itemId.length > 0)
      .map((item) => {
        const quantity = Number(item.quantity ?? 1);
        return {
          itemId: String(item.itemId),
          quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
        };
      });
  } catch {
    return [];
  }
}
