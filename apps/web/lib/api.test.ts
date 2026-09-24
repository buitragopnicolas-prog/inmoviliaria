import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, apiFetch } from './api';

test('preserves HTTP status and API messages for missing resources and invalid forms', async (t) => {
  const cases = [
    { status: 404, body: { message: 'Inmueble no encontrado.' }, message: 'Inmueble no encontrado.' },
    { status: 400, body: { message: ['El nombre es obligatorio.', 'El correo no es válido.'] }, message: 'El nombre es obligatorio., El correo no es válido.' },
    { status: 503, body: null, message: 'No fue posible procesar la solicitud.' },
  ];
  const request = t.mock.method(globalThis, 'fetch');
  for (const { status, body, message } of cases) {
    request.mock.mockImplementation(async () => Response.json(body, { status }));
    await assert.rejects(apiFetch('/properties/example'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test('keeps the HTTP status when a proxy returns an HTML error instead of JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<h1>Bad Gateway</h1>', { status: 502 }));
  await assert.rejects(apiFetch('/news'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.message, 'No fue posible procesar la solicitud.');
    return true;
  });
});

test('reports connection failures in Spanish, retains their cause and never repeats a mutation', async (t) => {
  const cause = new TypeError('fetch failed');
  const request = t.mock.method(globalThis, 'fetch', async () => { throw cause; });
  await assert.rejects(apiFetch('/contacts', { method: 'POST', body: '{}' }), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.equal(error.cause, cause);
    assert.match(error.message, /No fue posible conectar con el servicio/);
    return true;
  });
  assert.equal(request.mock.callCount(), 1);
});

test('returns successful JSON and leaves multipart Content-Type to fetch', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).has('Content-Type'), false);
    assert.equal(init.cache, 'no-store');
    return Response.json({ id: 'uploaded-file' });
  });
  const data = new FormData();
  data.set('title', 'Inmueble');
  assert.deepEqual(await apiFetch('/admin/properties', { method: 'POST', body: data }), { id: 'uploaded-file' });
  assert.equal(request.mock.callCount(), 1);
});
