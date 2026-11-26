// Run after the web build. Both the web server and the read-only fixture use loopback.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const property = { id:'panorama', slug:'panorama', title:'Apartamento de prueba visual', status:'AVAILABLE',
  address:'Centro', city:'Bogotá', neighborhood:'Centro', features:[], images:[], description:'Ficha local de prueba',
  monthlyRent:1000000, administrationFee:0, bedrooms:2, bathrooms:1, parking:0, areaM2:50 };
const premium={id:'torre',catalog:'comprar',title:'Torre de prueba',category:'Apartamento',city:'Bogotá',
  promotion:'premium',price:'300000000',estimatedMonthlyRent:'2000000',images:[],published:true};
const project={...premium,id:'parque',title:'Proyecto de prueba',promotion:'new-project',estimatedMonthlyRent:null};
const goods={...premium,id:'carro',title:'Vehículo de prueba',catalog:'vehiculos-y-bienes',promotion:null,estimatedMonthlyRent:null};
const fixture = createServer((req,res) => {
  if (req.method !== 'GET') { res.writeHead(405).end(); return; }
  const path = new URL(req.url,'http://localhost').pathname;
  let data = [];
  if (path === '/api/properties' || path === '/api/properties/featured') data = [property];
  if (path === '/api/properties/featured') data = [
    {...property,latitude:4.63,longitude:-74.06},
    {...property,id:'zona',slug:'zona',neighborhood:'Restrepo'},
    {...property,id:'pendiente',slug:'pendiente',neighborhood:'Sin referencia'},
  ];
  if (path === '/api/properties/panorama') data = property;
  if (path === '/api/sales/comprar') data=[premium,project];
  if (path === '/api/sales/vehiculos-y-bienes') data=[goods];
  if (path === '/api/sales/market') data=[premium,project,goods];
  if (path === '/api/site-content') data = [{ id:'contacto', revision:1, values:{streetAddress:'Calle de prueba 10'} }];
  if (path === '/api/auth/me') {
    const role = req.headers.authorization === 'Bearer fixture-admin' ? 'ADMIN' : 'USER';
    data = {sub:'fixture', name:'Cuenta de prueba',role,portal:'TENANT',email:'prueba@example.test'};
  }
  if (path === '/api/admin/dashboard') data = { availableProperties:1,pendingInvoices:0,newContacts:0,collectedAmount:0 };
  res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data));
});
async function port(server) {
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return server.address().port;
}
const apiPort = await port(fixture);
const reservation = createServer();
const webPort = await port(reservation);
await new Promise(resolve=>reservation.close(resolve));
const origin = 'http://127.0.0.1:'+webPort;
const out = '.local/bogota-edge';
await mkdir(out,{recursive:true});
const web = spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','-H','127.0.0.1','-p',String(webPort)],{
  windowsHide:true,stdio:'ignore',env:{...process.env,APP_ENV:'local',API_INTERNAL_URL:'http://127.0.0.1:'+apiPort},
});
const browser = await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : 'chrome'});
const errors = [];
const rendered = '.jbSkylineFrame[data-rendered] canvas';
async function checkIdentity(page,previous) {
  await page.locator(rendered).waitFor();
  assert.ok(await previous.evaluate(canvas=>canvas === document.querySelector('.jbSkylineFrame canvas')), 'La navegación reemplazó el lienzo');
}
function publicLink(page,path) { return page.locator('nav[aria-label="Navegación principal"] a[href="'+path+'"]'); }
try {
  for(let i=0;i<60;i++){
    if (web.exitCode !== null) throw Error('El servidor local terminó antes de responder');
    try { if((await fetch(origin)).ok) break; } catch {}
    await delay(250);
  }
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(()=>{
    const link=WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram=function(program){
      link.call(this,program);
      if(this.getUniformLocation(program,'uHills')) window.skylineProgram=program;
    };
  });
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);
  await page.locator(rendered).waitFor();
  const brand=page.locator('.header .brand [data-tone="gold"]');
  await brand.waitFor();
  assert.equal(await brand.evaluate(node=>getComputedStyle(node).color),'rgb(201, 167, 123)');
  assert.equal(await page.locator('.footerBrand img').getAttribute('src'),'/brand/logo-mono-white.svg');
  const cards=page.locator('#portafolio .assetCard');
  assert.equal(await cards.count(),3);
  await cards.first().focus();
  await page.waitForFunction(()=>document.body.hasAttribute('data-city-focused'));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.jbSkylineFrame')).filter.includes('blur(0px)'));
  await page.waitForFunction(()=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    return window.skylineProgram && gl.getUniform(window.skylineProgram,gl.getUniformLocation(window.skylineProgram,'projectionMatrix'))[0]>1.025;
  });
  await cards.nth(1).focus();
  assert.equal(await cards.nth(1).getAttribute('data-lat'),null);
  await page.locator('#home-search').focus();
  await page.waitForFunction(()=>!document.body.hasAttribute('data-city-focused') &&
    getComputedStyle(document.querySelector('.jbSkylineFrame')).filter.includes('blur(0.55px)'));
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  const canvas = await page.locator(rendered).elementHandle();
  await page.evaluate(()=>document.fonts.ready);
  // Allow Motion's entrance to finish before comparing the same pixels.
  await page.locator(rendered).evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
  await page.screenshot({path:out+'/portada.png'});
  const box=await canvas.boundingBox();
  assert.deepEqual(box,{x:0,y:0,...page.viewportSize()},'La escena cubre toda la ventana');
  const readPhase=()=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    return gl.getUniform(p,gl.getUniformLocation(p,'uPhase'));
  };
  const phase=await page.evaluate(readPhase);
  await page.waitForFunction(previous=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    return Math.abs(gl.getUniform(p,gl.getUniformLocation(p,'uPhase'))-previous)>.001;
  },phase);
  const x=Math.round(box.x+box.width*.974), y=Math.round(box.y+box.height*.79);
  const clip={x:x-18,y:y-18,width:36,height:36};
  async function redChannel() {
    const {channels}=await sharp(await page.screenshot({clip})).stats();
    return channels[0].mean;
  }
  const cold=await redChannel();
  await page.mouse.move(x,y);
  await page.waitForFunction(() => {
    const gl = document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const program = window.skylineProgram;
    return program && gl.getUniform(program,gl.getUniformLocation(program,'uHeat')) > .9;
  });
  const warm=await redChannel();
  assert.ok(warm>cold+10,'El cursor debe iluminar los píxeles de la fachada');
  await page.screenshot({path:out+'/luz-ambar.png'});
  await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  await page.waitForFunction(()=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    return p && gl.getUniform(p,gl.getUniformLocation(p,'uStreet'))>.98;
  });
  const footer=page.getByRole('contentinfo');
  assert.match(await footer.locator('address').innerText(),/Calle de prueba 10/);
  assert.ok(await footer.locator('address a[href^="tel:"]').isVisible());
  assert.ok(await footer.locator('address a[href^="mailto:"]').isVisible());
  assert.equal(await canvas.evaluate(e=>e.getBoundingClientRect().top),0);
  await page.mouse.move(620,740);
  await page.waitForFunction(()=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    const point=gl.getUniform(p,gl.getUniformLocation(p,'uPointer'));
    return Math.abs(point[1]-(1-740/innerHeight))<.002;
  });
  await page.screenshot({path:out+'/calle-contacto.png'});
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await publicLink(page,'/inmuebles').click();
  const detail=page.getByRole('link',{name:'Ver inmueble: '+property.title,exact:true});
  await detail.waitFor();
  await checkIdentity(page,canvas);
  const opportunities=page.getByRole('complementary',{name:'Oportunidades de inversión'});
  await opportunities.getByText('8 % bruto anual').waitFor();
  await opportunities.getByText('Canon estimado pendiente de publicación').waitFor();
  assert.equal(await opportunities.locator('.yieldTrack').count(),1);
  await opportunities.screenshot({path:out+'/rentabilidad-ejemplo.png'});
  await detail.click();
  await page.getByRole('heading',{name:property.title}).waitFor();
  await checkIdentity(page,canvas);
  await page.waitForFunction(() => {
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    return p && gl.getUniform(p,gl.getUniformLocation(p,'projectionMatrix'))[0]>1.14;
  });
  await page.evaluate(()=>window.scrollBy({top:800,behavior:'instant'}));
  await page.waitForFunction(()=>{
    const gl=document.querySelector('.jbSkylineFrame canvas').getContext('webgl2');
    const p=window.skylineProgram;
    return p && gl.getUniform(p,gl.getUniformLocation(p,'uScroll'))>.2;
  });
  await page.goBack();
  await detail.waitFor();
  await checkIdentity(page,canvas);
  await page.locator('.investment a[href="/comprar"]').click();
  await page.locator('.rail-sale').getByText('Premium',{exact:true}).waitFor();
  await page.locator('.rail-sale').getByText('Nuevo proyecto',{exact:true}).waitFor();
  assert.equal(await page.locator('.rail-goods .assetCard').count(),1);
  await checkIdentity(page,canvas);
  await page.getByRole('button',{name:'Consulta jurídica inmobiliaria'}).click();
  const cloud=page.getByRole('dialog');
  assert.ok((await cloud.getByRole('link',{name:/Abrir en ChatGPT/}).getAttribute('href')).startsWith('https://chatgpt.com/?q='));
  await page.keyboard.press('Escape');
  assert.equal(await cloud.count(),0);
  await publicLink(page,'/comprar').click();
  await checkIdentity(page,canvas);
  await publicLink(page,'/contacto').click();
  await page.getByRole('main').getByRole('link',{name:/Buzón/}).click();
  await page.waitForURL('**/sugerencias');
  await checkIdentity(page,canvas);
  await page.locator('.navAuth a[href="/login"]').click();
  await page.getByLabel('Contraseña').waitFor();
  await checkIdentity(page,canvas);
  for(const [role,path] of [['admin','/admin'],['user','/mi-cuenta']]){
    await page.context().addCookies([{name:'inmo_token',value:'fixture-'+role,url:origin}]);
    await page.goto(origin);
    await page.locator(rendered).waitFor();
    const before=await page.locator(rendered).elementHandle();
    await publicLink(page,path).click();
    await page.waitForURL('**'+path);
    await checkIdentity(page,before);
    await page.getByRole('heading',{level:1}).waitFor({state:'visible'});
    if(role==='admin'){
      await page.locator('a[href="/admin/ofertas"]:visible').first().click();
      await page.getByRole('link',{name:'Nueva oferta'}).click();
      await page.getByLabel('Distintivo de la oferta').selectOption('premium');
      await page.getByLabel('Canon mensual estimado').fill('2000000');
      await page.getByRole('combobox',{name:/^Catálogo/}).selectOption('vehiculos-y-bienes');
      assert.equal(await page.getByLabel('Canon mensual estimado').count(),0);
    }else{
      await page.getByRole('link',{name:'Mis documentos PDF'}).click();
      await page.waitForURL('**/mi-cuenta/documentos');
    }
    await checkIdentity(page,before);
  }
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await mobile.goto(origin);
  await mobile.getByRole('heading',{level:1}).waitFor();
  const mobileBrand=mobile.locator('.header .brand [role="img"]');
  assert.ok(await mobileBrand.evaluate(node=>{
    const bounds=node.getBoundingClientRect();
    const auth=document.querySelector('.header .navAuth').getBoundingClientRect();
    return bounds.width>=140 && bounds.left>=0 && bounds.right<=auth.left;
  }),'El monograma y el nombre deben caber junto al acceso en móvil');
  const mobileCanvas=await mobile.locator('.jbSkylineFrame canvas').elementHandle();
  assert.equal(await mobile.locator(rendered).count(),0);
  assert.match(await mobile.locator('.jbSkylineFrame').evaluate(e=>getComputedStyle(e).backgroundImage),/cerros\.webp/);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:out+'/movil-reducido.png'});
  await mobile.emulateMedia({reducedMotion:'no-preference'});
  await mobile.locator(rendered).waitFor();
  await mobile.emulateMedia({reducedMotion:'reduce'});
  await mobile.locator(rendered).waitFor({state:'detached'});
  assert.ok(await mobileCanvas.evaluate(n=>n===document.querySelector('.jbSkylineFrame canvas')));
  await mobile.getByRole('contentinfo').scrollIntoViewIfNeeded();
  assert.match(await mobile.getByRole('contentinfo').evaluate(n=>getComputedStyle(n).backgroundImage),/calle\.webp/);
  await mobile.screenshot({path:out+'/calle-movil-reducida.png'});
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
  });
  await fallback.goto(origin);
  assert.equal(await fallback.locator('#portafolio .assetCard').count(),3);
  await fallback.locator('#portafolio .assetCard').first().focus();
  assert.equal(await fallback.locator('#portafolio .assetCard').first().getAttribute('href'),'/inmuebles/panorama');
  await publicLink(fallback,'/inmuebles').click();
  await fallback.getByLabel('Barrio o inmueble').fill('Centro');
  assert.equal(await fallback.locator(rendered).count(),0);
  assert.deepEqual(errors,[]);
  console.log(`Edge ${browser.version()}: luz roja media ${cold.toFixed(1)} → ${warm.toFixed(1)}. Lienzo persistente, cámara, scroll, historial, IA, acceso, portales de prueba, móvil, movimiento reducido y alternativa sin WebGL verificados.`);
} finally {
  await browser.close();
  web.kill();
  fixture.closeAllConnections();
  await new Promise(resolve=>fixture.close(resolve));
}
