import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultCopy, resolveCopy } from './site-content';
import { pinlauDirectory, pinlauSubject } from './pinlau';
import { teamFromForm } from './pinlau-team-form';
import { readTeam } from '../../../shared/pinlau-team.mjs';

test('PINLAW actualiza los antiguos textos predeterminados y conserva el contenido editorial', () => {
  const copy = resolveCopy([{id:'pinlau',revision:2,values:{title:'Pinlau Asesoría Jurídica',general:'Hablemos con la firma',people:'[]'}},
    {id:'identidad',revision:3,values:{navPinlau:'Pinlau'}}]);
  assert.equal(copy.identidad.navPinlau,'PINLAW');
  assert.equal(copy.pinlau.title,'PINLAW Asesoría Jurídica');
  assert.equal(copy.pinlau.general,'Hablemos con la firma');
});

test('cada servicio publicado llega al asunto correcto incluso tras cambiar el título', () => {
  const copy = structuredClone(defaultCopy);
  copy.pinlauCivil.restitucion = 'Recuperación por arrendamiento';
  const services = pinlauDirectory(copy).flatMap(group => group.services);
  assert.equal(services.length, 23);
  assert.equal(new Set(services.map(item => item.key)).size, 23);
  for (const service of services) {
    assert.ok(service.description.length > 60);
    assert.equal(pinlauSubject(copy, service.key), 'PINLAW · ' + service.title);
  }
  assert.equal(pinlauSubject(copy, 'general'), copy.pinlau.title);
  for (const invalid of [undefined, ['redam'], '__proto__', 'desconocido']) assert.equal(pinlauSubject(copy, invalid), '');
});

test('publicar, conservar y retirar retratos valida el perfil completo', async () => {
  const form = new FormData();
  const unexpected = async () => { throw Error('Carga inesperada'); };
  assert.deepEqual(readTeam(await teamFromForm(form, unexpected)), []);
  form.append('member', '2');
  form.set('name-2', 'Persona de prueba');
  form.set('role-2', 'Socia');
  await assert.rejects(teamFromForm(form, unexpected), /nombre, cargo y fotografía/);
  form.set('portrait-2', '/images/jb-alianzas.webp');
  assert.equal(readTeam(await teamFromForm(form, unexpected))?.[0].role, 'Socia');
  form.set('photo-portrait-2', new File(['imagen'], 'retrato.webp'));
  await assert.rejects(teamFromForm(form, async () => []), /fotografía/);
  const result = await teamFromForm(form, async files => {
    assert.equal(files[0].name, 'retrato.webp');
    return ['/api/files/test-image/content'];
  });
  assert.equal(readTeam(result)?.[0].photo, '/fotos/api/files/test-image/content');
  form.append('member', '2');
  await assert.rejects(teamFromForm(form, unexpected), /lista de perfiles/);
  for (const raw of ['{', '{}', '[null]', JSON.stringify([{name:'X',role:'Socio',photo:'https://example.org/x.jpg'}])]) {
    assert.equal(readTeam(raw), null);
  }
});
