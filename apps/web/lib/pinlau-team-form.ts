import { isTeamPhoto, maxTeamSize, validMemberInfo } from '../../../shared/pinlau-team.mjs';
import { textField } from './form-text';

export async function teamFromForm(form: FormData, upload: (files: File[]) => Promise<string[]>) {
  const ids = form.getAll('member').map(String);
  if (ids.length > maxTeamSize || new Set(ids).size !== ids.length || ids.some(id => !/^\d+$/.test(id))) {
    throw new Error('Revisa la lista de perfiles del equipo.');
  }
  const rows = ids.map(id => {
    const photo = form.get('photo-portrait-' + id);
    const file = photo instanceof File && photo.size > 0 ? photo : undefined;
    if (file && file.size > 5000000) throw new Error('Cada fotografía admite hasta 5 MB.');
    const name = textField(form, 'name-' + id).trim();
    const role = textField(form, 'role-' + id).trim();
    const savedPhoto = textField(form, 'portrait-' + id);
    if (!validMemberInfo(name, role) || (!file && !isTeamPhoto(savedPhoto))) {
      throw new Error('Completa el nombre, cargo y fotografía de cada perfil.');
    }
    return {name, role, photo: savedPhoto, file};
  });
  const replacements = rows.filter(row => row.file !== undefined);
  for (let start = 0; start < replacements.length; start += 10) {
    const batch = replacements.slice(start, start + 10);
    const paths = await upload(batch.map(row => row.file!));
    batch.forEach((row, index) => {
      row.photo = '/fotos' + paths[index];
      if (!isTeamPhoto(row.photo)) throw new Error('No se pudo guardar la fotografía. Vuelve a intentarlo.');
    });
  }
  return JSON.stringify(rows.map(({name, role, photo}) => ({name, role, photo})));
}
