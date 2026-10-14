import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const host = process.env.SONAR_HOST_URL || 'http://localhost:9002';
const project = process.env.SONAR_PROJECT_KEY || 'inmobiliaria-raiz-platform';
const url = new URL(host);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error('La inicialización automática es exclusiva de Sonar local.');
}
const file = new URL('../.local/sonar.env', import.meta.url);
let saved = '';
try { saved = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (/^SONAR_TOKEN=.+$/m.test(saved)) {
  console.log('Sonar ya está configurado en .local/sonar.env.');
  process.exit(0);
}

let ready = false;
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const response = await fetch(`${host}/api/system/status`, { signal: AbortSignal.timeout(5000) });
    if (response.ok && (await response.json()).status === 'UP') { ready = true; break; }
  } catch { /* The container is still starting. */ }
  await delay(2000);
}
if (!ready) throw new Error('Sonar no está disponible; revise los logs de Docker.');

function basicAuth(password) {
  return `Basic ${Buffer.from('admin:' + password).toString('base64')}`;
}

let password = /^SONAR_ADMIN_PASSWORD=(.+)$/m.exec(saved)?.[1] || 'admin';
if (password !== 'admin') {
  const auth = await fetch(`${host}/api/authentication/validate`, {
    headers: { Authorization: basicAuth(password) },
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!auth.ok || !(await auth.json()).valid) password = 'admin';
}
async function post(path, params) {
  const response = await fetch(`${host}/api/${path}`, {
    method: 'POST',
    headers: { Authorization: basicAuth(password), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Inicialización Sonar fallida: ${path}, HTTP ${response.status}.`);
  return response;
}

await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
if (password === 'admin') {
  const generated = `Inmo-${randomBytes(24).toString('hex')}!7`;
  // Save first to allow recovery if the process exits after changing the password.
  await writeFile(file, `SONAR_HOST_URL=${host}\nSONAR_PROJECT_KEY=${project}\nSONAR_ADMIN_PASSWORD=${generated}\n`, { mode: 0o600 });
  await post('users/change_password', { login: 'admin', previousPassword: 'admin', password: generated });
  password = generated;
}
const search = await fetch(`${host}/api/projects/search?projects=${encodeURIComponent(project)}`, {
  headers: { Authorization: basicAuth(password) },
  signal: AbortSignal.timeout(15000), redirect: 'error',
});
if (!search.ok) throw new Error(`No se pudo consultar el proyecto: HTTP ${search.status}.`);
if (!(await search.json()).components?.some((item) => item.key === project)) {
  await post('projects/create', { project, name: 'Asesoria Inmobiliaria JB' });
}
const token = await (await post('user_tokens/generate', { name: `inmobiliaria-local-${Date.now()}`, type: 'USER_TOKEN' })).json();
if (!token.token) throw new Error('Sonar no generó el token.');
await writeFile(file, `SONAR_HOST_URL=${host}\nSONAR_PROJECT_KEY=${project}\nSONAR_ADMIN_PASSWORD=${password}\nSONAR_TOKEN=${token.token}\n`, { mode: 0o600 });
console.log('Proyecto creado. Credenciales guardadas en .local/sonar.env, excluido de Git.');
