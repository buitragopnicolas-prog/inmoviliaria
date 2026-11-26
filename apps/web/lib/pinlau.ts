import type { SiteCopy } from './site-content';

const areas = ['pinlauEmpresa', 'pinlauCivil', 'pinlauFamilia', 'pinlauMovilidad', 'pinlauPublico', 'pinlauTecnologia'] as const;

export function pinlauDirectory(copy: SiteCopy) {
  return areas.map(id => {
    const fields: Record<string, string> = copy[id];
    const services = Object.keys(fields).filter(key => Object.hasOwn(fields, key + 'Text'))
      .map(key => ({key, title: fields[key], description: fields[key + 'Text']}));
    return {id, heading: fields.heading, services};
  });
}

export function pinlauSubject(copy: SiteCopy, selection?: string | string[]) {
  if (selection === 'general') return copy.pinlau.title.slice(0, 160);
  if (typeof selection !== 'string') return '';
  const service = pinlauDirectory(copy).flatMap(area => area.services).find(item => item.key === selection);
  return service ? 'PINLAW · ' + service.title : '';
}
