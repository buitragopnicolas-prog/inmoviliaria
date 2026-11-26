import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { prerender } from 'react-dom/static';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'FormData', 'File', 'Event', 'MouseEvent', 'KeyboardEvent']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  constructor(callback) { globalThis.__ui.onResize = callback; }
  observe() {}
  disconnect() { globalThis.__ui.resizeDisconnected = true; }
};
const { render, fireEvent, cleanup, waitFor, within, act } = await import('@testing-library/react');

// Keep real React state, DOM and application components; isolate only Next's
// routing/server boundary so tests cannot submit to a database or live API.
const actionSource = await readFile('apps/web/app/actions.ts', 'utf8');
const actionNames = [...actionSource.matchAll(/export async function (\w+)/g)].map((match) => match[1]);
const stubs = {
  'read-site': 'import {defaultCopy} from "./apps/web/lib/site-content.ts"; export async function readSite(){return defaultCopy;} export async function editSite(){return globalThis.__ui.sections ?? [];}',
  ai: 'export async function runAiTool(...args) { globalThis.__ui.aiCalls.push(args); return globalThis.__ui.aiRun(...args); }',
  actions: actionNames.map((name) => `export async function ${name}(...args) { globalThis.__ui.calls.push({ name: '${name}', data: args.at(-1) }); return globalThis.__ui.result; }`).join('\n'),
  api: 'export class ApiError extends Error {} export async function getCurrentUser(){ return globalThis.__ui.user; } export async function apiFetch(path, ...args) { globalThis.__ui.requests.push([path, ...args]); const responses = globalThis.__ui.apiResponses; if (responses && Object.hasOwn(responses, path)) { if (responses[path] instanceof Error) throw responses[path]; return responses[path]; } return path.startsWith("/invoices") ? globalThis.__ui.invoice : path.includes("manual/config") ? globalThis.__ui.config : globalThis.__ui.news; }',
  auth: 'export async function requireUser(role) { globalThis.__ui.roles.push(role); return globalThis.__ui.user ?? { name: "Admin JB", portal:"TENANT" }; }',
  cache: 'export function updateTag(tag) {globalThis.__ui.revalidated.push(tag);} export function revalidatePath(path) { globalThis.__ui.revalidated.push(path); }',
  headers: 'export async function headers(){return new Headers();} export function cookies() { throw new Error("Cookies are unavailable in this test"); }',
  navigation: 'export function notFound(){ throw new Error("Not found"); } export function usePathname() { return globalThis.__ui.pathname; } export function useRouter() { return globalThis.__ui.router; } export function redirect() { throw new Error("Unexpected redirect"); }',
  link: 'import React from "react"; export default function Link({ children, onClick, prefetch, ...props }) { return React.createElement("a", { ...props, onClick: event => { onClick?.(event); event.preventDefault(); } }, children); }',
  image: 'import React from "react"; export default function Image({ fill, priority, ...props }) { return React.createElement("img", props); }',
};
const names = ['AiTools', 'PropertyCard', 'PublicNavigation', 'ActiveLink', 'AuthForm', 'ContactForm', 'AdminNewsForm', 'AdminUserForm', 'AdminFileUploadForm', 'AdminPropertyForm', 'AdminPropertyEditForm', 'AdminAssignPropertyForm', 'AdminDeletePropertyButton', 'AdminInvoiceForm', 'AdminInvoiceManager', 'AdminLeaseContractForm', 'ManualPaymentForm', 'ManualPaymentReviewForm'];
names.push('AdminWorkspace', 'AdminCreatePanel', 'AdminListControls', 'AdminContactStatusForm', 'AdminTableRegion', 'PublicSiteChrome');
names.push('PropertyGallery', 'CatalogResults', 'PortalEntry');
const entry = "export { PolicyProvider } from './apps/web/components/ConsentField.tsx';\n"+names.map((name) => `export { ${name} } from './apps/web/components/${name}.tsx';`).join('\n') +
  "\nexport { ManualPaymentReviewQueue } from './apps/web/components/ManualPaymentReviewForm.tsx';" +
  "\nexport { default as ContactPage } from './apps/web/app/contacto/page.tsx';" +
  "\nexport { default as MyAccountPage } from './apps/web/app/mi-cuenta/page.tsx';" +
  "\nexport { reportManualPaymentAction, contactAction, loginAction } from './apps/web/app/actions.ts';" +
  "\nexport { HomeHero } from './apps/web/components/home/HomeSections.tsx';\nexport { default as PayInvoicePage } from './apps/web/app/mi-cuenta/facturas/[id]/pagar/page.tsx';\nexport { default as AdminNewsPage } from './apps/web/app/admin/noticias/page.tsx';" +
  ['inmuebles', 'usuarios', 'facturas', 'contactos', 'archivos', 'conciliacion'].map((route) => `\nexport { default as Admin_${route} } from './apps/web/app/admin/${route}/page.tsx';`).join('') +
  "\nexport { default as AdminDashboardPage } from './apps/web/app/admin/page.tsx';\nexport * from './apps/web/lib/admin-lists.ts';\nexport { SkipToContentLink } from './apps/web/components/PublicSiteChrome.tsx';" +
  "\nexport { default as AdminLayout } from './apps/web/app/admin/layout.tsx';\nexport { default as AdminLoading } from './apps/web/app/admin/loading.tsx';\nexport { default as AdminError } from './apps/web/app/admin/error.tsx';\nexport { default as AdminUserDetail } from './apps/web/app/admin/usuarios/[id]/page.tsx';\nexport { updateContactStatusAction } from './apps/web/app/actions.ts';";
const coverageRoutes = {
  Home: '', Sales: '[catalogo]/', SaleDetail: '[catalogo]/[id]/', Content: 'admin/contenido/',
  Offers: 'admin/ofertas/', OwnerPublications: 'propietarios/publicaciones/', Templates: 'admin/formatos/',
  AccountDocuments: 'admin/documentos/', Documents: 'mi-cuenta/documentos/', RentalRequest: 'solicitud-de-arrendamiento/',
  CustomerServices: 'servicios/', Suggestions: 'admin/sugerencias/', SuggestionFormPage: 'sugerencias/',
};
const publishingEntry = Object.entries(coverageRoutes).map(([name, route]) =>
  "export { default as " + name + " } from './apps/web/app/" + route + "page.tsx';").join('\n') +
  "\nexport * from './apps/web/app/admin/publishing-actions.ts';\nexport * from './apps/web/app/document-actions.ts';\nexport * from './apps/web/app/propietarios/publicaciones/actions.ts';";
await mkdir('.local', { recursive: true });
const bundle = resolve('.local/ui-test-bundle.mjs');
await build({
  stdin: { contents: entry + '\n' + publishingEntry, resolveDir: process.cwd(), sourcefile: 'ui-test-entry.mjs' },
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: 'apps/web/tsconfig.json', sourcemap: 'inline', sourcesContent: true,
  plugins: [{ name: 'server-boundary', setup(builder) {
    builder.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: 'next/dynamic.js', external: true }));
    builder.onResolve({ filter: /^next\/form$/ }, () => ({ path: 'next/form.js', external: true }));
    builder.onResolve({ filter: /^\.\/api$/ }, ({ importer }) => importer.endsWith('public-data.ts') ? {path:'api',namespace:'ui-stub'} : undefined);
    builder.onResolve({ filter: /^@\/lib\/run-ai-tool$/ }, () => ({ path: 'ai', namespace: 'ui-stub' }));
    builder.onResolve({ filter: /^(@\/app\/actions|@\/lib\/api|@\/lib\/auth|@\/lib\/read-site|next\/(link|navigation|image|cache|headers))$/ }, ({ path }) => {
      const key = path === '@/app/actions' ? 'actions' : path.split('/').at(-1);
      return { path: key, namespace: 'ui-stub' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'ui-stub' }, ({ path }) => ({ contents: stubs[path], loader: 'js', resolveDir: process.cwd() }));
  } }],
});
const ui = await import(pathToFileURL(bundle).href);
const property = { id: 'property-1', title: 'Casa de prueba', address: 'Calle 1', city: 'Bogotá', neighborhood: 'Centro', monthlyRent: 1000000, description: 'Casa', features: [], images: [], published: true, bedrooms: 2, bathrooms: 1, parking: 0, areaM2: 50 };
const invoice = { id: 'invoice-1', code: 'FAC-1', amount: 1000000, balance: 1000000, status: 'PENDING', period: '2026-10-01', dueDate: '2026-10-10', lease: { property }, user: { name: 'Cliente' }, payments: [] };
const config = { enabled: true, mode: 'manual', notice: 'Requiere verificación', methods: [{ code: 'BANK_TRANSFER', title: 'Transferencia', description: 'Cuenta autorizada', enabled: true, details: [] }] };
function reset() { globalThis.__ui = { calls: [], roles: [], requests: [], revalidated: [], result: { success: 'Solicitud recibida' }, pathname: '/', invoice: structuredClone(invoice), config: structuredClone(config), news: [{ id: 'news-1', title: 'Noticia de prueba', createdAt: '2026-10-01', published: true }] }; }
reset();
afterEach(() => { cleanup(); reset(); });
function component(name, props = {}) { return render(React.createElement(ui[name], props),{wrapper:({children})=>React.createElement(ui.PolicyProvider,{value:{href:'/politica-de-datos',version:'a'.repeat(64)}},children)}); }

test('la galería conserva los enlaces, recorre fotos con botones y teclado y devuelve el foco', () => {
  const images = ['Sala', 'Cocina'].map((alt, index) => ({ id: String(index), alt, url: '/foto-' + index + '.jpg', sortOrder: index }));
  const view = component('PropertyGallery', { images, title: 'Apartamento de prueba' });
  const thumbnail = view.container.querySelector('summary');
  assert.match(thumbnail.textContent, /Ver las 2 fotos/);
  assert.deepEqual([...view.container.querySelectorAll('details a')].map(link => new URL(link.href).pathname), ['/foto-0.jpg', '/foto-1.jpg']);
  const dialog = view.container.querySelector('dialog');
  // JSDOM lacks the native dialog methods. Drive their DOM events explicitly.
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  fireEvent.click(thumbnail);
  const viewer = within(view.getByRole('dialog', { name: 'Fotografías de Apartamento de prueba' }));
  assert.equal(viewer.getByRole('img').alt, 'Sala');
  fireEvent.click(viewer.getByRole('button', { name: 'Foto anterior' }));
  assert.equal(viewer.getByRole('img').alt, 'Cocina');
  fireEvent.keyDown(dialog, { key: 'ArrowRight' });
  assert.ok(viewer.getByText('Foto 1 de 2'));
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
  assert.ok(viewer.getByText('Foto 2 de 2'));
  fireEvent.click(viewer.getByRole('button', { name: 'Cerrar galería' }));
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.activeElement, thumbnail);
});

test('la ficha sin fotografías muestra la referencia sin ofrecer ampliación', () => {
  const view = component('PropertyGallery', { images: [], title: 'Apartamento de prueba' });
  assert.equal(view.queryByRole('link'), null);
  view.rerender(React.createElement(ui.PropertyGallery, { images: [{ id: 'placeholder', url: '/property-placeholder.svg', alt: '' }], title: 'Apartamento de prueba' }));
  assert.equal(view.getByRole('img').getAttribute('src'), '/property-placeholder.svg');
  assert.equal(view.queryByRole('link'), null);
});

test('una sola fotografía conserva el enlace al original y omite los controles de recorrido', () => {
  const view = component('PropertyGallery', { images: [{ id: '1', url: '/sala.jpg', alt: 'Sala' }], title: 'Casa de prueba' });
  assert.match(view.getByRole('link', { name: /Ampliar foto/ }).href, /\/sala\.jpg$/);
  assert.equal(view.container.querySelector('details'), null);
  assert.equal(view.queryByRole('button', { name: 'Foto siguiente', hidden: true }), null);
});

test('el reintento devuelve el borrador de contacto y solo el correo en el acceso', async () => {
  const values = { name: 'Persona de prueba', email: 'visita@example.test', phone: '5550100', subject: 'Visita de prueba', message: 'Quiero visitar este inmueble.' };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  data.set('password', 'solo-para-la-prueba');
  data.set('authorized','true'); data.set('policyVersion','a'.repeat(64));
  globalThis.__ui.apiResponses = { '/contacts': new Error('Intenta de nuevo'), '/auth/login': new Error('Acceso rechazado') };
  assert.deepEqual(await ui.contactAction({}, data), { error: 'Intenta de nuevo', values });
  assert.deepEqual(JSON.parse(globalThis.__ui.requests[0][1].body), {...values,authorized:true,policyVersion:'a'.repeat(64)});
  assert.deepEqual(await ui.loginAction({}, data), { error: 'Acceso rechazado', values: { email: values.email } });
});

test('herramientas IA validan antes de cargar modelos y limpian resultados al cambiar', async () => {
  globalThis.__ui.aiCalls = [];
  globalThis.__ui.aiRun = async () => ({ text: 'A bright house.' });
  const view = component('AiTools');
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  assert.match(view.getByRole('alert').textContent, /Selecciona un archivo/);
  assert.equal(globalThis.__ui.aiCalls.length, 0);
  fireEvent.click(view.getByRole('button', { name: /Traducir texto/ }));
  fireEvent.change(view.getByRole('textbox', { name: /^Texto/ }), { target: { value: 'Una casa luminosa.' } });
  fireEvent.change(view.getByLabelText('Dirección de la traducción'), { target: { value: 'en' } });
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.equal(view.getByLabelText('Texto del resultado').value, 'A bright house.'));
  assert.equal(globalThis.__ui.aiCalls[0][0], 'translate');
  assert.equal(globalThis.__ui.aiCalls[0][1].from, 'en');
  fireEvent.click(view.getByRole('button', { name: /Comparar textos/ }));
  assert.equal(view.queryByLabelText('Texto del resultado'), null);
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  assert.match(view.getByRole('alert').textContent, /segundo texto/);
});

test('herramientas IA bloquean dobles ejecuciones y permiten reintentar después de un fallo', async () => {
  globalThis.__ui.aiCalls = [];
  let finish;
  globalThis.__ui.aiRun = (_id, _input, progress) => {
    progress({ status: 'loading', progress: 50 });
    return new Promise((resolve) => { finish = resolve; });
  };
  const view = component('AiTools');
  fireEvent.click(view.getByRole('button', { name: /Sugerir emojis/ }));
  fireEvent.change(view.getByRole('textbox', { name: /^Texto/ }), { target: { value: 'A sunny house' } });
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.equal(globalThis.__ui.aiCalls.length, 1));
  assert.equal(view.getByRole('button', { name: 'Procesando…' }).getAttribute('aria-disabled'), 'true');
  assert.equal(view.getByRole('progressbar').value, 50);
  assert.equal(view.getByRole('button', { name: /Traducir texto/ }).disabled, true);
  await act(async () => { finish({ text: '🏡' }); });
  await waitFor(() => assert.equal(view.getByLabelText('Texto del resultado').value, '🏡'));
  globalThis.__ui.aiRun = async () => { throw new Error('Modelo sin conexión'); };
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.match(view.getByRole('alert').textContent, /No se pudo completar/));
  assert.equal(view.getByRole('button', { name: 'Procesar', exact: true }).disabled, false);
});

test('herramientas IA permiten descargar imágenes y audio y liberan sus vistas previas', async () => {
  globalThis.__ui.aiCalls = [];
  globalThis.__ui.aiRun = async () => ({ blob: new Blob(['synthetic'], { type: 'image/png' }), media: 'image' });
  const view = component('AiTools');
  const file = new File(['photo'], 'foto.png', { type: 'image/png' });
  fireEvent.change(view.container.querySelector('input[type="file"]'), { target: { files: [file] } });
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.ok(view.getByRole('img', { name: 'Resultado generado por la herramienta IA' })));
  assert.equal(view.getByRole('link', { name: 'Descargar resultado' }).getAttribute('download'), 'jb-imagen-ia.png');
  fireEvent.click(view.getByRole('button', { name: /Leer en voz alta/ }));
  assert.equal(view.queryByRole('img'), null);
  globalThis.__ui.aiRun = async () => ({ blob: new Blob(['synthetic'], { type: 'audio/wav' }), media: 'audio' });
  fireEvent.change(view.getByRole('textbox', { name: /^Texto/ }), { target: { value: 'Casa luminosa' } });
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.ok(view.getByLabelText('Escuchar narración generada')));
  assert.equal(view.getByRole('link', { name: 'Descargar resultado' }).getAttribute('download'), 'jb-narracion.wav');
  view.unmount();
});

test('el buscador del inicio envía filtros compatibles con el catálogo sin acciones de escritura', () => {
  const view = component('HomeHero');
  const form = view.getByRole('form', { name: 'Buscar inmuebles en arriendo' });
  const photo = view.getByRole('img', { name: /imagen de referencia/ });
  assert.ok(form.compareDocumentPosition(photo) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  fireEvent.change(view.getByLabelText('Barrio o inmueble'), { target: { value: 'Chapinero' } });
  fireEvent.change(view.getByLabelText('Ciudad'), { target: { value: 'Bogotá' } });
  const rent = view.getByLabelText('Canon máximo (COP)');
  fireEvent.change(rent, { target: { value: '2500000' } });
  assert.equal(form.getAttribute('action'), '/inmuebles');
  assert.equal(form.method, 'get');
  assert.deepEqual(Object.fromEntries(new FormData(form)), { search: 'Chapinero', city: 'Bogotá', maxRent: '2500000' });
  fireEvent.change(rent, { target: { value: '-1' } });
  assert.equal(form.checkValidity(), false);
  assert.equal(globalThis.__ui.calls.length, 0);
});

test('los destinos de la portada abren el catálogo, el portal o los servicios', async () => {
  const hero = component('HomeHero');
  const nav = within(hero.getByRole('navigation', { name: '¿Qué quieres hacer?' }));
  const destinations = Object.fromEntries(nav.getAllByRole('link').map(link => [
    link.textContent.replace('↗', ''), link.getAttribute('href'),
  ]));
  assert.deepEqual(destinations, {
    Arrendatarios:'/arrendatarios', Propietarios:'/propietarios', 'Compra y vende': '/comprar', Arrendar: '/inmuebles',
    'Vehículos y bienes': '/vehiculos-y-bienes', Servicios: '/servicios', Clientes: '/clientes',
  });
  for (const [servicio, expected] of [['juridicos','Servicios jurídicos'],['contables','Servicios contables'],['inmobiliarios','Servicios inmobiliarios']]) {
    const contact = render(await ui.ContactPage({ searchParams: Promise.resolve({servicio}) }));
    assert.equal(contact.getByLabelText('Asunto').value, expected);
    fireEvent.change(contact.getByLabelText('Asunto'), { target: { value: 'Mi consulta' } });
    assert.equal(contact.getByLabelText('Asunto').value, 'Mi consulta');
    contact.unmount();
  }
});

test('contacto mantiene el asunto libre con un interés ausente, desconocido o repetido', async () => {
  for (const interes of [undefined, 'otro', 'constructor', ['compra', 'bienes']]) {
    const contact = render(await ui.ContactPage({ searchParams: Promise.resolve({ interes }) }));
    assert.equal(contact.getByLabelText('Asunto').value, '');
    contact.unmount();
  }
});

test('las tarjetas enlazan al detalle y distinguen disponibilidad, fotografías y administración', () => {
  const view = component('PropertyCard', { property: { ...property, slug: 'casa-prueba', status: 'RENTED', administrationFee: 150000 } });
  const link = view.getByRole('link', { name: 'Ver inmueble: Casa de prueba' });
  assert.equal(link.getAttribute('href'), '/inmuebles/casa-prueba');
  assert.equal(view.getAllByRole('link').length, 1);
  assert.ok(view.getByText('Arrendado'));
  assert.equal(view.queryByText('Disponible'), null);
  assert.ok(view.getByText('Sin fotografía'));
  assert.match(view.getByText(/de administración/).textContent, /150\.000/);
  assert.equal(view.queryByText('Recorrido 360°'), null);
  view.rerender(React.createElement(ui.PropertyCard, { property: { ...property, slug: 'casa-prueba', status: 'AVAILABLE', images: [{ url: '/uploads/seed/casa.svg', alt: 'Casa de referencia' }], tour360Url: '/tour.jpg' } }));
  assert.ok(view.getByText('Disponible'));
  assert.ok(view.getByText('Imagen de referencia'));
  assert.ok(view.getByRole('img', { name: 'Ilustración de referencia: Casa de prueba' }));
  assert.ok(view.getByText('Recorrido 360°'));
  assert.equal(view.queryByText('Sin fotografía'), null);
});

async function submit(view, buttonName, actionName, expected = {}) {
  const button = view.getByRole('button', { name: buttonName });
  const form = button.closest('form');
  form.noValidate = true;
  const before = globalThis.__ui.calls.length;
  await act(async () => { fireEvent.click(button); });
  await waitFor(() => assert.equal(globalThis.__ui.calls.length, before + 1));
  const call = globalThis.__ui.calls.at(-1);
  assert.equal(call.name, actionName);
  for (const [key, value] of Object.entries(expected)) assert.equal(call.data.get(key), value);
}

test('menú móvil: enlaces por rol, navegación con teclado, Escape y salida de foco', () => {
  for (const role of [undefined, 'USER', 'ADMIN']) {
    const view = component('PublicNavigation', { role });
    const toggle = view.getByRole('button', { name: 'Abrir menú' });
    const mobile = view.container.querySelector('#mobile-navigation');
    assert.equal(mobile.hidden, true);
    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const links = within(mobile).getAllByRole('link');
    assert.equal(links.length, role ? 8 : 7);
    assert.equal(within(mobile).getByRole('link', { name: 'Pinlau' }).getAttribute('href'), '/pinlau');
    assert.equal(within(mobile).getByRole('link', { name: 'Compra y vende' }).getAttribute('href'), '/comprar');
    fireEvent.keyDown(links[0], { key: 'Tab' });
    assert.equal(mobile.hidden, false);
    fireEvent.keyDown(links[0], { key: 'Escape' });
    assert.equal(mobile.hidden, true);
    assert.equal(document.activeElement, toggle);
    fireEvent.click(toggle);
    fireEvent.click(within(mobile).getByRole('link', { name: 'Arriendos' }));
    assert.equal(mobile.hidden, true);
    fireEvent.click(toggle);
    fireEvent.blur(toggle, { relatedTarget: links[0] });
    assert.equal(mobile.hidden, false);
    fireEvent.blur(links[0], { relatedTarget: document.body });
    assert.equal(mobile.hidden, true);
    fireEvent.keyDown(toggle, { key: 'Escape' });
    view.unmount();
  }
});

test('el enlace activo distingue rutas exactas y secciones anidadas', () => {
  globalThis.__ui.pathname = '/admin/usuarios';
  const view = component('ActiveLink', { href: '/admin', children: 'Administración' });
  assert.equal(view.getByRole('link').getAttribute('aria-current'), 'page');
  view.rerender(React.createElement(ui.ActiveLink, { href: '/admin', exact: true, children: 'Administración' }));
  assert.equal(view.getByRole('link').hasAttribute('aria-current'), false);
});

test('login y contacto envían datos y muestran el resultado de la acción', async () => {
  const login = component('AuthForm', { mode: 'login', showRegistrationLink: true });
  fireEvent.change(login.getByLabelText('Correo electrónico'), { target: { value: 'cliente@example.test' } });
  fireEvent.change(login.getByLabelText('Contraseña'), { target: { value: 'Clave-test-123' } });
  await submit(login, 'Ingresar', 'loginAction', { email: 'cliente@example.test' });
  login.unmount();
  const contact = component('ContactForm', { propertyTitle: property.title });
  fireEvent.change(contact.getByLabelText('Nombre'), { target: { value: 'Cliente' } });
  await submit(contact, 'Enviar solicitud', 'contactAction', { subject: 'Información: Casa de prueba', name: 'Cliente' });
  assert.ok(await contact.findByRole('status'));
});

test('contacto y login permiten corregir una respuesta fallida desde el mismo botón', async () => {
  const email = 'persona@example.test';
  for (const login of [false, true]) {
    const values = login ? { email } : { name: 'Persona de prueba', email, phone: '5550100', subject: 'Una visita', message: 'Solicitud de prueba.' };
    const view = login ? component('AuthForm', { mode: 'login' }) : component('ContactForm');
    const button = view.getByRole('button', { name: login ? 'Ingresar' : 'Enviar solicitud' });
    const form = button.form;
    for (const [name, value] of Object.entries(values)) fireEvent.change(form.elements[name], { target: { value } });
    if (login) fireEvent.change(form.elements.password, { target: { value: 'clave-de-prueba' } });
    else fireEvent.click(form.elements.authorized);
    const response = Promise.withResolvers();
    globalThis.__ui.result = response.promise;
    const before = globalThis.__ui.calls.length;
    button.focus();
    fireEvent.click(button);
    await waitFor(() => assert.equal(button.getAttribute('aria-busy'), 'true'));
    fireEvent.click(button);
    assert.equal(document.activeElement, button);
    await act(async () => response.resolve({ error: 'Intenta otra vez', values }));
    assert.equal(globalThis.__ui.calls.length, before + 1);
    assert.equal(view.getByRole('alert').textContent, 'Intenta otra vez');
    assert.equal(document.activeElement, button);
    for (const [name, value] of Object.entries(values)) assert.equal(form.elements[name].value, value);
    if (login) assert.equal(form.elements.password.value, '');
    const edit = login ? form.elements.password : form.elements.message;
    fireEvent.change(edit, { target: { value: 'Corrección de prueba' } });
    globalThis.__ui.result = {};
    await submit(view, button.textContent, login ? 'loginAction' : 'contactAction', { email, [edit.name]: 'Corrección de prueba' });
    view.unmount();
  }
});

test('formularios administrativos envían la acción correspondiente', async () => {
  const cases = [
    ['AdminNewsForm', {}, 'Guardar artículo', 'createNewsAction'],
    ['AdminUserForm', {}, 'Crear usuario', 'createAdminUserAction'],
    ['AdminFileUploadForm', {}, 'Cargar archivos', 'uploadFilesAction'],
    ['AdminPropertyForm', { tenants: [] }, 'Publicar inmueble', 'createPropertyAction'],
    ['AdminPropertyEditForm', { property, tenants: [] }, 'Guardar cambios', 'updatePropertyAction'],
    ['AdminInvoiceForm', { accounts:[], leases: [], services: [], products: [] }, 'Crear factura', 'createInvoiceAction'],
  ];
  for (const [name, props, button, action] of cases) {
    const view = component(name, props);
    await submit(view, button, action);
    view.unmount();
  }
});

test('asignar inmueble envía el identificador y el valor mensual seleccionado', async () => {
  const view = component('AdminAssignPropertyForm', { userId: 'user-1', properties: [property] });
  fireEvent.change(view.getByLabelText('Inmueble disponible'), { target: { value: property.id } });
  await submit(view, 'Asignar inmueble', 'assignPropertyToUserAction', { userId: 'user-1', propertyId: property.id, expectedMonthlyPayment: '1000000' });
});

test('sin inmuebles disponibles la asignación permanece deshabilitada', () => {
  const view = component('AdminAssignPropertyForm', { userId: 'user-1', properties: [] });
  assert.equal(view.getByRole('button', { name: 'Asignar inmueble' }).disabled, true);
  assert.ok(view.getByText('No hay inmuebles disponibles para asignar.'));
});

test('registro envía el nombre y las credenciales al registro, sin llamar al login', async () => {
  const view = component('AuthForm', { mode: 'register' });
  fireEvent.change(view.getByLabelText('Nombre completo'), { target: { value: 'Cliente de prueba' } });
  await submit(view, 'Crear cuenta', 'registerAction', { name: 'Cliente de prueba' });
});

test('retirar inmuebles pide confirmación y no envía una decisión cancelada', async () => {
  const view = component('AdminDeletePropertyButton', { id: property.id, title: property.title });
  window.confirm = () => false;
  fireEvent.click(view.getByRole('button', { name: 'Retirar' }));
  assert.equal(globalThis.__ui.calls.length, 0);
  window.confirm = () => true;
  await submit(view, 'Retirar', 'deletePropertyAction', { id: property.id });
});

test('editar y eliminar facturas envía acciones distintas con el mismo identificador', async () => {
  const view = component('AdminInvoiceManager', { invoices: [invoice] });
  const editButton = view.getByRole('button', { name: 'Editar FAC-1' });
  assert.equal(editButton.getAttribute('aria-expanded'), 'false');
  fireEvent.click(editButton);
  assert.equal(view.getByRole('button', { name: 'Cerrar edición de FAC-1' }).getAttribute('aria-expanded'), 'true');
  await submit(view, 'Guardar cambios', 'updateInvoiceAction', { id: invoice.id });
  window.confirm = () => true;
  await submit(view, 'Eliminar factura', 'deleteInvoiceAction', { id: invoice.id });
});

test('la vuelta de una edición encuentra el registro con el filtro y la paginación actuales', () => {
  const items = Array.from({ length: 18 }, (_, n) => ({ id: String(n + 1) }));
  const query = { buscar: 'Centro & sur', estado: 'PENDING', pagina: 2 };
  const destination = new URL(ui.adminReturnHref('/admin/facturas', query, '17'), 'https://jb.example');
  assert.equal(destination.searchParams.get('buscar'), query.buscar);
  assert.equal(destination.searchParams.get('estado'), query.estado);
  assert.equal(destination.hash, '#editar-17');
  const target = destination.searchParams.get('fila');
  assert.equal(ui.adminEditResults(items, query, target).page, 2);
  const reordered = [items[16], ...items.filter(item => item.id !== target)];
  assert.equal(ui.adminEditResults(reordered, query, target).page, 1);
  assert.equal(ui.adminEditResults(reordered, query, target).focusId, 'editar-17');
  assert.equal(ui.adminEditResults([], query, target).focusId, 'resultados-edicion');
  assert.equal(ui.adminEditResults(items, query, undefined).focusId, undefined);
});

test('contratos permiten cargar y retirar el PDF sin confundir las acciones', async () => {
  const view = component('AdminLeaseContractForm', { leaseId: 'lease-1', userId: 'user-1', contractFile: { originalName: 'contrato.pdf', size: 2048 } });
  await submit(view, 'Reemplazar PDF', 'uploadLeaseContractAction', { leaseId: 'lease-1' });
  window.confirm = () => true;
  await submit(view, 'Retirar contrato', 'removeLeaseContractAction', { leaseId: 'lease-1' });
});

test('un contrato sin PDF permite su primera carga y no ofrece retirarlo', async () => {
  const view = component('AdminLeaseContractForm', { leaseId: 'lease-1', userId: 'user-1' });
  assert.equal(view.queryByRole('button', { name: 'Retirar contrato' }), null);
  await submit(view, 'Subir PDF', 'uploadLeaseContractAction', { leaseId: 'lease-1' });
});

test('revisar un pago conserva la decisión de cada botón en FormData', async () => {
  for (const [button, decision] of [['Confirmar', 'CONFIRM'], ['Solicitar revisión', 'REVIEW'], ['Rechazar', 'REJECT']]) {
    const view = component('ManualPaymentReviewQueue', { children: React.createElement(ui.ManualPaymentReviewForm, { paymentId: 'payment-1' }) });
    await submit(view, button, 'reviewManualPaymentAction', { paymentId: 'payment-1', decision });
    view.unmount();
  }
});

test('conciliación identifica la decisión pendiente, mantiene el foco y permite corregir un error', async () => {
  const request = Promise.withResolvers();
  globalThis.__ui.result = request.promise;
  const view = component('ManualPaymentReviewQueue', { children: React.createElement(ui.ManualPaymentReviewForm, { paymentId: 'payment-1' }) });
  const button = view.getByRole('button', { name: 'Rechazar' });
  const note = view.getByLabelText('Nota de revisión');
  fireEvent.change(note, { target: { value: 'Nota de prueba' } });
  button.focus();
  fireEvent.click(button);
  await view.findByText('Registrando rechazo…');
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(document.activeElement, button);
  fireEvent.click(button);
  fireEvent.click(view.getByRole('button', { name: 'Confirmar' }));
  await act(async () => request.resolve({ paymentId: 'payment-1', error: 'Revisa la nota.' }));
  assert.equal(globalThis.__ui.calls.length, 1);
  assert.equal(view.getByRole('alert').textContent, 'Revisa la nota.');
  assert.equal(note.value, 'Nota de prueba');
  assert.equal(button.getAttribute('aria-disabled'), 'false');
});

test('Mi cuenta consulta el pago exacto del titular y muestra el saldo de su factura', async () => {
  const payment = { reference: 'MAN-PRUEBA', status: 'APPROVED', amount: 300000, provider: 'MANUAL' };
  const older = { ...payment, reference: 'MAN-ANTERIOR' };
  const bill = { ...invoice, balance: 400000, payments: [older, payment] };
  globalThis.__ui.apiResponses = { '/invoices/me': [bill], '/leases/me': [] };
  async function account(query) {
    return render(await ui.MyAccountPage({ searchParams: Promise.resolve(query) }));
  }
  for (const query of [{}, { pago: 'aprobado' }, { referencia: 'AJENA' }, { referencia: [payment.reference, older.reference] }]) {
    const view = await account(query);
    assert.equal(view.queryByRole('status'), null);
    view.unmount();
  }
  for (const [status, label] of [['APPROVED', 'Pago aprobado'], ['AWAITING_VERIFICATION', 'Pendiente de verificación'], ['UNDER_REVIEW', 'Pago en revisión'], ['REJECTED', 'Pago rechazado'], ['REFUNDED', 'Pago reembolsado'], ['FUTURO', 'Estado del pago por verificar']]) {
    payment.status = status;
    const view = await account({ referencia: payment.reference, pago: 'aprobado' });
    const notice = view.getByRole('status');
    assert.ok(notice.textContent.startsWith(label));
    assert.equal(notice.classList.contains('success'), status === 'APPROVED');
    for (const expected of [invoice.code, payment.reference, '300.000', '400.000']) assert.ok(notice.textContent.includes(expected));
    view.unmount();
  }
  assert.ok(globalThis.__ui.roles.every(role => role === 'USER'));
  assert.ok(globalThis.__ui.requests.every(([path, , authenticated]) => ['/invoices/me', '/leases/me'].includes(path) && authenticated));
});

test('reportar un pago envía factura, importe y referencia y evita un segundo envío', async () => {
  const view = component('ManualPaymentForm', { invoiceId: invoice.id, amount: invoice.balance, idempotencyKey: 'request-1', config });
  fireEvent.change(view.getByLabelText('Referencia bancaria'), { target: { value: 'BANK-123' } });
  await submit(view, 'Ya realicé el pago', 'reportManualPaymentAction', { invoiceId: invoice.id, amount: '1000000', bankReference: 'BANK-123' });
  assert.equal(view.getByRole('button', { name: 'Ya realicé el pago' }).disabled, true);
});

test('la acción envía solo el contrato multipart y usa el estado devuelto en un reintento', async () => {
  const path = '/payments/invoices/invoice-1/manual-report';
  globalThis.__ui.apiResponses = { [path]: { reference: 'MAN-1', status: 'UNDER_REVIEW' } };
  const form = new FormData();
  for (const [key, value] of Object.entries({ invoiceId: 'invoice-1', method: 'BANK_TRANSFER', amount: '1000000', bankReference: 'BANCO-1', paidAt: '2026-10-01T12:00', idempotencyKey: 'solicitud-sintetica-1', '$ACTION_KEY': 'interno' })) form.set(key, value);
  form.set('receipt', new File(['%PDF-1.4'], 'sintetico.pdf', { type: 'application/pdf' }));
  const result = await ui.reportManualPaymentAction({}, form);
  const [[endpoint, request, authenticated]] = globalThis.__ui.requests;
  assert.equal(endpoint, path);
  assert.equal(authenticated, true);
  assert.deepEqual([...request.body.keys()].sort(), ['amount', 'bankReference', 'idempotencyKey', 'method', 'paidAt', 'receipt']);
  assert.equal(request.body.get('receipt').name, 'sintetico.pdf');
  assert.equal(result.success, 'Pago en revisión. Referencia MAN-1.');
});

test('página de pago permite checkout y confirmación mock sólo en su modo correspondiente', async () => {
  for (const [reference, mode, button, action] of [[undefined, 'gateway', 'Continuar al pago', 'beginPaymentAction'], ['MOCK-1', 'mock', 'Simular pago aprobado', 'approveMockAction']]) {
    globalThis.__ui.config.mode = mode;
    globalThis.__ui.invoice.payments = [{ reference: 'MOCK-1', provider: 'MOCK', status: 'PENDING', amount: invoice.balance }];
    const view = render(await ui.PayInvoicePage({ params: Promise.resolve({ id: invoice.id }), searchParams: Promise.resolve({ reference }) }));
    assert.deepEqual(globalThis.__ui.roles, ['USER']);
    await submit(view, button, action);
    view.unmount();
    globalThis.__ui.roles = [];
  }
});

test('noticias administrativas archivan el registro seleccionado', async () => {
  const view = render(await ui.AdminNewsPage({}));
  assert.deepEqual(globalThis.__ui.roles, ['ADMIN']);
  await submit(view, 'Ocultar', 'archiveNewsAction', { id: 'news-1' });
});

test('el menú administrativo conserva la sección activa y cierra con Escape y al navegar', () => {
  globalThis.__ui.pathname = '/admin/usuarios/user-1';
  const view = component('AdminWorkspace', { children: React.createElement('h1', null, 'Perfil') });
  const nav = within(view.getByRole('navigation', { name: 'Administración', exact: true }));
  assert.equal(nav.getByRole('link', { name: 'Usuarios', exact: true }).getAttribute('aria-current'), 'page');
  assert.equal(nav.getByRole('link', { name: 'Resumen', exact: true }).getAttribute('aria-current'), null);
  const toggle = view.getByRole('button', { name: 'Menú', exact: true });
  fireEvent.click(toggle);
  assert.equal(view.getByRole('button', { name: 'Cerrar menú', exact: true }).getAttribute('aria-expanded'), 'true');
  fireEvent.keyDown(view.getByRole('button', { name: 'Cerrar menú', exact: true }), { key: 'Escape' });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, toggle);
  fireEvent.click(toggle);
  fireEvent.click(nav.getByRole('link', { name: 'Facturación', exact: true }));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  fireEvent.click(toggle);
  globalThis.__ui.pathname = '/admin/facturas';
  view.rerender(React.createElement(ui.AdminWorkspace, { children: 'Facturas' }));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('búsqueda administrativa admite tildes y páginas inválidas sin perder filtros', () => {
  assert.ok(ui.adminMatches('bogota atico', 'Ático', 'Bogotá'));
  assert.equal(ui.adminMatches('ático medellín', 'Ático en Bogotá'), false);
  for (const pagina of ['-2', '1.5', 'NaN', 'Infinity', ['3', '4']]) assert.equal(ui.readAdminQuery({ pagina }).pagina, 1);
  assert.deepEqual(ui.readAdminQuery({ buscar: ['a', 'b'], estado: ['PAID'] }), { buscar: '', estado: '', pagina: 1 });
  const query = { buscar: 'José & Ana', estado: 'PENDING', pagina: 99 };
  const result = ui.paginateAdmin(Array.from({ length: 31 }, (_, i) => i), query.pagina);
  assert.deepEqual(result.items, [30]);
  const next = new URL(ui.adminListHref('/admin/facturas', query, 2), 'http://localhost');
  assert.equal(next.searchParams.get('buscar'), 'José & Ana');
  assert.equal(next.searchParams.get('estado'), 'PENDING');
  assert.equal(next.searchParams.get('pagina'), '2');
  assert.equal(ui.paginateAdmin([], 99).page, 1);
});

test('listas administrativas filtran datos reales de cada respuesta antes de paginar', async () => {
  const user = { id: 'tenant-1', name: 'José García', counts: {}, financial: { state: 'PENDING', outstandingAmount: 1000000 } };
  const file = { id: 'file-1', originalName: 'Ficha Ático.pdf', mimeType: 'application/pdf', size: 1024, publicPath: '/files/file-1', createdAt: '2026-10-01' };
  const message = { id: 'contact-1', name: 'José García', email: 'jose@example.test', subject: 'Visita al ático', message: 'Solicito información.', status: 'NEW', createdAt: '2026-10-01' };
  const cases = [
    ['inmuebles', { buscar: 'bogota', estado: 'PUBLISHED_AVAILABLE' }, { '/admin/properties': [{ ...property, status: 'AVAILABLE' }, { ...property, id: 'hidden', published: false, title: 'Oculto', status: 'AVAILABLE' }], '/admin/tenants': [] }, 'Casa de prueba', 'Oculto'],
    ['usuarios', { buscar: 'José', estado: 'PENDING' }, { '/admin/users?search=Jos%C3%A9': [user, { ...user, id: 'paid', name: 'Usuario pagado', financial: { ...user.financial, state: 'PAID' } }] }, 'José García', 'Usuario pagado'],
    ['facturas', { estado: 'OUTSTANDING' }, { '/admin/invoices': [invoice, { ...invoice, id: 'paid', code: 'FAC-PAGADA', status: 'PAID' }], '/admin/leases': [], '/admin/invoices/catalog': { services: [], products: [] } }, 'FAC-1', 'FAC-PAGADA'],
    ['archivos', { buscar: 'atico' }, { '/admin/files': [file, { ...file, id: 'other', originalName: 'Local.pdf' }] }, 'Ficha Ático.pdf', 'Local.pdf'],
    ['contactos', { estado: 'NEW' }, { '/admin/contacts': [message, { ...message, id: 'closed', status: 'CLOSED', subject: 'Solicitud cerrada' }] }, 'Visita al ático', 'Solicitud cerrada'],
    ['conciliacion', { estado: 'REVIEW_REQUIRED' }, { '/admin/reconciliation/notifications': [{ id: 'notification-1', payerName: 'José García', status: 'REVIEW_REQUIRED', receivedAt: '2026-10-01' }, { id: 'matched', payerName: 'Pagador conciliado', status: 'MATCHED', receivedAt: '2026-10-01' }], '/admin/reconciliation/accounts': [], '/admin/reconciliation/imports': [], '/payments/manual/pending': [] }, 'José García', 'Pagador conciliado'],
  ];
  for (const [route, params, responses, visible, absent] of cases) {
    globalThis.__ui.apiResponses = responses;
    globalThis.__ui.roles = [];
    const view = render(await ui[`Admin_${route}`]({ searchParams: Promise.resolve(params) }));
    assert.deepEqual(globalThis.__ui.roles, ['ADMIN']);
    assert.ok(view.getByText(visible, { exact: true }));
    assert.equal(view.queryByText(absent, { exact: true }), null);
    assert.equal(view.getByRole('search', { name: 'Filtrar registros' }).method, 'get');
    assert.equal(globalThis.__ui.calls.length, 0);
    view.unmount();
  }
});

test('noticias paginan los resultados y distinguen un filtro sin coincidencias', async () => {
  globalThis.__ui.news = Array.from({ length: 17 }, (_, i) => ({ id: `news-${i}`, title: `Noticia ${i}`, createdAt: '2026-10-01', published: true }));
  let view = render(await ui.AdminNewsPage({ searchParams: Promise.resolve({ pagina: '2' }) }));
  assert.ok(view.getByText('Noticia 16', { exact: true }));
  assert.equal(view.queryByText('Noticia 0', { exact: true }), null);
  assert.equal(view.getByRole('link', { name: 'Anterior' }).getAttribute('href'), '/admin/noticias');
  view.unmount();
  view = render(await ui.AdminNewsPage({ searchParams: Promise.resolve({ buscar: 'inexistente', crear: '1' }) }));
  assert.match(view.getByRole('status').textContent, /No encontramos coincidencias/);
  assert.equal(view.container.querySelector('details').open, true);
});

test('dashboard distingue reportes no disponibles de cero y enlaza tareas filtradas', async () => {
  globalThis.__ui.apiResponses = { '/admin/dashboard': { availableProperties: 2, pendingInvoices: 4, newContacts: 3, collectedAmount: 1000000 }, '/payments/manual/pending': new Error('Servicio temporalmente no disponible') };
  const view = render(await ui.AdminDashboardPage());
  assert.match(view.getByText(/No pudimos consultar los reportes/).textContent, /conciliación/);
  assert.equal(view.getByRole('link', { name: /Facturas por cobrar/ }).getAttribute('href'), '/admin/facturas?estado=OUTSTANDING');
  assert.equal(view.getByRole('link', { name: /Contactos nuevos/ }).getAttribute('href'), '/admin/contactos?estado=NEW');
  assert.equal(globalThis.__ui.calls.length, 0);
});

test('el seguimiento de contactos envía el estado elegido y el contacto correcto', async () => {
  const view = component('AdminContactStatusForm', { id: 'contact-1', status: 'NEW' });
  fireEvent.change(view.getByLabelText('Estado del contacto'), { target: { value: 'REVIEWED' } });
  await submit(view, 'Actualizar estado', 'updateContactStatusAction', { id: 'contact-1', status: 'REVIEWED' });
  assert.ok(view.getByRole('status'));
});

test('el administrador usa su propia cabecera y el sitio público conserva la suya', () => {
  globalThis.__ui.pathname = '/admin/inmuebles';
  const view = component('PublicSiteChrome', { children: React.createElement('p', null, 'Navegación pública') });
  assert.equal(view.queryByText('Navegación pública'), null);
  globalThis.__ui.pathname = '/inmuebles';
  view.rerender(React.createElement(ui.PublicSiteChrome, { children: 'Navegación pública' }));
  assert.ok(view.getByText('Navegación pública'));
});

test('el salto al contenido evita el menú y la cabecera del administrador', () => {
  globalThis.__ui.pathname = '/admin/inmuebles';
  const view = render(React.createElement(React.Fragment, null, React.createElement(ui.SkipToContentLink), React.createElement(ui.AdminWorkspace, { children: 'Registros' })));
  const link = view.getByRole('link', { name: 'Saltar al contenido' });
  assert.equal(link.getAttribute('href'), '#contenido-admin');
  assert.equal(view.container.querySelector('#contenido-admin').getAttribute('tabindex'), '-1');
  globalThis.__ui.pathname = '/inmuebles';
  view.rerender(React.createElement(ui.SkipToContentLink));
  assert.equal(view.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href'), '#contenido');
});

test('una tabla desbordada se puede enfocar y deja de ser una parada cuando vuelve a caber', () => {
  const table = React.createElement('table', null, React.createElement('tbody'));
  const view = component('AdminTableRegion', { label: 'Facturas', children: table });
  const region = view.getByRole('region', { name: 'Facturas' });
  Object.defineProperty(region, 'clientWidth', { value: 300 });
  Object.defineProperty(region, 'scrollWidth', { value: 600, configurable: true });
  globalThis.__ui.onResize();
  assert.equal(region.tabIndex, 0);
  region.focus();
  assert.equal(document.activeElement, region);
  Object.defineProperty(region, 'scrollWidth', { value: 300 });
  globalThis.__ui.onResize();
  assert.equal(region.hasAttribute('tabindex'), false);
  view.unmount();
  assert.equal(globalThis.__ui.resizeDisconnected, true);
});

test('el panel exige acceso de administrador y ofrece recuperación de errores', async () => {
  globalThis.__ui.pathname = '/admin';
  const layout = render(await ui.AdminLayout({ children: React.createElement('h1', null, 'Resumen JB') }));
  assert.deepEqual(globalThis.__ui.roles, ['ADMIN']);
  assert.ok(layout.getByRole('button', { name: 'Salir' }));
  assert.ok(layout.getByText('Admin JB'));
  assert.ok(layout.getByRole('heading', { name: 'Resumen JB' }));
  layout.unmount();

  const loading = component('AdminLoading');
  assert.match(loading.getByRole('status').textContent, /Cargando administración/);
  loading.unmount();
  let retried = false;
  const error = component('AdminError', { retry() { retried = true; } });
  assert.match(error.getByRole('alert').textContent, /No pudimos cargar esta sección/);
  fireEvent.click(error.getByRole('button', { name: 'Volver a intentar' }));
  assert.equal(retried, true);
});

test('el perfil administrativo muestra contratos, cartera y pagos de la persona consultada', async () => {
  const user = {
    id: 'profile-1', name: 'Cliente JB', email: 'cliente@example.test', createdAt: '2026-10-01', updatedAt: '2026-10-02',
    user: { email: 'cliente@example.test', role: 'CUSTOMER' },
    aliases: [{ alias: 'Nombre histórico' }],
    financial: { state: 'OVERDUE', invoiceCount: 1, outstandingAmount: 600000, pendingAmount: 0, overdueAmount: 600000, paidAmount: 0, approvedPayments: 400000 },
    leases: [{ id: 'lease-1', property, active: true, startDate: '2026-10-01' }],
    invoices: [{ ...invoice, status: 'OVERDUE', balance: undefined, payments: [{ status: 'APPROVED', amount: 400000 }] }],
    payments: [{ id: 'pay-1', bankReference: 'REF-JB', status: 'APPROVED', createdAt: '2026-10-02', provider: 'manual', amount: 400000, invoice }],
  };
  globalThis.__ui.apiResponses = { '/admin/users/profile-1': user, '/admin/properties': [] };
  const view = render(await ui.AdminUserDetail({ params: Promise.resolve({ id: user.id }) }));
  assert.deepEqual(globalThis.__ui.roles, ['ADMIN']);
  assert.ok(view.getByRole('heading', { name: 'Cliente JB' }));
  assert.ok(view.getByText('Nombre histórico'));
  assert.ok(within(view.getByRole('region', { name: 'Inmuebles asignados' })).getByText('Activo'));
  assert.ok(within(view.getByRole('region', { name: 'Historial de facturación' })).getByText('FAC-1'));
  assert.ok(within(view.getByRole('region', { name: 'Historial de pagos' })).getByText('REF-JB'));
});

test('la acción de contacto rechaza archivos y conserva el seguimiento si falla la API', async () => {
  const data = new FormData();
  data.set('id', new File(['id'], 'id.txt'));
  data.set('status', 'REVIEWED');
  assert.match((await ui.updateContactStatusAction({}, data)).error, /estado válido/);
  assert.deepEqual(globalThis.__ui.requests, []);

  data.set('id', 'contact/1');
  const path = '/admin/contacts/contact%2F1/status';
  globalThis.__ui.apiResponses = { [path]: new Error('No se pudo guardar') };
  assert.equal((await ui.updateContactStatusAction({}, data)).error, 'No se pudo guardar');
  assert.deepEqual(globalThis.__ui.revalidated, []);

  globalThis.__ui.apiResponses[path] = {};
  assert.match((await ui.updateContactStatusAction({}, data)).success, /actualizado/);
  assert.deepEqual(globalThis.__ui.requests.at(-1), [path, { method: 'PATCH', body: '{"status":"REVIEWED"}' }, true]);
  assert.deepEqual(globalThis.__ui.revalidated, ['/admin/contactos', '/admin']);
});

async function serverPage(name, params = {}, searchParams = {}) {
  const tree = React.createElement(ui[name], {params: Promise.resolve(params), searchParams: Promise.resolve(searchParams)});
  const { prelude } = await prerender(tree);
  return new JSDOM(await new Response(prelude).text()).window.document;
}

test('la portada de DEV ofrece búsqueda, portafolio y siete destinos desde el primer HTML', async (t) => {
  const before = process.env.APP_ENV;
  process.env.APP_ENV = 'development';
  t.after(() => { if (before === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = before; });
  const home = {...property, slug:'casa-centro', images:[{id:'sala', url:'/uploads/sala.webp', alt:'Sala con ventana'}]};
  globalThis.__ui.apiResponses = {'/properties':[home], '/properties/featured':[home], '/news/featured':[]};
  const doc = await serverPage('Home', {}, {estilo:'original'});
  assert.deepEqual([...doc.querySelectorAll('[data-portada] section[id]')].map(el => el.id), ['busqueda','portafolio','recorridos']);
  assert.deepEqual([...doc.querySelectorAll('#recorridos a')].map(el => el.getAttribute('href')), ['/inmuebles','/comprar','/vehiculos-y-bienes','/propietarios','/arrendatarios','/clientes','/servicios']);
  assert.ok(doc.querySelector('a[href="/inmuebles/casa-centro"]'));
  assert.equal(doc.querySelector('#busqueda form').getAttribute('action'), '/inmuebles');
  assert.equal(doc.querySelectorAll('h1').length, 1);
});

test('los catálogos filtran por tipo y enlazan la foto y la consulta del bien publicado', async () => {
  const offer = {id:'bien',catalog:'vehiculos-y-bienes', category:'Estufa',title:'Estufa sintética',price:'200000',city:'Bogotá',description:'Descripción de prueba.',images:['/uploads/foto.webp']};
  globalThis.__ui.apiResponses = {'/sales/market?q=Estufa&city=Cali':[offer], '/sales/vehiculos-y-bienes?category=Estufa':[], '/sales/vehiculos-y-bienes/bien':offer};
  const sales = await serverPage('Sales',{catalogo:'comprar'},{q:' Estufa ',city:'Cali'});
  assert.ok(sales.querySelector('a[href="/vehiculos-y-bienes/bien"] img'));
  assert.ok(sales.querySelector('a[href="/propietarios"]'));
  const goods = await serverPage('Sales',{catalogo:'vehiculos-y-bienes'},{category:'Estufa',city:'Bogotá'});
  assert.equal(goods.querySelector('[name=city]'), null);
  assert.match(goods.body.textContent, /No hay ofertas/);
  const detail = await serverPage('SaleDetail',{catalogo:'vehiculos-y-bienes',id:'bien'});
  assert.equal(detail.querySelector('h1').textContent, offer.title);
  assert.equal(detail.querySelector('[name=subject]').value, 'Consulta: '+offer.title);
});

test('administración y cada portal muestran los documentos y las herramientas de su cuenta', async () => {
  const account={id:'client',name:'Cliente de prueba',email:'cliente@example.test',portal:'SERVICES',role:'USER'};
  const file={id:'pdf',originalName:'Contrato.pdf',size:750,createdAt:'2026-10-15T12:00:00Z'};
  globalThis.__ui.apiResponses={'/admin/documents/accounts':[account],'/admin/documents/accounts/client':[file],'/documents/mine':[file],'/documents/templates':[{key:'solicitud', file}],'/admin/suggestions':[], '/owner/listings':[], '/admin/sales':[]};
  const assigned = await serverPage('AccountDocuments',{}, {cliente:'client'});
  assert.ok(assigned.querySelector('[name=serviceType]'));
  assert.ok(assigned.querySelector('a[href*="/documentos/privados/pdf"]'));
  assert.ok((await serverPage('Documents')).querySelector('a[href*="/documentos/privados/pdf"]'));
  const request = await serverPage('RentalRequest');
  assert.ok(request.querySelector('a[href*="/documentos/publicos/pdf"]'));
  assert.match(request.body.textContent,/pendiente de publicación/);
  assert.equal((await serverPage('Templates')).querySelectorAll('input[type=file]').length,2);
  assert.match((await serverPage('Suggestions')).body.textContent,/Todavía no hay sugerencias/);
  const content=await serverPage('Content',{}, {seccion:'portada'});
  assert.ok(content.querySelector('[name=portfolioTitle]'));
  assert.ok((await serverPage('Offers',{}, {nueva:'1'})).querySelector('[name=photos]'));
  const services=await serverPage('CustomerServices');
  assert.ok(services.querySelector('article a[href*="contacto"]'));
  globalThis.__ui.user={...account,portal:'OWNER'};
  assert.ok((await serverPage('OwnerPublications',{}, {nuevo:'1'})).querySelector('[name=bedrooms]'));
  assert.ok(globalThis.__ui.roles.includes('ADMIN') && globalThis.__ui.roles.includes('USER'));
});

test('publicar una oferta y una sección conserva las revisiones y exige administración', async () => {
  globalThis.__ui.apiResponses={'/admin/sales/item':{id:'item',revision:3}, '/admin/publishing/sections/portada':{revision:4}, '/admin/publishing/images':['/uploads/foto.webp']};
  const data = new FormData();
  for (const [key,value] of Object.entries({title:' Una casa ',id:'item',catalog:'comprar',revision:'2',published:'on',keep:'/uploads/original.jpg'})) data.set(key,value);
  data.set('photos',new File(['foto'],'fotografia.webp'));
  data.set('promotion','premium');
  data.set('estimatedMonthlyRent','1800000');
  assert.equal((await ui.saveOffer({},data)).success,'Oferta publicada.');
  const sent=JSON.parse(globalThis.__ui.requests.at(-1)[1].body);
  assert.deepEqual(sent.images,['/uploads/original.jpg','/uploads/foto.webp']);
  assert.equal(sent.title,'Una casa');
  assert.equal(sent.revision,2);
  assert.equal(sent.promotion,'premium');
  assert.equal(sent.estimatedMonthlyRent,'1800000');
  data.set('promotion','');
  data.set('estimatedMonthlyRent','');
  assert.equal((await ui.saveOffer({},data)).success,'Oferta publicada.');
  const cleared=JSON.parse(globalThis.__ui.requests.at(-1)[1].body);
  assert.equal(cleared.promotion,null);
  assert.equal(cleared.estimatedMonthlyRent,null);
  data.set('portfolioTitle','Inventario');
  assert.equal((await ui.saveSection('portada',{},data)).values.portfolioTitle,'Inventario');
  assert.ok(globalThis.__ui.revalidated.includes('site-content'));
  assert.match((await ui.saveSection('desconocida',{},data)).error,/desconocida/);
  assert.ok(globalThis.__ui.roles.every(role => role==='ADMIN'));
});
