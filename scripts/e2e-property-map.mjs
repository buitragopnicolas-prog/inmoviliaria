import assert from 'node:assert/strict';

export async function verifyPropertyMaps({ page, visit, session, admin, request, json, lease, sale }) {
  await session(null);
  const rentalPath = '/inmuebles/' + lease.slug;
  const salePath = '/comprar/' + sale.id;
  const region = page.getByRole('region', { name: 'Ubicación del inmueble' });
  await visit(rentalPath);
  await region.getByText('El anunciante aún no ha marcado el pin.').waitFor();
  assert.ok((await region.getByRole('link').getAttribute('href')).includes('Colombia'));
  await region.getByRole('button', { name:'Ver mapa de Colombia' }).click();
  await region.locator('.leaflet-container').waitFor();
  assert.equal(await region.locator('.leaflet-marker-icon').count(), 0);
  await region.getByRole('button', { name:'Cerrar mapa' }).click();
  await region.locator('.leaflet-container').waitFor({state:'detached'});
  await visit(salePath);
  assert.ok(await region.count(), 'La ficha debe contener el mapa: '+(await page.locator('main').innerText()).slice(0,260));
  const google = new URL(await region.getByRole('link', { name:'Abrir en Google Maps' }).getAttribute('href'));
  assert.equal(google.searchParams.get('query'), '12.58472, -81.70056');
  await region.getByRole('button', { name:'Cerrar mapa' }).waitFor();
  await region.locator('.leaflet-marker-icon').waitFor();
  if (process.env.JB_ASSERT_MAP_TILES === '1') {
    await region.locator('img.leaflet-tile-loaded').first().waitFor({timeout:15000});
    console.log('La cartografía de OpenStreetMap cargó en Edge.');
  }
  await region.getByRole('button', { name:'Cerrar mapa' }).click();

  await session(admin);
  const endpoint = '/admin/properties/' + lease.id;
  for (const invalid of [{latitude:'4'}, {latitude:'91',longitude:'-74'}, {latitude:'',longitude:'-74'}, {latitude:'abc',longitude:'-74'}]) {
    assert.equal((await request(endpoint,admin,'PATCH',invalid)).status,400);
  }
  await visit(endpoint.replace('/admin/properties/', '/admin/inmuebles/') + '/editar');
  await page.getByRole('button',{name:'Elegir en el mapa'}).click();
  const canvas = page.locator('.leaflet-container');
  await canvas.click({position:{x:80,y:120}});
  const lat = page.getByLabel('Latitud', {exact:true});
  const lng = page.getByLabel('Longitud', {exact:true});
  assert.notEqual(await lat.inputValue(),'');
  const pin = canvas.locator('.leaflet-marker-icon');
  const bounds = await pin.boundingBox();
  assert.ok(bounds);
  const x = bounds.x + bounds.width / 2, y = bounds.y + 7;
  const beforeDrag = await lng.inputValue();
  await page.mouse.move(x,y); await page.mouse.down();
  await page.mouse.move(x+42,y+16,{steps:8}); await page.mouse.up();
  assert.notEqual(await lng.inputValue(),beforeDrag);
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'Marcar el centro del mapa'}).press('Enter');
  await lat.fill('4.60971');
  await lng.fill('-74.08175');
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await page.waitForURL(url=>url.pathname==='/admin/inmuebles');
  assert.equal((await json('/properties/'+lease.slug)).longitude,-74.08175);
  await page.emulateMedia({reducedMotion:'reduce'});
  await session(null); await visit(rentalPath);
  await region.getByRole('button',{name:'Cerrar mapa'}).waitFor();
  await region.locator('.leaflet-marker-icon').waitFor();

  assert.equal(await region.locator('.leaflet-container').evaluate(el => getComputedStyle(el.parentElement).animationName),'none');
  await page.emulateMedia({reducedMotion:null});
  await session(admin); await visit('/admin/ofertas?editar='+sale.id);
  assert.equal(await lat.inputValue(),'12.58472');
  await page.getByRole('button',{name:'Quitar pin'}).click();
  await page.getByRole('button',{name:'Guardar oferta'}).click();
  await page.getByText('Oferta publicada.',{exact:true}).waitFor();
  await session(null); await visit(salePath);
  await region.getByText('El anunciante aún no ha marcado el pin.').waitFor();
  assert.equal((await json('/sales/comprar/'+sale.id)).longitude,null);
  console.log('Pin de arriendo y venta: selección, arrastre, teclado, guardado, lectura pública y retiro verificados.');
}
