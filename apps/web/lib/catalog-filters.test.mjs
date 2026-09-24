import assert from 'node:assert/strict';
import test from 'node:test';
import { readCatalogFilters } from './catalog-filters.ts';

test('optional filters and valid numeric values remain usable', () => {
  assert.equal(readCatalogFilters({}).invalid, false);
  assert.equal(readCatalogFilters({ maxRent: '' }).query, '');
  for (const maxRent of ['1', '2500000', '1000.5', '2.5e6']) {
    const result = readCatalogFilters({ search: 'Chicó', city: 'Bogotá', maxRent });
    assert.equal(result.invalid, false);
    const query = new URLSearchParams(result.query);
    assert.equal(query.get('search'), 'Chicó');
    assert.equal(query.get('city'), 'Bogotá');
    assert.equal(query.get('maxRent'), maxRent);
  }
});

test('invalid rent prevents the catalog query and preserves the supplied values', () => {
  for (const maxRent of ['0', '-1', '0.5', 'abc', 'Infinity', 'NaN', '1e999', '0x10']) {
    const result = readCatalogFilters({ search: 'Chicó', city: 'Bogotá', maxRent });
    assert.equal(result.invalid, true, maxRent);
    assert.ok(result.errors.maxRent);
    assert.deepEqual(result.values, { search: 'Chicó', city: 'Bogotá', maxRent });
    assert.equal(new URLSearchParams(result.query).has('maxRent'), false);
  }
});

test('duplicate query parameters need correction rather than silently changing the search', () => {
  for (const name of ['search', 'city', 'maxRent']) {
    const result = readCatalogFilters({ [name]: ['100', '200'] });
    assert.equal(result.invalid, true);
    assert.ok(result.errors[name]);
    assert.equal(result.values[name], '100');
  }
});
