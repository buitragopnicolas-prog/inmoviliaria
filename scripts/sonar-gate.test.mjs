import test from 'node:test';
import assert from 'node:assert/strict';
import { sonarConfig, verifySonarGate } from './sonar-gate.mjs';

const sha = 'a'.repeat(40);
const env = { SONAR_HOST_URL: 'https://sonar.example.test', SONAR_PROJECT_KEY: 'inmobiliaria', SONAR_TOKEN: 'test-only-token' };
const config = sonarConfig(env);
const approved = { projectStatus: { status: 'OK', ignoredConditions: false } };

function responses(...values) {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    assert.ok(values.length, 'Unexpected Sonar API request');
    const value = values.shift();
    return { ok: true, json: async () => value };
  };
  return { calls, request };
}

test('bloquea si falta cualquiera de las variables obligatorias', () => {
  for (const name of Object.keys(env)) {
    assert.throws(() => sonarConfig({ ...env, [name]: '' }), new RegExp(name));
  }
});

test('protege el token con HTTPS y permite Sonar local en loopback', () => {
  for (const host of ['http://sonar.example.test', 'ftp://sonar.example.test', 'https://user:pass@sonar.example.test', 'https://sonar.example.test?token=x']) {
    assert.throws(() => sonarConfig({ ...env, SONAR_HOST_URL: host }));
  }
  assert.equal(sonarConfig({ ...env, SONAR_HOST_URL: 'http://localhost:9000/' }).host, 'http://localhost:9000');
});

test('SonarCloud exige organización y las claves no permiten argumentos adicionales', () => {
  assert.throws(() => sonarConfig({ ...env, SONAR_HOST_URL: 'https://sonarcloud.io' }), /ORGANIZATION/);
  assert.throws(() => sonarConfig({ ...env, SONAR_PROJECT_KEY: 'project -Dsonar.qualitygate.wait=false' }));
});

test('consulta la aprobación del análisis correspondiente al SHA y no la de otro commit', async () => {
  const mock = responses({ analyses: [{ revision: 'b'.repeat(40), key: 'other' }, { revision: sha, key: 'exact' }] }, approved);
  assert.equal(await verifySonarGate(sha, config, mock.request), 'exact');
  assert.equal(mock.calls[0].url.searchParams.get('project'), config.project);
  assert.equal(mock.calls[1].url.searchParams.get('analysisId'), 'exact');
  assert.equal(mock.calls[1].options.redirect, 'error');
  assert.equal(mock.calls[1].options.headers.Authorization, `Bearer ${config.token}`);
});

test('un SHA inexistente o incompleto nunca permite desplegar', async () => {
  await assert.rejects(verifySonarGate('latest', config), /SHA/);
  await assert.rejects(verifySonarGate(sha, config, responses({ analyses: [{ revision: 'b'.repeat(40), key: 'other' }] }).request), /No existe/);
});

test('rechaza errores, condiciones ignoradas, estados pendientes y respuestas incompletas', async () => {
  for (const projectStatus of [{ status: 'ERROR', ignoredConditions: false }, { status: 'NONE' }, { status: 'WARN' }, { status: 'OK', ignoredConditions: true }, { status: 'OK' }, undefined]) {
    const mock = responses({ analyses: [{ revision: sha, key: 'exact' }] }, { projectStatus });
    await assert.rejects(verifySonarGate(sha, config, mock.request), /Sonar no aprobó/);
  }
});

test('un reanálisis fallido del mismo SHA invalida la aprobación anterior', async () => {
  const mock = responses({ analyses: [{ revision: sha, key: 'new' }, { revision: sha, key: 'old' }] }, { projectStatus: { status: 'ERROR', ignoredConditions: false } });
  await assert.rejects(verifySonarGate(sha, config, mock.request), /Sonar no aprobó/);
  assert.equal(mock.calls[1].url.searchParams.get('analysisId'), 'new');
});

test('falla ante HTTP no autorizado, Sonar caído, timeout o JSON inválido', async () => {
  for (const request of [async () => ({ ok: false, status: 401 }), async () => { throw new Error('offline'); }, async () => { throw new DOMException('timeout', 'TimeoutError'); }, async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } }), responses({}).request]) {
    await assert.rejects(verifySonarGate(sha, config, request));
  }
});

test('busca commits anteriores con paginación, manteniendo un límite cerrado', async () => {
  const page = { analyses: Array.from({ length: 100 }, () => ({ revision: 'b'.repeat(40), key: 'other' })) };
  const mock = responses(page, { analyses: [{ revision: sha, key: 'exact' }] }, approved);
  await verifySonarGate(sha, config, mock.request);
  assert.equal(mock.calls[1].url.searchParams.get('p'), '2');
  const bounded = responses(...Array.from({ length: 10 }, () => page));
  await assert.rejects(verifySonarGate(sha, config, bounded.request), /No existe/);
  assert.equal(bounded.calls.length, 10);
});
