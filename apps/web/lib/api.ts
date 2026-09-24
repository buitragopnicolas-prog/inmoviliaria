import { cookies } from 'next/headers';
import type { User } from './types';

export const apiBaseUrl = () => process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = (await cookies()).get('inmo_token')?.value;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api${path}`, { ...init, headers, cache: 'no-store' });
  } catch (cause) {
    // Keep the transport failure distinct from an HTTP response without retrying mutations.
    throw new ApiError(0, 'No fue posible conectar con el servicio. Intenta nuevamente en unos momentos.', { cause });
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'No fue posible procesar la solicitud.' }));
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message;
    throw new ApiError(response.status, typeof message === 'string' ? message : 'No fue posible procesar la solicitud.');
  }
  return response.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    if (!(await cookies()).get('inmo_token')?.value) return null;
    return await apiFetch<User>('/auth/me', {}, true);
  } catch {
    return null;
  }
}
