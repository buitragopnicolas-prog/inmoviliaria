import { browserCoverage } from './e2e-browser-coverage.mjs';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const dev = process.argv.includes('--dev');
const localOrigin = process.argv.includes('--ci') ? 'http://localhost:13613' : 'http://localhost:3000';
const origin = dev ? 'https://dev.asesoriainmobiliariajb.com' : (process.env.LOCAL_PREVIEW_URL || localOrigin);
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
    ['busqueda', 'portafolio', 'recorridos']);
  assert.equal(await page.locator('h1').count(), 1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out + '/portada.png' });

  const portfolio=home.locator('#portafolio');
  await portfolio.getByText('Cargando', {exact:false}).waitFor({state:'hidden'});
  const cards=portfolio.locator('a.assetCard');
  const count=await cards.count();
  if(count){
    const canvas=await page.locator('.jbSkylineFrame canvas').elementHandle();
    await cards.first().focus();
    if(count>1){
      await page.keyboard.press('End');
      await page.waitForFunction(()=>document.activeElement===document.querySelector('#portafolio .assetSlide:last-child a'));
      await portfolio.getByRole('button',{name:'Anterior'}).click();
      await page.waitForFunction(n=>document.querySelector('#portafolio .railControls output').textContent.startsWith((n-1)+' de'),count);
    }
    const active=portfolio.locator('[data-side="center"] a');
    await active.hover();
    await portfolio.locator('[data-heated]').waitFor();
    const href=await active.getAttribute('href');
    await active.click();
    await page.waitForURL('**'+href);
    await page.locator('h1').waitFor();
    assert.ok(await canvas.evaluate(n=>n===document.querySelector('.jbSkylineFrame canvas')));
    await page.goBack();
    await portfolio.locator('[data-side="center"] a[href="'+href+'"]').waitFor();
  }
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
  if(await mobile.locator('#portafolio .assetSlide').count()>1){
    await mobile.locator('#portafolio .railControls button:enabled').first().tap();
    assert.equal(await mobile.locator('[data-heated]').count(),0);
  }
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
