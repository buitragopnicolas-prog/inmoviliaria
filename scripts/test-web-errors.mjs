import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

// An isolated API double exercises outage states without touching DEV or customer data.
let mode = 'unavailable';
let apiCalls = 0;
const api = createServer((request, response) => {
  apiCalls++;
  const path = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Content-Type', 'application/json');
  if (mode === 'unavailable' || (mode === 'partial' && path.startsWith('/api/news'))) {
    response.writeHead(503).end(JSON.stringify({ message: 'Service unavailable' }));
  } else if (/^\/api\/(properties|news)\/missing$/.test(path)) {
    response.writeHead(404).end(JSON.stringify({ message: 'Not found' }));
  } else {
    response.end('[]');
  }
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));

// Reserve a free web port instead of conflicting with the developer's running app.
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const webPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${webPort}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', 'apps/web', '--hostname', '127.0.0.1', '--port', String(webPort)], {
  env: { ...process.env, NODE_ENV: 'production', API_INTERNAL_URL: `http://127.0.0.1:${api.address().port}`, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
const exited = once(server, 'exit');
let checks = 0;
async function page(path, status, expected, absent = []) {
  const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  assert.equal(response.status, status, `${path}: HTTP ${response.status}`);
  for (const text of expected) assert.ok(html.includes(text), `${path}: missing ${text}`);
  for (const text of absent) assert.ok(!html.includes(text), `${path}: unexpected ${text}`);
  checks++;
  console.log(`PASS ${mode} ${path}`);
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Web server exited: ${output}`);
    try {
      ready = (await fetch(`${origin}/brand/favicon.svg`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch { /* Wait for the server to bind its port. */ }
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, `Web server did not start: ${output}`);
  await page('/', 200, ['Tu inmueble.', 'los inmuebles destacados', 'No pudimos cargar', 'Volver a intentar'], ['Pronto publicaremos novedades']);
  await page('/inmuebles', 200, ['No pudimos cargar'], ['No hay inmuebles que coincidan']);
  await page('/noticias', 200, ['No pudimos cargar'], ['Aún no hay noticias']);

  const beforeInvalidQuery = apiCalls;
  await page('/inmuebles?maxRent=-1', 200, ['Revisa los filtros indicados', 'max-rent-error'], ['No hay inmuebles que coincidan']);
  assert.equal(apiCalls, beforeInvalidQuery, 'Invalid filters or an anonymous header must not query the API');

  mode = 'partial';
  await page('/', 200, ['Tu inmueble.', 'Consulta el catálogo', 'No pudimos cargar'], ['Pronto publicaremos novedades']);

  mode = 'healthy';
  await page('/', 200, ['Consulta el catálogo', 'Pronto publicaremos novedades'], ['No pudimos cargar']);
  await page('/inmuebles', 200, ['No hay inmuebles que coincidan'], ['No pudimos cargar']);
  await page('/noticias', 200, ['Aún no hay noticias'], ['No pudimos cargar']);
  await page('/inmuebles/missing', 404, ['No encontramos lo que buscas', 'noindex']);
  await page('/noticias/missing', 404, ['No encontramos lo que buscas', 'noindex']);
  console.log(`${checks} web regression checks passed.`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  server.kill();
  await exited;
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
}
