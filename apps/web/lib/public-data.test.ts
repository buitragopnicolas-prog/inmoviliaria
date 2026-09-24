import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from './api';
import { loadPublicData } from './public-data';

test('a connection outage yields unavailable data instead of an empty catalog', async (t) => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  assert.equal(await loadPublicData('/properties'), null);
});

test('rate limits and server outages yield unavailable data', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const request = t.mock.method(globalThis, 'fetch');
  for (const status of [429, 500, 503]) {
    request.mock.mockImplementation(async () => Response.json({ message: 'Temporalmente no disponible.' }, { status }));
    assert.equal(await loadPublicData('/news'), null);
  }
});

test('a successful empty catalog remains an empty list and normal records pass through', async (t) => {
  const request = t.mock.method(globalThis, 'fetch');
  for (const data of [[], [{ id: 'property-1', title: 'Apartamento en Bogotá' }]]) {
    request.mock.mockImplementation(async () => Response.json(data));
    assert.deepEqual(await loadPublicData('/properties'), data);
  }
});

test('invalid filters and missing resources remain actionable HTTP errors', async (t) => {
  const request = t.mock.method(globalThis, 'fetch');
  for (const status of [400, 404]) {
    request.mock.mockImplementation(async () => Response.json({ message: 'Solicitud inválida.' }, { status }));
    await assert.rejects(loadPublicData('/properties'), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      return true;
    });
  }
});

test('unexpected response parsing errors are not disguised as service outages', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('not-json', { status: 200 }));
  await assert.rejects(loadPublicData('/properties'), SyntaxError);
});
