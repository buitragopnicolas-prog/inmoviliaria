import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

export function holdCatalogSearch(searches, search) {
  const gate = {
    started: Promise.withResolvers(), release: Promise.withResolvers(), sent: Promise.withResolvers(),
    property: {
      id: search, slug: search, title: 'Casa ' + search, city: 'Bogotá', neighborhood: 'Centro',
      monthlyRent: 1200000, administrationFee: 0, images: [], bedrooms: 2, bathrooms: 1,
      areaM2: 50, parking: 0, status: 'AVAILABLE',
    },
  };
  searches.set(search, gate);
  return gate;
}

function withinTimeout(promise, description) {
  return Promise.race([promise, delay(15000, null, { ref: false }).then(() => {
    throw new Error('Timed out waiting for ' + description);
  })]);
}

export async function verifyCatalogInEdge(origin, holdSearch) {
  const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome' });
  try {
    console.log('Chromium ' + browser.version());
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      // Observe the running Web Animations without changing the animation or HTTP APIs.
      await page.addInitScript(() => {
        window.catalogFades = [];
        const frame = () => {
          const status = document.querySelector('output.results, .results[role="status"]');
          if (status?.getAnimations().some(({ effect }) => effect.getKeyframes().some((key) => 'opacity' in key))) {
            if (!window.catalogFades.includes(status.textContent)) window.catalogFades.push(status.textContent);
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const first = holdSearch('inicial-' + reducedMotion);
      const latest = holdSearch('final-' + reducedMotion);
      try {
        // Navigate normally. Only the upstream API holds responses.
        const navigation = page.goto(origin + '/inmuebles?search=' + first.property.slug, { waitUntil: 'commit' });
        navigation.catch(() => {}); // A failed assertion may close a still-pending document.
        await withinTimeout(first.started.promise, 'the first inventory request');
        const form = page.getByRole('form', { name: 'Filtrar inmuebles en arriendo' });
        const status = page.getByRole('status').filter({ hasText: 'Buscando inmuebles…' });
        await status.waitFor();
        await navigation;
        const formMotion = await form.evaluate((element) => getComputedStyle(element).animationName);
        assert.equal(formMotion, reducedMotion === 'reduce' ? 'none' : 'jb-arrive');
        const search = form.getByLabel('Barrio o inmueble');
        const city = form.getByLabel('Ciudad');
        const rent = form.getByLabel('Canon máximo');
        await search.fill(latest.property.slug);
        await city.fill('Bogotá');
        await rent.fill('1600000');
        const submit = form.getByRole('button', { name: 'Buscar' });
        const keyboard = reducedMotion === 'no-preference';
        if (keyboard) await rent.press('Enter');
        else await submit.click();
        const params = await withinTimeout(latest.started.promise, 'the submitted inventory request');
        assert.deepEqual(Object.fromEntries(params), { search: latest.property.slug, city: 'Bogotá', maxRent: '1600000' });
        await status.waitFor();
        assert.equal(await (keyboard ? rent : submit).evaluate((element) => element === document.activeElement), true);
        await city.fill('Borrador sin enviar');
        assert.equal(await city.evaluate((element) => element === document.activeElement), true);
        latest.release.resolve();
        const card = page.getByRole('link', { name: 'Ver inmueble: ' + latest.property.title, exact: true });
        await card.waitFor();
        await page.getByRole('status').filter({ hasText: '1 inmueble encontrado' }).waitFor();
        assert.equal(await city.evaluate((element) => element === document.activeElement), true);
        assert.equal(await city.inputValue(), 'Borrador sin enviar');
        assert.equal(new URL(page.url()).searchParams.get('city'), 'Bogotá');
        const cardMotion = await card.evaluate((element) => getComputedStyle(element.closest('article')).animationName);
        assert.equal(cardMotion, reducedMotion === 'reduce' ? 'none' : 'jb-arrive');
        if (reducedMotion === 'reduce') {
          assert.deepEqual(await page.evaluate(() => window.catalogFades), []);
        } else {
          await page.waitForFunction(() => window.catalogFades.includes('1 inmueble encontrado'));
          assert.ok((await page.evaluate(() => window.catalogFades)).includes('Buscando inmuebles…'));
        }
        first.release.resolve();
        await withinTimeout(first.sent.promise, 'the obsolete response');
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await card.count(), 1);
        assert.equal(await page.getByRole('link', { name: 'Ver inmueble: ' + first.property.title, exact: true }).count(), 0);
        assert.equal(await city.evaluate((element) => element === document.activeElement), true);
        await rent.focus();
        await page.goBack();
        await page.getByRole('link', { name: 'Ver inmueble: ' + first.property.title, exact: true }).waitFor();
        assert.equal(await search.inputValue(), first.property.slug);
        assert.equal(await city.inputValue(), '');
        assert.equal(await rent.inputValue(), '');
        console.log('PASS Edge ' + reducedMotion + ': edit, submit, draft, focus, motion, stale response and back');
      } finally {
        first.release.resolve();
        latest.release.resolve();
        await context.close();
      }
    }
    const plain = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await plain.newPage();
      await page.goto(origin + '/inmuebles?search=Centro&maxRent=1500000');
      await page.getByRole('link', { name: 'Ver resultados de la búsqueda' }).click();
      await page.getByRole('link', { name: 'Ver inmueble: Casa de prueba en Centro' }).waitFor();
      await page.getByLabel('Ciudad', { exact: true }).fill('Cali');
      await page.getByRole('button', { name: 'Buscar' }).click();
      await page.getByText('No hay inmuebles que coincidan', { exact: false }).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('vista'), 'completa');
      assert.equal(new URL(page.url()).searchParams.get('city'), 'Cali');
      console.log('PASS Edge without JavaScript: direct link and native GET submission');
    } finally {
      await plain.close();
    }
  } finally {
    await browser.close();
  }
}
