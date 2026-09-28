import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicRegistrationEnabled } from './auth-policy.js';

test('el registro público sólo puede habilitarse en local', () => {
  assert.equal(isPublicRegistrationEnabled({ APP_ENV: 'local', PUBLIC_REGISTRATION_ENABLED: 'true' }), true);
  assert.equal(isPublicRegistrationEnabled({ APP_ENV: 'local', PUBLIC_REGISTRATION_ENABLED: 'false' }), false);
  assert.equal(isPublicRegistrationEnabled({ APP_ENV: 'development', PUBLIC_REGISTRATION_ENABLED: 'true' }), false);
  assert.equal(isPublicRegistrationEnabled({ APP_ENV: 'production', PUBLIC_REGISTRATION_ENABLED: 'true' }), false);
});
