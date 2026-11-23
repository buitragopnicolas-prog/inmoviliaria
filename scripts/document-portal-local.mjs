import { browserCoverage } from './e2e-browser-coverage.mjs';
import { fixturePolicy } from './portal-privacy-test-data.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { syntheticPdf } from './synthetic-pdf.mjs';

// These loopback ports belong to the disposable verification stack.
const web='http://localhost:13613';
const api='http://localhost:14613/api';
const label='Ensayo '+randomUUID().slice(0,8);
const pdf=(name)=>({name:name+'.pdf',mimeType:'application/pdf',buffer:syntheticPdf(name.normalize('NFD').replace(/\p{M}/gu,''))});
const accountEmail=process.env.E2E_CUSTOMER_EMAIL;
const adminEmail=process.env.E2E_ADMIN_EMAIL;
assert.ok(accountEmail && adminEmail, 'Selecciona el entorno de pruebas local');

async function call(path, token, options={}) {
  const response=await fetch(api+path,{...options,headers:{...(token&&{Authorization:'Bearer '+token}),...(options.body instanceof FormData?{}:{'Content-Type':'application/json'})}});
  return response;
}
async function json(path,token,options){
  const response=await call(path,token,options);
  assert.ok(response.ok,path+' respondió '+response.status);
  return response.json();
}
const admin=await json('/auth/login',null,{method:'POST',body:JSON.stringify({email:adminEmail,password:process.env.E2E_ADMIN_PASSWORD})});
const consent=await fixturePolicy(admin.accessToken);
const second=await json('/auth/register',null,{method:'POST',body:JSON.stringify({
  ...consent,name:'Segundo cliente sintético',email:randomUUID()+'@example.test',password:randomUUID()+'a7B!'
})});
const token=admin.accessToken;
const accounts=await json('/admin/documents/accounts',token);
const customer=accounts.find(row=>row.email===accountEmail);
assert.ok(customer);
const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chrome'});
const coverage = browserCoverage();
const office=await browser.newContext();
const client=await browser.newContext();
const guest=await browser.newContext();
const adminPage=await coverage.watch(await office.newPage());
const clientPage=await coverage.watch(await client.newPage());
const visitor=await coverage.watch(await guest.newPage());

async function visit(page,path){
  const response=await page.goto(web+path);
  assert.equal(response.status(),200,path);
}
async function saved(page,message){
  const notice=page.locator('.statusNotice').filter({visible:true}).first();
  await notice.waitFor();
  assert.equal(await notice.innerText(),message);
}
async function checkFile(context,url,file,disposition='inline'){
  const response=await context.request.get(web+url);
  assert.equal(response.status(),200);
  assert.equal(response.headers()['content-type'],'application/pdf');
  assert.ok(response.headers()['content-disposition'].startsWith(disposition));
  assert.deepEqual(await response.body(),file.buffer);
  assert.match(response.headers()['cache-control'],/no-store/);
}
try {
  console.log('Microsoft Edge '+browser.version());
  await office.addCookies([{name:'inmo_token',value:token,url:web,httpOnly:true}]);
  await visit(adminPage,'/admin/documentos?cliente='+customer.id);
  const privateFile=pdf('notificación-privada-'+label.slice(7));
  await adminPage.locator('input[type=file]').setInputFiles(privateFile);
  await adminPage.getByRole('button',{name:'Asignar PDF'}).click();
  await saved(adminPage,'PDF disponible en la cuenta del cliente.');
  const assigned=(await json('/admin/documents/accounts/'+customer.id,token)).find(row=>row.originalName===privateFile.name);
  assert.ok(assigned);
  await visit(clientPage,'/login');
  await clientPage.locator('[name=email]').fill(accountEmail);
  await clientPage.locator('[name=password]').fill(process.env.E2E_CUSTOMER_PASSWORD);
  await clientPage.locator('form.authForm button[type=submit]').click();
  await clientPage.waitForURL(web+'/mi-cuenta');
  await clientPage.getByRole('link',{name:'Mis documentos PDF'}).click();
  const link=clientPage.getByRole('link',{name:'Ver PDF '+privateFile.name});
  const privatePath=await link.getAttribute('href');
  const popup=clientPage.waitForEvent('popup');
  await link.click();
  const pdfViewer=await popup;
  await pdfViewer.waitForLoadState('load');
  await pdfViewer.locator('embed[type="application/pdf"]').waitFor({state:'attached'});
  await pdfViewer.close();
  await checkFile(client,privatePath,privateFile);
  await checkFile(client,privatePath+'?download=1',privateFile,'attachment');
  assert.equal((await guest.request.get(web+privatePath)).status(),401);
  assert.equal((await call('/documents/private/'+assigned.id,second.accessToken)).status,404);
  assert.equal((await json('/documents/mine',second.accessToken)).length,0);
  for(const path of ['/files/'+assigned.id,'/files/'+assigned.id+'/content','/documents/public/'+assigned.id])assert.equal((await call(path)).status,404);
  const badFile=new FormData();
  badFile.set('file',new Blob(['texto sin formato'],{type:'application/pdf'}),'texto.pdf');
  assert.equal((await call('/admin/documents/accounts/'+customer.id,token,{method:'POST',body:badFile})).status,400);
  const newAccount=accounts.find(row=>row.email===second.user.email);
  assert.ok(newAccount);
  const welcome=new FormData();
  welcome.set('file',new Blob([syntheticPdf('BIENVENIDA')],{type:'application/pdf'}),'bienvenida.pdf');
  const newPdf=await json('/admin/documents/accounts/'+newAccount.id,token,{method:'POST',body:welcome});
  assert.deepEqual((await json('/documents/mine',second.accessToken)).map(row=>row.id),[newPdf.id]);
  assert.equal((await client.request.get(web+'/documentos/privados/'+newPdf.id)).status(),404);
  console.log('OK asignación sin contrato, login con contraseña, PDF en línea y descarga, aislamiento entre cuentas y validación del archivo');

  await visit(visitor,'/inmuebles');
  await visitor.getByRole('link',{name:'Solicitud de arrendamiento'}).click();
  await visitor.waitForURL(web+'/solicitud-de-arrendamiento');
  for(const [key,title] of [['solicitud','Solicitud de arrendamiento'],['contrato','Contrato modelo']]){
    await visit(adminPage,'/admin/formatos');
    const panel=adminPage.locator('section').filter({has:adminPage.getByRole('heading',{level:2,name:title,exact:true})});
    const upload=pdf(key);
    await panel.locator('input[type=file]').setInputFiles(upload);
    await panel.getByRole('button',{name:'Publicar formato'}).click();
    await saved(adminPage,'Formato publicado.');
    await visit(visitor,'/solicitud-de-arrendamiento');
    const href=await visitor.getByRole('link',{name:'Ver PDF '+upload.name}).getAttribute('href');
    await checkFile(guest,href,upload);
    if(key==='solicitud'){
      await visit(adminPage,'/admin/formatos');
      await panel.locator('input[type=file]').setInputFiles(pdf('solicitud-actualizada'));
      await panel.getByRole('button',{name:'Publicar formato'}).click();
      await saved(adminPage,'Formato publicado.');
      assert.equal((await guest.request.get(web+href)).status(),404);
    }
  }
  console.log('OK solicitud y contrato modelo públicos, reemplazo del formato y retirada de la versión anterior');

  const summary='La inmobiliaria comparte una explicación de prueba para la lectura de su boletín. '.repeat(11).trim();
  assert.ok(summary.length>500);
  await visit(adminPage,'/admin/noticias?crear=1');
  await adminPage.locator('[name=title]').fill(label);
  await adminPage.locator('[name=category]').selectOption('Concepto jurídico');
  await adminPage.locator('[name=summary]').fill(summary);
  await adminPage.locator('[name=externalUrl]').fill('https://example.test/fuente');
  await adminPage.locator('[name=additionalLinks]').fill('https://example.test/uno\nhttps://example.test/dos');
  const bulletinPdf=pdf('concepto-jurídico');
  await adminPage.locator('[name=pdfs]').setInputFiles([bulletinPdf,pdf('anexo')]);
  await adminPage.locator('[name=visibility]').selectOption('draft');
  await adminPage.getByRole('button',{name:'Guardar artículo'}).click();
  await saved(adminPage,'Borrador guardado.');
  const post=(await json('/admin/news',token)).find(row=>row.title===label);
  assert.ok(post);assert.equal(post.attachments.length,2);
  const attachment=post.attachments.find(row=>row.originalName===bulletinPdf.name);
  const publicPath='/documentos/publicos/'+attachment.id;
  assert.equal((await guest.request.get(web+publicPath)).status(),404);
  assert.equal((await call('/files/'+attachment.id+'/content')).status,404);
  await visit(adminPage,'/admin/noticias?editar='+post.id);
  await adminPage.locator('[name=visibility]').selectOption('public');
  await adminPage.getByRole('button',{name:'Guardar artículo'}).click();
  await saved(adminPage,'Artículo publicado.');
  await visit(visitor,'/');
  await visitor.getByRole('navigation',{name:'Navegación principal',exact:true}).getByRole('link',{name:'Boletín jurídico y noticias'}).click();
  await visitor.locator('#noticia-'+post.id).click();
  await visitor.waitForURL(web+'/noticias/'+post.slug);
  assert.equal(await visitor.locator('.newsSummary').innerText(),summary);
  assert.equal(await visitor.locator('.newsArticle .eyebrow').textContent(),'Concepto jurídico');
  for(const path of ['fuente','uno','dos'])assert.equal(await visitor.locator('a[href="https://example.test/'+path+'"]').count(),1);
  await checkFile(guest,publicPath,bulletinPdf);
  await visit(adminPage,'/admin/noticias');
  await adminPage.getByRole('row').filter({hasText:label}).getByRole('button',{name:'Ocultar'}).click();
  await adminPage.getByRole('row').filter({hasText:label}).getByText('Oculta',{exact:true}).waitFor();
  assert.equal((await guest.request.get(web+publicPath)).status(),404);
  console.log('OK boletín, resumen de '+summary.length+' caracteres, tres fuentes, dos PDF, borrador y archivo');

  await visit(visitor,'/contacto');
  assert.equal(await visitor.getByRole('link',{name:'Abrir chat de WhatsApp con la inmobiliaria'}).getAttribute('href'),'https://wa.me/573135394406');
  await visitor.locator('main a[href="/sugerencias"]').click();
  const opinion='Sugerencia sintética del buzón '+label;
  await visitor.locator('[name=message]').fill(opinion);
  await visitor.getByRole('checkbox').check();
  await visitor.getByRole('button',{name:'Enviar sugerencia'}).click();
  await saved(visitor,'Tu sugerencia llegó al buzón de la inmobiliaria.');
  await visit(adminPage,'/admin/sugerencias');
  await adminPage.getByText(opinion,{exact:true}).waitFor();
  assert.equal((await call('/admin/suggestions')).status,401);
  assert.equal((await call('/admin/suggestions',second.accessToken)).status,403);
  await visitor.setViewportSize({width:390,height:844});
  for(const reducedMotion of ['no-preference','reduce']){
    await visitor.emulateMedia({reducedMotion});
    await visit(visitor,'/sugerencias');
    assert.equal(await visitor.evaluate(()=>document.documentElement.scrollWidth),390);
    const animation=await visitor.locator('h1').evaluate(el=>getComputedStyle(el).animationName);
    assert.equal(animation==='none', reducedMotion==='reduce');
  }
  console.log('OK WhatsApp, opinión anónima, buzón privado, vista móvil y movimiento reducido');
} finally {
  try { await coverage.save(); } finally { await browser.close(); }
}
