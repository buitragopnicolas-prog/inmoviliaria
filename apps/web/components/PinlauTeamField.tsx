'use client';

import { useRef, useState } from 'react';
import { maxTeamSize, readTeam } from '../../../shared/pinlau-team.mjs';
import { EditorialImageField } from './EditorialImageField';

export function PinlauTeamField({value, disabled}: Readonly<{value: string; disabled: boolean}>) {
  const [rows, setRows] = useState(() => (readTeam(value) ?? []).map((person, index) => ({...person, id: index})));
  const nextId = useRef(rows.length);
  const add = useRef<HTMLButtonElement>(null);
  function addMember() {
    const id = nextId.current++;
    setRows(current => [...current, {name: '', role: '', photo: '', id}]);
    requestAnimationFrame(() => document.getElementById('pinlau-name-' + id)?.focus());
  }
  function removeMember(id: number) {
    const next = rows[rows.findIndex(row => row.id === id) + 1];
    setRows(current => current.filter(row => row.id !== id));
    requestAnimationFrame(() => (document.getElementById('pinlau-name-' + next?.id) ?? add.current)?.focus());
  }
  return <fieldset disabled={disabled}><legend>Perfiles del equipo</legend>
    <p>Publica el nombre, el cargo y la fotografía de cada fundador o socio. Los cambios se aplican al guardar.</p>
    {rows.map(({id, name, role, photo}, index) => <fieldset key={id}><legend>Perfil {index + 1}</legend>
      <input type="hidden" name="member" value={id}/>
      <label>Nombre completo<input id={'pinlau-name-' + id} name={'name-' + id} defaultValue={name} required maxLength={100}/></label>
      <label>Cargo o vínculo<input name={'role-' + id} defaultValue={role} placeholder="Ej. Socia fundadora" required maxLength={100}/></label>
      <label>Fotografía<EditorialImageField name={'portrait-' + id} value={photo} label={'Fotografía de ' + name} required={!photo}/></label>
      <button type="button" className="button outline small" onClick={() => removeMember(id)}>Quitar perfil {index + 1}</button>
    </fieldset>)}
    <button type="button" ref={add} className="button outline" disabled={rows.length >= maxTeamSize} onClick={addMember}>Añadir perfil</button>
  </fieldset>;
}
