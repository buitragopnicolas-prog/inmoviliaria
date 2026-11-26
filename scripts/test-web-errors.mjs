import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { holdCatalogSearch, verifyCatalogInEdge } from './catalog-edge.mjs';

// An isolated API double exercises outage states without touching DEV or customer data.
const localDesign = process.argv.includes('--portadas');
const publishedDesign = process.argv.includes('--dev-portada');
let mode = 'unavailable';
let apiCalls = 0;
const catalogGate = Promise.withResolvers();
const inventoryRequested = Promise.withResolvers();
const heldSearches = new Map();
const api = createServer(async (request, response) => {
  if (request.url !== '/api/site-content') apiCalls++;
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  response.setHeader('Content-Type', 'application/json');
  if (path === '/uploads/seed/sala.svg') {
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end('<svg xmlns="http://www.w3.org/2000/svg" />');
  } else if (path === '/api/files/otro-tipo/content') {
    response.writeHead(200, { 'Content-Type': 'application/pdf' }).end('documento de prueba');
  } else if (path === '/api/properties' && heldSearches.has(url.searchParams.get('search'))) {
    const gate = heldSearches.get(url.searchParams.get('search'));
    gate.started.resolve(url.searchParams);
    await gate.release.promise;
    response.end(JSON.stringify([gate.property]));
    gate.sent.resolve();
  } else if (mode === 'unavailable' || (mode === 'partial' && path.startsWith('/api/news'))) {
    response.writeHead(503).end(JSON.stringify({ message: 'Service unavailable' }));
  } else if (mode === 'slow' && path === '/api/properties' && url.search === '?search=Centro&maxRent=1500000') {
    inventoryRequested.resolve();
    await catalogGate.promise;
    response.end(JSON.stringify([{
      id: 'demo-centro', slug: 'demo-centro', title: 'Casa de prueba en Centro',
      city: 'Bogotá', neighborhood: 'Centro', monthlyRent: 1200000, administrationFee: 0,
      images: [], bedrooms: 2, bathrooms: 1, areaM2: 50, parking: 0, status: 'AVAILABLE',
    }]));
  } else if (/^\/api\/(properties|news)\/missing$/.test(path)) {
    response.writeHead(404).end(JSON.stringify({ message: 'Not found' }));
  } else if (path === '/api/news/lectura') {
    response.end(JSON.stringify({ id: 'editorial', title: 'Noticia de prueba', slug: 'lectura', summary: 'Resumen', content: 'Primer párrafo.\n\nSegundo párrafo.', createdAt: '2026-11-21T12:00:00Z' }));
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
  env: { ...process.env, NODE_ENV: 'production', APP_ENV: localDesign ? 'local' : publishedDesign ? 'development' : 'test', API_INTERNAL_URL: `http://127.0.0.1:${api.address().port}`, NEXT_TELEMETRY_DISABLED: '1' },
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
  await page('/fotos/uploads/seed/sala.svg', 200, ['<svg']);
  await page('/fotos/api/files/otro-tipo/content', 415, [], ['documento de prueba']);
  const beforeUnknownPhoto = apiCalls;
  await page('/fotos/ruta-desconocida', 404, []);
  assert.equal(apiCalls, beforeUnknownPhoto);
  await page('/', 200, ['Tu inmueble.', 'los inmuebles destacados', 'No pudimos cargar', 'Volver a intentar'], ['Pronto publicaremos novedades']);
  await page('/inmuebles?vista=completa', 200, ['No pudimos cargar'], ['No hay inmuebles que coincidan']);
  await page('/api/catalogo', 503, ['null']);
  await page('/noticias', 200, ['No pudimos cargar'], ['Aún no hay noticias']);

  if (localDesign) {
    await page('/?estilo=orbita', 200, ['los inmuebles destacados', 'Volver a intentar'], ['Explorar fotos']);
  } else {
    await page('/?estilo=orbita', 200, ['data-portada="editorial-jb"', 'id="portafolio"', 'id="busqueda"', 'id="recorridos"', 'los inmuebles destacados'], ['Comparar portadas']);
  }

  const beforeInvalidQuery = apiCalls;
  await page('/inmuebles?maxRent=-1', 200, ['Revisa los filtros indicados', 'max-rent-error'], ['No hay inmuebles que coincidan']);
  await page('/api/catalogo?city=A&city=B', 400, ['repetido']);
  assert.equal(apiCalls, beforeInvalidQuery, 'Invalid filters or an anonymous header must not query inventory or authentication');

  mode = 'partial';
  await page('/', 200, ['Tu inmueble.', 'Consulta el catálogo', 'No pudimos cargar'], ['Pronto publicaremos novedades']);

  mode = 'healthy';
  if (localDesign) {
    await page('/?estilo=orbita', 200, ['Consulta el catálogo para conocer los inmuebles disponibles.', 'Comparar portadas'], ['Explorar fotos', 'los inmuebles destacados', 'No pudimos cargar']);
  }
  await page('/', 200, ['Consulta el catálogo', 'Pronto publicaremos novedades'], ['No pudimos cargar']);
  await page('/inmuebles?vista=completa', 200, ['No hay inmuebles que coincidan'], ['No pudimos cargar']);
  await page('/api/catalogo', 200, ['[]']);
  await page('/noticias', 200, ['Aún no hay noticias'], ['No pudimos cargar']);
  await page('/inmuebles/missing', 404, ['No encontramos lo que buscas', 'noindex']);
  await page('/noticias/missing', 404, ['No encontramos lo que buscas', 'noindex']);
  await page('/noticias/lectura', 200, ['id="parrafo-1">Primer párrafo.', 'id="parrafo-2">Segundo párrafo.', 'href="/noticias#noticia-editorial"']);

  mode = 'slow';
  const catalogPath = '/inmuebles?search=Centro&maxRent=1500000';
  const inventory = fetch(origin + '/api/catalogo?search=Centro&maxRent=1500000', { signal: AbortSignal.timeout(15000) });
  await Promise.race([inventoryRequested.promise, inventory.then(() => { throw new Error('Inventory was not held'); })]);
  await page(catalogPath, 200, ['<h1>Inmuebles en arriendo</h1>', 'value="1500000"', 'Buscando inmuebles…'], ['Casa de prueba en Centro']);
  catalogGate.resolve();
  const response = await inventory;
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0].slug, 'demo-centro');
  const crawler = await fetch(origin + catalogPath, { headers: { 'User-Agent': 'Googlebot' } });
  assert.ok((await crawler.text()).includes('href="/inmuebles/demo-centro"'));
  await page(catalogPath + '&vista=completa', 200, ['href="/inmuebles/demo-centro"'], ['Buscando inmuebles…']);
  console.log(`${checks} web regression checks passed.`);
  if (process.argv.includes('--edge')) {
    await verifyCatalogInEdge(origin, (search) => holdCatalogSearch(heldSearches, search));
  }
} catch (error) {
  console.error(output);
  throw error;
} finally {
  catalogGate.resolve();
  for (const gate of heldSearches.values()) gate.release.resolve();
  server.kill();
  await exited;
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
}
