import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { locationFields } from './property-location.js';

test('los cambios antiguos conservan el pin y el retiro explícito limpia ambas coordenadas', () => {
  assert.deepEqual(locationFields({}), {});
  assert.deepEqual(locationFields({latitude:'', longitude:''}), {latitude:null, longitude:null});
  assert.deepEqual(locationFields({latitude:null, longitude:null}), {latitude:null, longitude:null});
});

test('el pin conserva cero y admite coordenadas decimales en la región insular', () => {
  assert.deepEqual(locationFields({latitude:0, longitude:'-75.15'}), {latitude:0, longitude:-75.15});
  assert.deepEqual(locationFields({latitude:'12.58472', longitude:'-81.70056'}), {latitude:12.58472, longitude:-81.70056});
});

test('un pin parcial, no numérico o fuera de rango se rechaza antes de escribir', () => {
  for (const input of [
    {longitude:'-75'}, {latitude:''}, {latitude:null, longitude:2}, {latitude:'1', longitude:''},
    {latitude:' ',longitude:1}, {latitude:91,longitude:0}, {latitude:0,longitude:-181},
    {latitude:Number.NaN,longitude:0}, {latitude:[],longitude:0}, {latitude:0,longitude:Infinity},
  ]) assert.throws(() => locationFields(input), BadRequestException);
});
