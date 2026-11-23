import assert from 'node:assert/strict';
import { spawn, fork } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareCoverageMaps } from './e2e-browser-coverage.mjs';

const database = new URL(process.env.DATABASE_URL);
assert.equal(database.pathname, '/inmobiliaria_ci');
assert.ok(['localhost','127.0.0.1'].includes(database.hostname));
assert.equal(process.env.STORAGE_BUCKET, 'inmobiliaria-ci');
assert.ok(['localhost','127.0.0.1'].includes(process.env.STORAGE_ENDPOINT));
assert.equal(process.env.CI, 'true');
const web = 'http://localhost:13613';
const api = 'http://127.0.0.1:14613';
const env = {...process.env, APP_ENV:'local', NODE_ENV:'production', PUBLIC_REGISTRATION_ENABLED:'true',
  RATE_LIMIT_REGISTER:'60', RATE_LIMIT_LOGIN:'60', RATE_LIMIT_CONTACT:'60',
  WEB_ORIGIN:web, API_INTERNAL_URL:api, NEXT_TELEMETRY_DISABLED:'1'};
if (env.JB_TEST_COVERAGE === '1') {
  await prepareCoverageMaps();
  env.NODE_V8_COVERAGE=resolve('coverage/tmp');
}
const children = [];
function start(file, args, port) {
  const child = fork(file, args, {execArgv:['--import', new URL('./e2e-coverage-exit.mjs', import.meta.url).href], env:{...env,PORT:String(port),HOSTNAME:'127.0.0.1'}, silent:true});
  const exited = once(child,'exit');
  let tail='';
  for (const pipe of [child.stdout, child.stderr]) pipe.on('data', chunk => {tail=(tail+chunk).slice(-1500);});
  children.push({child, exited});
  return async url => {
    for(let attempt=0; attempt<60; attempt++){
      if(child.exitCode !== null) throw new Error('El servidor de prueba terminó. '+tail);
      try { if((await fetch(url,{signal:AbortSignal.timeout(1500)})).ok) return; } catch {}
      await delay(500);
    }
    throw new Error('No respondió '+url+' en el entorno de prueba. '+tail);
  };
}
try {
  await start('apps/api/dist/main.js', [], 14613)(api+'/api/health/ready');
  await start('node_modules/next/dist/bin/next',['start','apps/web','--port','13613','--hostname','127.0.0.1'],13613)(web+'/brand/favicon.svg');
  for(const [script,...args] of [
    ['account-portals-local.mjs'], ['document-portal-local.mjs'], ['editorial-local.mjs'], ['editorial-home-edge.mjs','--ci'],
  ]) {
    const child=spawn(process.execPath,['scripts/'+script,...args],{env,stdio:'inherit',windowsHide:true});
    const [code]=await once(child,'exit');
    assert.equal(code,0,script);
  }
} finally {
  for (const {child,exited} of children.reverse()) {
    if(child.exitCode !== null || child.signalCode !== null) continue;
    child.send('finish-disposable-test');
    const timeout=setTimeout(()=>child.kill(),5000);
    try { await exited; } finally { clearTimeout(timeout); }
  }
}
