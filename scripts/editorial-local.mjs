import { browserCoverage } from './e2e-browser-coverage.mjs';
// Validación de los recorridos editoriales con las identidades de prueba de Compose.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { setTimeout as wait } from 'node:timers/promises';

const web = 'http://localhost:13613';
const api = 'http://localhost:14613/api';
const schema = JSON.parse(await readFile(new URL('../shared/site-fields.json', import.meta.url),'utf8'));
const stamp = 'Prueba editorial '+Date.now();
const photo = new URL('../apps/web/public/images/jb-interior-1200.webp',import.meta.url);
async function request(path, token, options={}) {
  return fetch(api+path,{...options,headers:{'Content-Type':'application/json',...(token && {Authorization:'Bearer '+token}),...options.headers}});
}
async function json(path, token, options={}) {
  const response=await request(path,token,options);
  assert.ok(response.ok, path+' respondió '+response.status);
  return response.json();
}
async function login(role) {
  const email=process.env['E2E_'+role+'_EMAIL'];
  const password=process.env['E2E_'+role+'_PASSWORD'];
  assert.ok(email && password,'Falta la identidad de prueba '+role);
  return (await json('/auth/login',null,{method:'POST',body:JSON.stringify({email,password})})).accessToken;
}
const admin=await login('ADMIN'), customer=await login('CUSTOMER');
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chrome'});
const coverage = browserCoverage();
const context=await browser.newContext();
const visitor=await coverage.watch(await browser.newPage());
const page=await coverage.watch(await context.newPage());
const setSession = token=>context.addCookies([{name:'inmo_token',value:token,url:web,httpOnly:true}]);
const createdOffers=[];
let articleId;
const originalSections = new Map();
async function remember(id,key,value){
  const original=await section(id);
  originalSections.set(id,{original,key,value,changes:1});
  return original;
}
async function section(id){
  const row=(await json('/site-content')).find(row=>row.id===id);
  return {revision:row?.revision??0,values:{...Object.fromEntries(Object.entries(schema[id].fields).map(([k,v])=>[k,v.value])),...row?.values}};
}
async function saved(message){
  const notice=page.locator('.statusNotice').filter({visible:true}).first();
  await notice.waitFor();
  assert.equal(await notice.innerText(),message);
}
async function visit(target,path){
  const response=await target.goto(web+path);
  assert.equal(response.status(),200,path);
}
try {
  console.log('Microsoft Edge '+browser.version());
  await setSession(admin);
  for(const [token,expected] of [[null,401],[customer,403]]) {
    assert.equal((await request('/admin/sales',token)).status,expected);
    assert.equal((await request('/admin/publishing/sections/portada',token,{method:'PUT',body:'{}'})).status,expected);
  }
  await visit(visitor,'/');
  const home=visitor.getByRole('navigation',{name:'¿Qué quieres hacer?'});
  assert.deepEqual(await home.locator('a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),['/inmuebles','/comprar','/vehiculos-y-bienes','/propietarios','/arrendatarios','/clientes','/servicios']);
  await visit(visitor,'/servicios');
  for (const [index,service] of ['juridicos','contables','inmobiliarios'].entries()){
    const card=visitor.locator('.serviceCard').nth(index);
    const label=await card.locator('h2').innerText();
    const href=await card.locator('a').getAttribute('href');
    if(href==='/contacto?servicio='+service){
      await visit(visitor,href);
      assert.equal(await visitor.locator('[name=subject]').inputValue(),label);
      await visit(visitor,'/servicios');
    }
  }
  await visit(page,'/clientes');
  await page.getByRole('button',{name:'Cambiar de cuenta'}).click();
  await page.waitForURL('**/login');
  await setSession(customer);
  await visit(page,'/clientes');
  await page.getByRole('button',{name:'Cambiar de cuenta'}).waitFor();
  await visit(page,'/arrendatarios');
  await page.getByRole('link',{name:'Entrar a mi cuenta'}).click();
  await page.waitForURL('**/mi-cuenta');
  assert.equal(new URL(page.url()).pathname,'/mi-cuenta');
  await setSession(admin);
  console.log('OK destinos, servicios, contacto y acceso por rol');

  const original=await remember('portada','first',stamp);
  await visit(page,'/admin/contenido?seccion=portada');
  await page.locator('[name=first]').fill(stamp);
  await page.getByRole('button',{name:'Publicar cambios'}).click();
  await saved('Cambios publicados.');
  const published=await section('portada');
  assert.equal(published.values.first,stamp);
  await visit(visitor,'/');
  assert.ok((await visitor.locator('h1').innerText()).includes(stamp));
  assert.equal((await request('/admin/publishing/sections/portada',admin,{method:'PUT',body:JSON.stringify(original)})).status,409);
  console.log('OK portada publicada y conflicto de edición');

  await remember('contacto','policyLabel',stamp);
  await visit(page,'/admin/contenido?seccion=contacto');
  await page.locator('[name=policyLabel]').fill(stamp);
  await page.locator('[name=policyHref]').fill('');
  await page.locator('[name=policyText]').fill('Documento sintético destinado a pruebas locales.');
  await page.getByRole('button',{name:'Publicar cambios'}).click();
  await saved('Cambios publicados.');
  await visit(visitor,'/contacto');
  await visitor.locator('footer').getByRole('link',{name:stamp,exact:true}).click();
  assert.equal(new URL(visitor.url()).pathname,'/politica-de-datos');
  assert.equal(await visitor.locator('h1').innerText(),stamp);
  await remember('nosotros','caption',stamp);
  await visit(page,'/admin/contenido?seccion=nosotros');
  await page.locator('[name=caption]').fill(stamp);
  await page.locator('[name=photo-photo]').setInputFiles({name:'oficina.webp',mimeType:'image/webp',buffer:await readFile(photo)});
  await page.getByRole('button',{name:'Publicar cambios'}).click();
  await saved('Cambios publicados.');
  await visit(visitor,'/nosotros');
  const about=visitor.locator('figure');
  assert.equal(await about.locator('figcaption').innerText(),stamp);
  assert.match(await about.locator('img').getAttribute('src'),/^\/fotos\/api\/files\//);
  assert.ok(await about.locator('img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}));
  console.log('OK foto y pie de Nosotros, enlace y texto de política');

  await visit(page,'/admin/contenido?seccion=contacto');
  const policyUrl='https://example.test/politica-de-prueba';
  await page.locator('[name=policyHref]').fill(policyUrl);
  originalSections.get('contacto').changes=2;
  await page.getByRole('button',{name:'Publicar cambios'}).click();
  await saved('Cambios publicados.');
  await visit(visitor,'/contacto');
  assert.equal(await visitor.locator('footer').getByRole('link',{name:stamp}).getAttribute('href'),policyUrl);

  for (const [id,field,path,selector] of [
    ['identidad','name','/','.header .brand [role="img"]'],
    ['documentos','title','/','#documents-title'],
    ['accesos','visit','/','#nuestro-enfoque h3'],
    ['servicios','legal','/servicios','.serviceCard h2'],
  ]){
    await remember(id,field,stamp);
    await visit(page,'/admin/contenido?seccion='+id);
    await page.locator('[name='+field+']').fill(stamp);
    await page.getByRole('button',{name:'Publicar cambios'}).click();
    await saved('Cambios publicados.');
    await visit(visitor,path);
    const el=visitor.locator(selector).first();
    assert.equal(id==='identidad'?await el.getAttribute('aria-label'):await el.innerText(),stamp);
  }
  await visit(visitor,'/contacto?servicio=juridicos');
  assert.equal(await visitor.locator('[name=subject]').inputValue(),stamp);
  console.log('OK identidad, contratos, acceso de visita, servicios y URL de política');

  for(const [catalog,category] of [['comprar','Apartamento'],['vehiculos-y-bienes','Estufa']]){
    const title=stamp+' '+category;
    await visit(page,'/admin/ofertas?nueva=1');
    const form=page.locator('form').filter({has:page.locator('[name=catalog]')});
    await form.locator('[name=catalog]').selectOption(catalog);
    await form.locator('[name=title]').fill(title);
    await form.locator('[name=category]').fill(category);
    await form.locator('[name=price]').fill('2500000');
    await form.locator('[name=description]').fill('Descripción sintética para la prueba local de la galería.');
    if(catalog==='comprar')await form.locator('[name=city]').fill('Bogotá');
    const bytes=await readFile(photo);
    await form.locator('[name=photos]').setInputFiles(['vista','detalle'].map(name=>({name:name+'.webp',mimeType:'image/webp',buffer:bytes})));
    await form.getByRole('button',{name:'Guardar oferta'}).click();
    await saved('Borrador guardado.');
    const row=(await json('/admin/sales',admin)).find(row=>row.title===title);
    assert.ok(row);
    createdOffers.push(row.id);
    assert.equal((await request('/sales/'+catalog+'/'+row.id)).status,404);
    assert.equal((await fetch(web+'/'+catalog+'/'+row.id)).status,404);
    await visit(page,'/admin/ofertas?editar='+row.id);
    await page.locator('[name=published]').check();
    await page.getByRole('button',{name:'Guardar oferta'}).click();
    await saved('Oferta publicada.');
    await visit(visitor,'/'+catalog);
    assert.equal(await visitor.locator('form.filters [name=city]').count(),catalog==='comprar'?1:0);
    await visitor.locator('[name=q]').fill(stamp);
    await visitor.locator('[name=category]').fill(category);
    await visitor.getByRole('button',{name:'Buscar',exact:true}).click();
    const card=visitor.locator('.saleCard').filter({hasText:title});
    assert.match((await card.innerText()).replace(/\s/g,''),/2\.500\.000/);
    await card.click();
    await visitor.waitForURL(web+'/'+catalog+'/'+row.id);
    assert.equal(await visitor.locator('h1').innerText(),title);
    const cover=visitor.locator('.gallery summary');
    await cover.click();
    await visitor.getByRole('button',{name:'Foto siguiente'}).click();
    await visitor.getByText('Foto 2 de 2').waitFor();
    assert.ok(await visitor.locator('dialog img').evaluate(async img=>{await img.decode();return img.naturalWidth>0;}));
    await visitor.keyboard.press('Escape');
    await visitor.getByRole('dialog').waitFor({state:'hidden'});
    assert.ok(await cover.evaluate(el=>el===document.activeElement));
    assert.equal(await visitor.locator('[name=subject]').inputValue(),'Consulta: '+title);
    const other=catalog==='comprar'?'vehiculos-y-bienes':'comprar';
    assert.equal((await request('/sales/'+other+'/'+row.id)).status,404);
    assert.equal((await json('/properties?search='+encodeURIComponent(title))).length,0);
    console.log('OK '+catalog+' · borrador, filtro, publicación, dos fotos y foco');
  }

  await visit(page,'/admin/noticias?crear=1');
  await page.locator('[name=title]').fill(stamp);
  await page.locator('[name=summary]').fill('Resumen de una publicación sintética de la inmobiliaria.');
  const body='Primer párrafo del artículo de prueba.\n\nSegundo párrafo editorial.';
  await page.locator('input[accept*=".txt"]').setInputFiles({name:'articulo.txt',mimeType:'text/plain',buffer:Buffer.from(body)});
  await page.waitForFunction(text=>document.querySelector('[name=content]')?.value===text,body);
  await page.getByRole('button',{name:'Guardar artículo'}).click();
  await saved('Artículo publicado.');
  const post=(await json('/admin/news',admin)).find(row=>row.title===stamp);
  assert.ok(post);articleId=post.id;
  await visit(visitor,'/noticias');
  await visitor.locator('#noticia-'+post.id).click();
  assert.equal(await visitor.locator('#parrafo-2').innerText(),'Segundo párrafo editorial.');
  await visit(page,'/admin/noticias?editar='+post.id);
  await page.locator('[name=title]').fill(stamp+' revisado');
  await page.getByRole('button',{name:'Guardar artículo'}).click();
  await saved('Artículo publicado.');
  await visit(visitor,'/noticias/'+post.slug);
  assert.equal(await visitor.locator('h1').innerText(),stamp+' revisado');
  for(const mode of ['no-preference','reduce']){
    await visitor.emulateMedia({reducedMotion:mode});
    await visit(visitor,'/servicios');
    const animation=await visitor.locator('h1').evaluate(el=>getComputedStyle(el).animationName);
    assert.equal(animation==='none',mode==='reduce');
  }
  console.log('OK artículo escrito, importado y editado, Motion y movimiento reducido');
} finally {
  try {
    for(const [id,{original,key,value,changes}] of originalSections){
      const current=await section(id);
      if(current.values[key]===value && current.revision>original.revision && current.revision<=original.revision+changes) {
        await json('/admin/publishing/sections/'+id,admin,{method:'PUT',body:JSON.stringify({values:original.values,revision:current.revision})});
      }
    }
    for(const row of await json('/admin/sales',admin)){
      if(!createdOffers.includes(row.id) && !row.title.startsWith(stamp+' '))continue;
      if(row.published){
        const {catalog,title,category,price,city,description,images,revision}=row;
        await json('/admin/sales/'+row.id,admin,{method:'PUT',body:JSON.stringify({catalog,title,category,price,city,description,images,revision,published:false})});
      }
      assert.equal((await request('/sales/'+row.catalog+'/'+row.id)).status,404);
    }
    for(const post of await json('/admin/news',admin)){
      if(post.published && (post.id===articleId || post.title===stamp))await json('/admin/news/'+post.id,admin,{method:'DELETE'});
    }
    if(originalSections.size){
      // Las restauraciones por API también deben llegar al sitio público.
      const deadline=Date.now()+60000;
      while((await (await fetch(web+'/')).text()).includes(stamp)){
        assert.ok(Date.now()<deadline,'La portada pública aún muestra contenido de prueba');
        await wait(2000);
      }
      console.log('OK contenido original restablecido y ofertas de prueba retiradas');
    }
  } finally { try { await coverage.save(); } finally { await browser.close(); } }
}
