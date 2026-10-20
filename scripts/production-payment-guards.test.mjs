import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const environment = {
  CI: 'true', APP_ENV: 'development', PAYMENT_MODE: 'manual', PAYMENT_GATEWAY: 'none',
  ANTIMALWARE_ENABLED: 'true', PUBLIC_REGISTRATION_ENABLED: 'false',
  E2E_WEB_URL: 'http://127.0.0.1:3000', E2E_BASE_URL: 'http://127.0.0.1:4000/api',
  DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:5432/inmobiliaria_ci',
};
const cases = [
  ['CI disabled', { CI: 'false' }, ['--ci'], /'false' !== 'true'/],
  ['CI pointing to production API', { E2E_BASE_URL: 'https://asesoriainmobiliariajb.com/api' }, ['--ci'], /CI solo admite loopback/],
  ['CI pointing to production web', { E2E_WEB_URL: 'https://asesoriainmobiliariajb.com' }, ['--ci'], /CI solo admite loopback/],
  ['CI pointing to another DB', { DATABASE_URL: 'postgresql://ci:ci@127.0.0.1:5432/production' }, ['--ci'], /inmobiliaria_ci/],
  ['CI pointing to a remote DB', { DATABASE_URL: 'postgresql://ci:ci@db.example.test:5432/inmobiliaria_ci' }, ['--ci'], /CI solo admite loopback/],
  ['CI running with production config', { APP_ENV: 'production' }, ['--ci'], /development/],
  ['production failure injection', {}, ['--ci-fail-after-report'], /solo está disponible en CI aislado/],
  ['production without approved SHA', { APP_ENV: 'production', WEB_ORIGIN: 'https://asesoriainmobiliariajb.com' }, [], /a-f0-9/],
  ['production with another origin', { APP_ENV: 'production', WEB_ORIGIN: 'https://example.test' }, [], /asesoriainmobiliariajb.com/],
  ['disabled antivirus', { ANTIMALWARE_ENABLED: 'false' }, ['--ci'], /'false' !== 'true'/],
  ['public registration enabled', { PUBLIC_REGISTRATION_ENABLED: 'true' }, ['--ci'], /'true' !== 'false'/],
  ['mock payments', { PAYMENT_MODE: 'mock' }, ['--ci'], /manual/],
  ['gateway payments', { PAYMENT_GATEWAY: 'wompi' }, ['--ci'], /none/],
  ['unscoped recovery ID', {}, ['--ci', '--cleanup', 'real-invoice'], /E2E-CI/],
];
for (const [name, overrides, args, message] of cases) {
  test(`production payment guard rejects ${name} before connecting to a database`, () => {
    const result = spawnSync(process.execPath, ['scripts/e2e-manual-payments-production.mjs', ...args], {
      env: { ...environment, ...overrides }, encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(result.stdout, '');
  });
}

for (const [stage, command] of [
  ['prod', 'a'.repeat(40)],
  ['prod', `${'a'.repeat(40)} production-e2e`],
  ['prod', `${'a'.repeat(40)} production-backup-e2e extra`],
  ['prod', `${'a'.repeat(40)} production-e2e extra`],
  ['dev', `${'a'.repeat(40)} production-e2e`],
]) {
  test(`restricted SSH rejects ${stage} command without the required exact protocol`, { skip: process.platform === 'win32' }, () => {
    const result = spawnSync('/bin/bash', ['scripts/vps-ssh-entry.sh', stage], { env: { SSH_ORIGINAL_COMMAND: command }, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2);
  });
}
