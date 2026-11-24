import { browserCoverage } from './e2e-browser-coverage.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const dev = process.argv.includes('--dev');
const localOrigin = process.argv.includes('--ci') ? 'http://localhost:13613' : 'http://localhost:3000';
const origin = dev ? 'https://dev.asesoriainmobiliariajb.com' : localOrigin;
const out = '.local/portada-editorial/' + (dev ? 'dev' : 'local');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome' });
const coverage = browserCoverage();

try {
  const page = await coverage.watch(await browser.newPage({ viewport: { width: 1440, height: 960 } }));
  page.setDefaultTimeout(12000);
  const response = await page.goto(origin);
  assert.equal(response.status(), 200);
  const home = page.locator('[data-portada="editorial-jb"]');
  await home.waitFor();
  assert.deepEqual(await home.locator('section[id]').evaluateAll(nodes => nodes.map(n => n.id)),
    ['portafolio', 'busqueda', 'recorridos']);
  assert.equal(await page.locator('h1').count(), 1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out + '/portada.png' });

  const gallery = home.locator('#portafolio');
  const mode = gallery.getByRole('button', { name: 'Tambor' });
  await gallery.getByRole('status').filter({ hasText: 'Cargando galería' }).waitFor({ state: 'hidden' });
  if (await mode.count()) {
    await mode.click();
    await gallery.getByRole('button', { name: 'Ver foto 2', exact: true }).click();
    await gallery.getByText(/^Foto 2 de/).waitFor();
    const enlarge = gallery.getByRole('link', {name:'Ampliar foto'});
    await enlarge.click();
    const viewer = page.getByRole('dialog', {name:'Galería de arriendos'});
    await viewer.getByText(/^Foto 2 de/).waitFor();
    await viewer.locator('img').evaluate(img => img.decode());
    assert.ok(await viewer.locator('img').evaluate(img => img.naturalWidth > 0));
    await viewer.getByRole('button',{name:'Foto anterior'}).click();
    await viewer.getByText(/^Foto 1 de/).waitFor();
    await viewer.locator('img').evaluate(img => img.decode());
    await viewer.getByRole('button',{name:'Cerrar galería'}).click();
    assert.ok(await enlarge.evaluate(el => el === document.activeElement));
    const card = gallery.locator('a[href^="/inmuebles/"]').first();
    const detail = await card.getAttribute('href');
    assert.equal((await page.request.get(origin + detail)).status(), 200);
    await gallery.getByRole('button', { name: 'Anillo', exact: true }).click();
    assert.equal(await gallery.getByRole('button', { name: 'Anillo', exact: true }).getAttribute('aria-pressed'), 'true');
  } else {
    assert.ok(await gallery.locator('a[href^="/inmuebles"]').count() > 0);
    console.log('El inventario del entorno ofrece una foto o una salida al catálogo.');
  }

  const light = home.getByRole('button', { name: 'Orientar luz' });
  await light.focus();
  await page.keyboard.press('ArrowRight');
  await home.getByRole('button', {name:'Mapa de calor'}).click();
  const trace = home.locator('canvas[aria-label="Huella temporal sobre la fotografía"]');
  await trace.scrollIntoViewIfNeeded();
  const bounds = await trace.boundingBox();
  assert.ok(bounds?.width && bounds.height);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const hasInk = canvas => canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some(value => value > 0);
  assert.ok(await trace.evaluate(hasInk));
  await home.getByRole('button', {name:'Borrar huella'}).click();
  assert.equal(await trace.evaluate(hasInk), false);
  await home.getByRole('button', {name:'Mapa de calor'}).click();
  await home.locator('#home-search').fill('Centro');
  await home.locator('#home-city').fill('Bogotá');
  await home.locator('#home-max-rent').fill('1800000');
  const inventory = page.waitForResponse(result => new URL(result.url()).pathname === '/api/catalogo');
  await home.locator('form button[type=submit]').click();
  await page.waitForURL('**/inmuebles?**');
  const result = await inventory;
  assert.equal(result.status(), 200);
  assert.ok(Array.isArray(await result.json()));
  const filters = new URL(page.url()).searchParams;
  assert.equal(filters.get('search'), 'Centro');
  assert.equal(filters.get('city'), 'Bogotá');
  assert.equal(filters.get('maxRent'), '1800000');

  const mobile = await coverage.watch(await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' }));
  await mobile.goto(origin);
  await mobile.locator('[data-portada="editorial-jb"]').waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.getByRole('button', { name: 'Tambor' }).waitFor({ state: 'hidden' });
  await mobile.locator('a[href="#home-search"]').tap();
  assert.equal(await mobile.evaluate(() => document.activeElement.id), 'home-search');
  await mobile.locator('#recorridos summary').nth(1).tap();
  await mobile.locator('#recorridos details[open] a').first().waitFor();

  const plain = await browser.newPage({ javaScriptEnabled: false });
  await plain.goto(origin);
  const nav = plain.getByRole('navigation', { name: '¿Qué quieres hacer?' });
  const destinations = await nav.locator('a').evaluateAll(links => links.map(a => a.pathname));
  for (const path of new Set(destinations)) {
    const result = await plain.request.get(origin + path);
    assert.equal(result.status(), 200, path);
    assert.ok((await result.text()).includes('<h1'), path);
  }
  await nav.locator('summary').last().focus();
  await plain.keyboard.press('Enter');
  assert.ok(await nav.locator('details').last().getAttribute('open') !== null);
  console.log('Edge ' + browser.version() + ' · portada, inventario, filtros, ' + destinations.length + ' enlaces, teclado, móvil, movimiento reducido y HTML sin JavaScript correctos en ' + origin);
} finally {
  try { await coverage.save(); } finally { await browser.close(); }
}
