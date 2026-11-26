export const maxTeamSize = 24;

export function validMemberInfo(name, role) {
  return [name, role].every(text => typeof text === 'string' && text.trim().length > 0 && text.length <= 100);
}

export function isTeamPhoto(path) {
  return typeof path === 'string' && /^\/(?:images\/[\w-]+\.(?:webp|png|jpe?g)|fotos\/api\/files\/[\w-]+\/content)$/i.test(path);
}

export function readTeam(value) {
  if (typeof value !== 'string' || value.length > 16000) return null;
  let people;
  try { people = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(people) || people.length > maxTeamSize) return null;
  if (!people.every(person => person && validMemberInfo(person.name, person.role) && isTeamPhoto(person.photo))) return null;
  return people.map(({name, role, photo}) => ({name: name.trim(), role: role.trim(), photo}));
}
