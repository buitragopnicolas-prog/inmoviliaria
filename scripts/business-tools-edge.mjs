// Run after the web build. A disposable API holds the test publication in memory.
import { browserCoverage } from './e2e-browser-coverage.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

const rows=new Map([['contacto',{id:'contacto',revision:1,values:{policyHref:'/politica-de-datos',policyText:'Política sintética de pruebas'}}]]), photos=new Map();
let consultations=0;
const coverage=browserCoverage();
const roles={editor:'ADMIN',tenant:'USER'};
function json(res,body,status=200){res.writeHead(status,{'content-type':'application/json'}).end(JSON.stringify(body));}
function consultation(res,role,path,body){
  if(!role)return json(res,{},401);
  const data=JSON.parse(body);
  if(path==='/api/consulta-ia' && !(data.authorized && data.question && data.policyVersion))return json(res,{},400);
  if(++consultations===1)return json(res,{message:'Fuente temporalmente no disponible'},503);
  return json(res,{answer:'Orientación sintética para la prueba.',sources:[{title:'Fuente oficial de prueba',url:'https://www.suin-juriscol.gov.co/'}]});
}
async function receivePhoto(req,res,body){
  const form=await new Response(body,{headers:{'content-type':req.headers['content-type']}}).formData();
  const photo=form.get('photos');
  const id='/api/files/prueba-'+(photos.size+1)+'/content';
  photos.set(id,Buffer.from(await photo.arrayBuffer()));
  return json(res,[id]);
}
function publishSection(res,path,body){
  const id=path.split('/').pop(),{revision,values}=JSON.parse(body);
  if((rows.get(id)?.revision??0)!==revision)return json(res,{message:'Conflicto de revisión'},409);
  rows.set(id,{id,revision:revision+1,values});
  return json(res,{revision:revision+1});
}
const api=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const role=roles[req.headers.authorization?.replace('Bearer ','')];
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks);
  if(path==='/api/auth/me')return json(res,{name:'Persona de prueba',role,portal:'TENANT'},role?200:401);
  if(path==='/api/consulta-ia/estado')return json(res,{available:true,topics:[{id:'arriendo',label:'Reajuste del canon'}]});
  if(path==='/api/consulta-ia' || path==='/api/consulta-ia/ejemplo'){
    return consultation(res,role,path,body);
  }
  if(path==='/api/site-content')return json(res,[...rows.values()]);
  if(path.startsWith('/api/admin/publishing/') && role!=='ADMIN')return json(res,{},403);
  if(path==='/api/admin/publishing/images' && req.method==='POST'){
    return receivePhoto(req,res,body);
  }
  if(path.startsWith('/api/admin/publishing/sections/') && req.method==='PUT'){
    return publishSection(res,path,body);
  }
  if(photos.has(path))return res.writeHead(200,{'content-type':'image/webp'}).end(photos.get(path));
  return json(res,[]);
});
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
const apiPort=await listen(api),slot=createServer(),webPort=await listen(slot);
await new Promise(resolve=>slot.close(resolve));
const origin='http://127.0.0.1:'+webPort;
const web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','-H','127.0.0.1','-p',String(webPort)],{stdio:'ignore',windowsHide:true,env:{...process.env,APP_ENV:'local',API_INTERNAL_URL:'http://127.0.0.1:'+apiPort}});
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/arrendatarios')).ok)break;}catch{}await delay(250);}
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chrome'});
  const page=await coverage.watch(await browser.newPage({reducedMotion:'reduce',viewport:{width:1280,height:820}}));
  page.setDefaultTimeout(20000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const photo=await readFile('apps/web/public/images/jb-alianzas.webp');
  await page.goto(origin+'/admin/contenido?seccion=portales');
  assert.equal(new URL(page.url()).pathname,'/login');
  const session=async value=>page.context().addCookies([{name:'inmo_token',value,url:origin}]);
  await session('editor');
  await page.goto(origin+'/admin/contenido?seccion=portales');
  const edit=page.locator('form.adminForm');
  await edit.locator('[name="photo-tenantPhoto"]').setInputFiles({name:'foto.webp',mimeType:'image/webp',buffer:photo});
  await page.waitForFunction(()=>document.querySelector('.adminForm img[src^="blob:"]')?.naturalWidth>0);
  const alt='Imagen de prueba editorial verificada';
  await edit.locator('[name="tenantAlt"]').fill(alt);
  await edit.getByRole('button',{name:'Publicar cambios'}).click();
  await page.getByText('Cambios publicados.').waitFor();
  assert.equal(rows.get('portales').revision,1);
  assert.deepEqual(photos.values().next().value,photo);
  await page.goto(origin+'/arrendatarios');
  await page.getByAltText(alt).evaluate(img=>img.decode());
  assert.match(await page.getByAltText(alt).getAttribute('src'),/fotos\/api\/files\/prueba/);
  await session('tenant');
  await page.goto(origin+'/mi-cuenta');
  await page.getByAltText(alt).evaluate(img=>img.decode());
  await page.goto(origin+'/admin/contenido?seccion=portales');
  assert.equal(new URL(page.url()).pathname,'/mi-cuenta');
  console.log('Publicación por formulario, previsualización, bytes cargados, foto pública y privada, roles.');
  await session('editor');
  await page.goto(origin+'/admin/contenido?seccion=presencia');
  await edit.locator('textarea[name=cities]').fill('Bogotá, Colombia\nManizales');
  await edit.getByRole('button',{name:'Publicar cambios'}).click();
  await page.getByText('Cambios publicados.').waitFor();
  assert.deepEqual(rows.get('presencia')?.values.cities.split(/\r?\n/),['Bogotá, Colombia','Manizales']);
  await page.goto(origin+'/arrendatarios');
  assert.equal(await page.locator('.placeNames span').last().innerText(),'Manizales');
  await page.locator('.quoteDetails summary').click();
  assert.equal(await page.locator('.quoteDetails li').count(),5);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.quoteDetails').getAttribute('open'),null);
  console.log('Ciudades publicadas y detalle de mercados abierto y cerrado.');
  await page.mouse.move(0,500);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.placeNames span:last-child')).opacity==='1');
  const pause=page.locator('.bandPause');
  await pause.click();
  const matrix=()=>page.locator('.quoteTrack').evaluate(e=>getComputedStyle(e).transform);
  const stopped=await matrix();
  await delay(3200);
  assert.equal(await matrix(),stopped);
  assert.equal(await page.locator('.placeNames span').last().evaluate(e=>getComputedStyle(e).opacity),'1');
  await pause.click();
  await page.mouse.move(0,500);
  await page.waitForFunction(before=>getComputedStyle(document.querySelector('.quoteTrack')).transform!==before,stopped);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.quoteTrack')).transform==='none');
  const clocks=page.locator('.worldClocks time');
  assert.equal(await clocks.count(),4);
  const before=await clocks.first().innerText();
  await page.waitForFunction(value=>document.querySelector('.worldClocks time').textContent!==value,before);
  for(const time of await clocks.all())assert.match(await time.innerText(),/^\d\d:\d\d:\d\d$/);
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:850});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Desbordamiento a '+width);
    await page.locator('.quoteDetails summary').click();
    assert.ok(await page.locator('.quotePanel').evaluate(e=>e.getBoundingClientRect().right<=innerWidth+1));
    await page.keyboard.press('Escape');
  }
  await page.goto(origin);
  await page.locator('.allianceCard img').scrollIntoViewIfNeeded();
  await page.locator('.allianceCard img').evaluate(img=>img.decode());
  await page.locator('.allianceCard a').click();
  assert.equal(await page.locator('[name=subject]').inputValue(),'Proponer una alianza');
  await page.goto(origin+'/consulta-juridica');
  await page.getByRole('button',{name:'Consultar ejemplo'}).click();
  await page.getByRole('alert').filter({hasText:'Fuente temporalmente no disponible'}).waitFor();
  await page.getByRole('button',{name:'Consultar ejemplo'}).click();
  await page.getByRole('link',{name:/Fuente oficial de prueba/}).waitFor();
  await page.locator('textarea[name=question]').fill('Pregunta sintética sobre arriendo de vivienda');
  await page.locator('input[name=authorized]').check();
  await page.getByRole('button',{name:'Consultar fuentes oficiales'}).click();
  await page.waitForFunction(()=>!document.querySelector('button[aria-busy="true"]'));
  assert.equal(consultations,3);
  await session('editor');
  await page.goto(origin+'/admin/contenido?seccion=pinlau');
  await edit.getByRole('button',{name:'Añadir perfil'}).click();
  await edit.getByLabel('Nombre completo').fill('Perfil de prueba');
  await edit.getByLabel('Cargo o vínculo').fill('Socio fundador');
  await edit.locator('[name^="photo-portrait-"]').setInputFiles({name:'retrato.webp',mimeType:'image/webp',buffer:photo});
  await edit.getByRole('button',{name:'Publicar cambios'}).click();
  await page.getByText('Cambios publicados.').waitFor();
  await page.goto(origin+'/pinlau');
  assert.equal(await page.locator('details summary').filter({hasText:'Procesos reivindicatorios'}).count(),1);
  const portrait = page.locator('#equipo li img');
  await portrait.scrollIntoViewIfNeeded();
  await portrait.evaluate(img=>img.decode());
  assert.equal(await page.locator('#equipo li h3').innerText(),'Perfil de prueba');
  const service=page.locator('details').filter({has:page.locator('summary',{hasText:'Restitución de inmuebles arrendados'})});
  await service.locator('summary').focus();
  await page.keyboard.press('Enter');
  await service.getByRole('link').click();
  assert.equal(await page.getByLabel('Asunto').inputValue(),'Pinlau · Restitución de inmuebles arrendados');
  await page.goto(origin+'/admin/contenido?seccion=pinlau');
  await edit.getByRole('button',{name:'Quitar perfil 1'}).click();
  await edit.getByRole('button',{name:'Publicar cambios'}).click();
  await page.getByText('Cambios publicados.').waitFor();
  await page.goto(origin+'/pinlau');
  assert.equal(await page.locator('#equipo li').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Ciudades editables, reloj por segundo, pausa, movimiento reducido, 320/390/1440 px y contacto de alianzas.');
 } finally {
  try {await coverage.save();} finally {await browser?.close();web.kill();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
}
