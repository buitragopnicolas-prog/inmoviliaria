'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export type ActionState = { error?: string; success?: string };

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
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
      maxAge: 60 * 60 * 24,
    });
    redirect(response.user.role === 'ADMIN' ? '/admin' : '/mi-cuenta');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: messageOf(error) };
  }
}

export async function registerAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const response = await apiFetch<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone'), password: formData.get('password'),
      }),
    });
    (await cookies()).set('inmo_token', response.accessToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 86400 });
    redirect('/mi-cuenta');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { error: messageOf(error) };
  }
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete('inmo_token');
  redirect('/');
}

export async function contactAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await apiFetch('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'), email: formData.get('email'), phone: formData.get('phone'), subject: formData.get('subject'), message: formData.get('message'),
      }),
    });
    return { success: 'Recibimos tu solicitud. Un asesor se comunicará contigo.' };
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
  try {
    const id = String(formData.get('id'));
    formData.delete('id');
    await apiFetch(`/admin/properties/${id}`, { method: 'PATCH', body: formData }, true);
    revalidatePath('/admin/inmuebles');
    revalidatePath(`/admin/inmuebles/${id}/editar`);
    revalidatePath('/inmuebles');
    revalidatePath('/');
    return { success: 'El inmueble fue actualizado correctamente.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
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
    await apiFetch('/admin/news', {
      method: 'POST',
      body: JSON.stringify({
        title: formData.get('title'),
        summary: formData.get('summary'),
        content: formData.get('content'),
        sourceLabel: sourceLabel || undefined,
        externalUrl: externalUrl || undefined,
        published: true,
      }),
    }, true);
    revalidatePath('/admin/noticias');
    revalidatePath('/noticias');
    revalidatePath('/');
    return { success: 'La noticia fue publicada correctamente.' };
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
        leaseId: formData.get('leaseId'),
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
  await apiFetch(`/payments/mock/${encodeURIComponent(reference)}/approve`, { method: 'POST' }, true);
  revalidatePath('/mi-cuenta');
  redirect('/mi-cuenta?pago=aprobado');
}

export async function reportManualPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const invoiceId = String(formData.get('invoiceId'));
    formData.delete('invoiceId');
    await apiFetch(`/payments/invoices/${invoiceId}/manual-report`, { method: 'POST', body: formData }, true);
    revalidatePath(`/mi-cuenta/facturas/${invoiceId}/pagar`);
    revalidatePath('/mi-cuenta');
    return { success: 'Recibimos tu reporte de pago. Quedó pendiente de verificación.' };
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function reviewManualPaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const paymentId = String(formData.get('paymentId'));
    await apiFetch(`/payments/manual/${paymentId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision: formData.get('decision'), note: formData.get('note') || undefined }),
    }, true);
    revalidatePath('/admin/conciliacion');
    revalidatePath('/admin/facturas');
    revalidatePath('/mi-cuenta');
    return { success: 'La decisión quedó registrada en la trazabilidad del pago.' };
  } catch (error) {
    return { error: messageOf(error) };
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
