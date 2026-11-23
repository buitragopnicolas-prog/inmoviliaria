import { browserCoverage } from './e2e-browser-coverage.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { fixturePolicy } from './portal-privacy-test-data.mjs';
import { syntheticPdf } from './synthetic-pdf.mjs';
const web='http://localhost:13613', api='http://localhost:14613/api';
const stamp='Ensayo '+randomUUID().slice(0,7);
async function request(path,token,method='GET',data) {
  const form=data instanceof FormData;
  return fetch(api+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(form?{}:{'Content-Type':'application/json'})},body:form?data:JSON.stringify(data)});
}
async function json(path,token,method,data){
  const r=await request(path,token,method,data);
  assert.ok(r.ok,path+' '+r.status+' '+(!r.ok?(await r.text()).slice(0,240):'')); return r.json();
}
const login=async(role)=>json('/auth/login',null,'POST',{email:process.env['E2E_'+role+'_EMAIL'],password:process.env['E2E_'+role+'_PASSWORD']});
const admin=(await login('ADMIN')).accessToken;
const tenant=await login('CUSTOMER');assert.equal(tenant.user.portal,'TENANT');
const consent=await fixturePolicy(admin);
const lead={name:'Persona sintética',email:'sintetica@example.test',subject:stamp,message:'Prueba del servicio editorial.'};
assert.equal((await request('/contacts',null,'POST',lead)).status,400);
assert.equal((await request('/contacts',null,'POST',{...lead,...consent,policyVersion:'0'.repeat(64)})).status,409);
const register=portal=>json('/auth/register',null,'POST',{name:stamp,email:randomUUID()+'@example.test',password:randomUUID()+'A9!',portal,...consent});
const owner=await register('OWNER'), second=await register('OWNER'), client=await register('SERVICES');
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chrome'});
const coverage = browserCoverage();
const ctx=await browser.newContext();
async function session(token){await ctx.clearCookies();if(token)await ctx.addCookies([{name:'inmo_token',value:token,url:web,httpOnly:true}]);}
const page=await coverage.watch(await ctx.newPage());
async function visit(path){assert.equal((await page.goto(web+path)).status(),200,path);}
try {
  await session(admin); await visit('/admin/contenido?seccion=servicios');
  await page.locator('[name=service8]').fill('Servicio ocho '+stamp);
  await page.locator('[name=service8Text]').fill('Descripción amplia de una asesoría de prueba para la conciliación de cuentas.');
  await page.locator('main form button[type=submit], main form button.button').last().click();
  await page.locator('.statusNotice').filter({hasText:'publicad'}).first().waitFor({timeout:12000});
  await session(null);await visit('/servicios');
  await page.locator('article').filter({hasText:'Servicio ocho '+stamp}).getByRole('link').click();
  await page.locator('[name=name]').fill(lead.name);await page.locator('[name=email]').fill(lead.email);await page.locator('[name=message]').fill(lead.message);
  assert.equal(await page.locator('[name=authorized]').isChecked(),false);
  await page.locator('[name=authorized]').check();
  await page.getByRole('button',{name:'Enviar solicitud'}).click();
  await page.getByText('Recibimos tu solicitud.',{exact:false}).waitFor();
  assert.ok((await json('/admin/contacts',admin)).some(row=>row.subject==='Servicio ocho '+stamp));
  const bytes=await readFile(new URL('../apps/web/public/images/jb-interior-1200.webp',import.meta.url));
  const form=(operation,created=true,published=true,revision)=>{const f=new FormData();for(const [k,v] of Object.entries({operation,title:stamp+' '+operation,category:'Casa',city:'Bogotá',address:'Dirección sintética',neighborhood:'Sector de prueba',description:'Inmueble sintético de verificación.',features:'Balcón, ascensor',bedrooms:'3',price:'1000000',published,authorized:true,policyVersion:consent.policyVersion,...(revision&&{revision})}))f.set(k,String(v));if(created)f.set('photos',new Blob([bytes],{type:'image/webp'}),'foto.webp');return f;};
  assert.equal((await request('/owner/listings',client.accessToken)).status,403);
  const rental=await json('/owner/listings',owner.accessToken,'POST',form('rent'));
  const sale=await json('/owner/listings',owner.accessToken,'POST',form('sale'));
  const own=await json('/owner/listings',owner.accessToken);
  const lease=own.find(r=>r.id===rental.id);assert.ok(lease.images.length);
  assert.equal((await json('/properties/'+lease.slug)).bedrooms,3);
  assert.deepEqual(await json('/owner/listings',second.accessToken),[]);
  assert.equal((await request('/owner/listings/'+sale.id,second.accessToken,'PUT',form('sale',false,false,1))).status,404);
  await json('/admin/sales',admin,'POST',{catalog:'vehiculos-y-bienes',title:stamp+' vehículo',category:'Carro',city:'',description:'Vehículo de ensayo',price:'2000000',published:true,images:lease.images});
  await visit('/comprar?q='+encodeURIComponent(stamp));await page.locator('a.saleCard').first().waitFor();assert.equal(await page.locator('a.saleCard').count(),2);
  assert.ok((await page.locator('a.saleCard').evaluateAll(rows=>rows.map(a=>a.pathname))).some(p=>p.startsWith('/vehiculos-y-bienes/')));
  await session(owner.accessToken);await visit('/propietarios/publicaciones?editar='+sale.id);
  await page.locator('[name=published]').selectOption('false');await page.locator('[name=authorized]').check();await page.getByRole('button',{name:'Guardar publicación'}).click();await page.waitForURL('**/publicaciones?guardado=1');
  assert.equal((await request('/sales/comprar/'+sale.id)).status,404);
  const salePhoto=own.find(r=>r.id===sale.id).images[0];
  assert.equal((await fetch('http://localhost:14613'+salePhoto)).status,404);
  const photoId=salePhoto.split('/')[3];
  assert.equal((await request('/owner/listings/photos/'+photoId,owner.accessToken)).status,200);
  assert.equal((await request('/owner/listings/photos/'+photoId,second.accessToken)).status,404);
  assert.equal((await request('/owner/listings/'+sale.id,owner.accessToken,'PUT',form('sale',false,true,1))).status,409);
  const pdf=new FormData();pdf.set('serviceType','Tributario');pdf.set('file',new Blob([syntheticPdf('Contrato sintetico')],{type:'application/pdf'}),'contrato.pdf');
  const doc=await json('/admin/documents/accounts/'+client.user.sub,admin,'POST',pdf);assert.equal(doc.serviceType,'Tributario');
  assert.equal((await request('/documents/private/'+doc.id,owner.accessToken)).status,404);
  const catalog=await json('/admin/invoices/catalog',admin);
  for(const u of [client,owner]) {
    const invoice=await json('/admin/invoices',admin,'POST',{accountId:u.user.sub,period:'2026-11-01',dueDate:'2027-01-01',services:[{itemId:catalog.services[0].id,quantity:1}]});
    assert.equal((await json('/invoices/me/'+invoice.id,u.accessToken)).balance,invoice.amount);
    assert.equal((await request('/invoices/me/'+invoice.id,second.accessToken)).status,404);
    await session(u.accessToken);await visit('/mi-cuenta');await page.getByText(invoice.code,{exact:true}).waitFor();
    if(u===client) await page.getByText('Contrato de prestación de servicios · Tributario').waitFor();
    await visit('/mi-cuenta/facturas/'+invoice.id+'/pagar');
    const config=await json('/payments/manual/config',u.accessToken);
    const method=config.methods.find(m=>m.enabled);assert.ok(method);
    const f=new FormData();for(const [k,v] of Object.entries({method:method.code,amount:invoice.amount,paidAt:new Date().toISOString(),bankReference:randomUUID(),idempotencyKey:randomUUID(),...consent}))f.set(k,String(v));
    const payment=await json('/payments/invoices/'+invoice.id+'/manual-report',u.accessToken,'POST',f);
    assert.equal(payment.status,'AWAITING_VERIFICATION');
    await json('/payments/manual/'+payment.id+'/review',admin,'PATCH',{decision:'CONFIRM',note:'Confirmación sintética del ensayo.'});
    assert.equal((await json('/invoices/me/'+invoice.id,u.accessToken)).balance,0);
  }
  for(const reducedMotion of ['no-preference','reduce']) {
    await page.emulateMedia({reducedMotion});await page.setViewportSize({width:390,height:844});await visit('/propietarios');
    const style=await page.locator('[data-reveal-state]').first().evaluate(el=>({duration:getComputedStyle(el).transitionDuration,width:document.documentElement.scrollWidth}));
    assert.equal(style.width,390);if(reducedMotion==='reduce')assert.equal(style.duration,'0s');
  }
  await session(null);await visit('/registro?perfil=propietarios');
  assert.equal(await page.locator('[name=portal]').inputValue(),'OWNER');
  await page.locator('[name=name]').fill('Propietario de prueba');await page.locator('[name=email]').fill(randomUUID()+'@example.test');
  await page.locator('[name=password]').fill(randomUUID()+'Aa3!');await page.locator('[name=authorized]').check();
  await page.getByRole('button',{name:'Crear cuenta'}).click();await page.waitForURL('**/mi-cuenta');
  await page.getByRole('link',{name:'Mis publicaciones'}).click();await page.getByRole('link',{name:'Inscribir un inmueble'}).click();
  for(const [field,value] of Object.entries({title:'Borrador '+stamp,category:'Local',price:'900000',city:'Bogotá',neighborhood:'Sector sintético',address:'Dirección de prueba',bedrooms:'0',description:'Inscripción sintética desde el navegador.'})) await page.locator('main form [name='+field+']').fill(value);
  await page.locator('[name=photos]').setInputFiles({name:'foto.webp',mimeType:'image/webp',buffer:bytes});await page.locator('[name=authorized]').check();
  await page.getByRole('button',{name:'Guardar publicación'}).click();await page.waitForURL('**/publicaciones?guardado=1');await page.getByRole('heading',{name:'Borrador '+stamp}).waitFor();
  await session(tenant.accessToken);await visit('/mi-cuenta');await page.getByRole('heading',{name:'Mis contratos firmados'}).waitFor();
  console.log('Edge '+browser.version()+' · perfiles, consentimiento, octavo servicio, venta y arriendo, documentos privados, facturas y conciliación, vista móvil y movimiento reducido verificados.');
}finally{try { await coverage.save(); } finally { await browser.close(); }}
