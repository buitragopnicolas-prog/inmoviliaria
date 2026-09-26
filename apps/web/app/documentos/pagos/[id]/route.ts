import { cookies } from 'next/headers';
import { apiBaseUrl } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = (await cookies()).get('inmo_token')?.value;
  if (!token) return new Response('No autorizado.', { status: 401 });
  const { id } = await params;
  const upstream = await fetch(`${apiBaseUrl()}/api/payments/receipts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) return new Response('No fue posible abrir el comprobante.', { status: upstream.status });
  const headers = new Headers();
  for (const name of ['content-type', 'content-length', 'content-disposition']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(upstream.body, { status: 200, headers });
}
