import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'FormData', 'File', 'Event', 'MouseEvent', 'KeyboardEvent']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, cleanup, waitFor, within, act } = await import('@testing-library/react');

// Keep real React state, DOM and application components; isolate only Next's
// routing/server boundary so tests cannot submit to a database or live API.
const actionSource = await readFile('apps/web/app/actions.ts', 'utf8');
const actionNames = [...actionSource.matchAll(/export async function (\w+)/g)].map((match) => match[1]);
const stubs = {
  ai: 'export async function runAiTool(...args) { globalThis.__ui.aiCalls.push(args); return globalThis.__ui.aiRun(...args); }',
  actions: actionNames.map((name) => `export async function ${name}(...args) { globalThis.__ui.calls.push({ name: '${name}', data: args.at(-1) }); return globalThis.__ui.result; }`).join('\n'),
  api: 'export async function apiFetch(path) { return path.startsWith("/invoices") ? globalThis.__ui.invoice : path.includes("manual/config") ? globalThis.__ui.config : globalThis.__ui.news; }',
  auth: 'export async function requireUser(role) { globalThis.__ui.roles.push(role); }',
  navigation: 'export function usePathname() { return globalThis.__ui.pathname; }',
  link: 'import React from "react"; export default function Link({ children, onClick, ...props }) { return React.createElement("a", { ...props, onClick: event => { onClick?.(event); event.preventDefault(); } }, children); }',
  image: 'import React from "react"; export default function Image({ fill, priority, ...props }) { return React.createElement("img", props); }',
};
const names = ['AiTools', 'PropertyCard', 'PublicNavigation', 'ActiveLink', 'AuthForm', 'ContactForm', 'AdminNewsForm', 'AdminUserForm', 'AdminFileUploadForm', 'AdminPropertyForm', 'AdminPropertyEditForm', 'AdminAssignPropertyForm', 'AdminDeletePropertyButton', 'AdminInvoiceForm', 'AdminInvoiceManager', 'AdminLeaseContractForm', 'ManualPaymentForm', 'ManualPaymentReviewForm'];
const entry = names.map((name) => `export { ${name} } from './apps/web/components/${name}.tsx';`).join('\n') +
  "\nexport { HomeHero } from './apps/web/components/home/HomeSections.tsx';\nexport { default as PayInvoicePage } from './apps/web/app/mi-cuenta/facturas/[id]/pagar/page.tsx';\nexport { default as AdminNewsPage } from './apps/web/app/admin/noticias/page.tsx';";
await mkdir('.local', { recursive: true });
const bundle = resolve('.local/ui-test-bundle.mjs');
await build({
  stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'ui-test-entry.mjs' },
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  tsconfig: 'apps/web/tsconfig.json', sourcemap: 'inline', sourcesContent: true,
  plugins: [{ name: 'server-boundary', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/run-ai-tool$/ }, () => ({ path: 'ai', namespace: 'ui-stub' }));
    builder.onResolve({ filter: /^(@\/app\/actions|@\/lib\/api|@\/lib\/auth|next\/(link|navigation|image))$/ }, ({ path }) => {
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
function reset() { globalThis.__ui = { calls: [], roles: [], result: { success: 'Solicitud recibida' }, pathname: '/', invoice: structuredClone(invoice), config: structuredClone(config), news: [{ id: 'news-1', title: 'Noticia de prueba', createdAt: '2026-10-01', published: true }] }; }
reset();
afterEach(() => { cleanup(); reset(); });
function component(name, props = {}) { return render(React.createElement(ui[name], props)); }

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
  assert.equal(view.getByRole('button', { name: 'Procesando…' }).disabled, true);
  assert.match(view.getByRole('status').textContent, /50/);
  assert.equal(view.getByRole('button', { name: /Traducir texto/ }).disabled, true);
  await act(async () => { finish({ text: '🏡' }); });
  await waitFor(() => assert.equal(view.getByLabelText('Texto del resultado').value, '🏡'));
  globalThis.__ui.aiRun = async () => { throw new Error('Modelo sin conexión'); };
  fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
  await waitFor(() => assert.match(view.getByRole('alert').textContent, /No se pudo completar/));
  assert.equal(view.getByRole('button', { name: 'Procesar', exact: true }).disabled, false);
});

test('las narraciones conservan su texto accesible y liberan audio y subtítulos', async () => {
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const blobs = [];
  const revoked = [];
  URL.createObjectURL = blob => { blobs.push(blob); return `blob:jb-${blobs.length}`; };
  URL.revokeObjectURL = value => revoked.push(value);
  globalThis.__ui.aiCalls = [];
  globalThis.__ui.aiRun = async () => ({ blob: new Blob(['synthetic-audio']), media: 'audio', text: 'Casa <amplia> & luminosa' });
  try {
    const view = component('AiTools');
    fireEvent.click(view.getByRole('button', { name: /Leer en voz alta/ }));
    fireEvent.change(view.getByRole('textbox', { name: /^Texto/ }), { target: { value: 'Casa <amplia> & luminosa' } });
    fireEvent.click(view.getByRole('button', { name: 'Procesar', exact: true }));
    await waitFor(() => assert.ok(view.getByLabelText('Escuchar narración generada')));
    const track = view.container.querySelector('track');
    assert.equal(track.getAttribute('src'), 'blob:jb-2');
    assert.equal(track.getAttribute('srclang'), 'es');
    assert.match(await blobs[1].text(), /WEBVTT[\s\S]*Casa &lt;amplia&gt; &amp; luminosa/);
    assert.equal(view.getByLabelText('Texto del resultado').value, 'Casa <amplia> & luminosa');
    view.unmount();
    assert.deepEqual(revoked, ['blob:jb-1', 'blob:jb-2']);
  } finally { cleanup(); URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

test('el buscador del inicio envía filtros compatibles con el catálogo sin acciones de escritura', () => {
  const view = component('HomeHero');
  const form = view.getByRole('form', { name: 'Buscar inmuebles en arriendo' });
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
    assert.equal(links.length, role ? 7 : 6);
    assert.equal(within(mobile).getByRole('link', { name: 'Herramientas IA' }).getAttribute('href'), '/herramientas-ia');
    fireEvent.keyDown(links[0], { key: 'Tab' });
    assert.equal(mobile.hidden, false);
    fireEvent.keyDown(links[0], { key: 'Escape' });
    assert.equal(mobile.hidden, true);
    assert.equal(document.activeElement, toggle);
    fireEvent.click(toggle);
    fireEvent.click(within(mobile).getByRole('link', { name: 'Inmuebles' }));
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

test('formularios administrativos envían la acción correspondiente', async () => {
  const cases = [
    ['AdminNewsForm', {}, 'Publicar noticia', 'createNewsAction'],
    ['AdminUserForm', {}, 'Crear usuario', 'createAdminUserAction'],
    ['AdminFileUploadForm', {}, 'Cargar archivos', 'uploadFilesAction'],
    ['AdminPropertyForm', { tenants: [] }, 'Publicar inmueble', 'createPropertyAction'],
    ['AdminPropertyEditForm', { property, tenants: [] }, 'Guardar cambios', 'updatePropertyAction'],
    ['AdminInvoiceForm', { leases: [], services: [], products: [] }, 'Crear factura', 'createInvoiceAction'],
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
  fireEvent.click(view.getByRole('button', { name: 'Editar' }));
  await submit(view, 'Guardar cambios', 'updateInvoiceAction', { id: invoice.id });
  window.confirm = () => true;
  await submit(view, 'Eliminar factura', 'deleteInvoiceAction', { id: invoice.id });
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
    const view = component('ManualPaymentReviewForm', { paymentId: 'payment-1' });
    await submit(view, button, 'reviewManualPaymentAction', { paymentId: 'payment-1', decision });
    view.unmount();
  }
});

test('reportar un pago envía factura, importe y referencia y evita un segundo envío', async () => {
  const view = component('ManualPaymentForm', { invoiceId: invoice.id, amount: invoice.balance, idempotencyKey: 'request-1', config });
  fireEvent.change(view.getByLabelText('Referencia bancaria'), { target: { value: 'BANK-123' } });
  await submit(view, 'Ya realicé el pago', 'reportManualPaymentAction', { invoiceId: invoice.id, amount: '1000000', bankReference: 'BANK-123' });
  assert.equal(view.getByRole('button', { name: 'Ya realicé el pago' }).disabled, true);
});

test('página de pago permite checkout y confirmación mock sólo en su modo correspondiente', async () => {
  for (const [reference, mode, button, action] of [[undefined, 'gateway', 'Continuar al pago', 'beginPaymentAction'], ['MOCK-1', 'mock', 'Simular pago aprobado', 'approveMockAction']]) {
    globalThis.__ui.config.mode = mode;
    const view = render(await ui.PayInvoicePage({ params: Promise.resolve({ id: invoice.id }), searchParams: Promise.resolve({ reference }) }));
    assert.deepEqual(globalThis.__ui.roles, ['USER']);
    await submit(view, button, action);
    view.unmount();
    globalThis.__ui.roles = [];
  }
});

test('noticias administrativas archivan el registro seleccionado', async () => {
  const view = render(await ui.AdminNewsPage());
  assert.deepEqual(globalThis.__ui.roles, ['ADMIN']);
  await submit(view, 'Ocultar', 'archiveNewsAction', { id: 'news-1' });
});
