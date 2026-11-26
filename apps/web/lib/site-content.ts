import schema from '../../../shared/site-fields.json';

export const sections = schema;
export type SectionId = keyof typeof schema;
export type SiteCopy = { [S in SectionId]: { [K in keyof typeof schema[S]['fields']]: string } };
export type SiteSection = { id: SectionId; revision: number; values: Record<string,string> };

// Published sections keep their original storage keys and editorial revisions.
const oldBrandDefaults: Record<string, string> = {
  'identidad.navPinlau': 'Pinlau',
  'pinlau.title': 'Pinlau Asesoría Jurídica',
  'pinlau.general': 'Contactar con Pinlau',
};

export function resolveCopy(rows: SiteSection[] = []): SiteCopy {
  return Object.fromEntries(Object.entries(schema).map(([id, section]) => {
    const record = rows.find(row => row.id === id);
    return [id, Object.fromEntries(Object.entries(section.fields).map(([key, field]) => {
      const saved = record?.values[key];
      if (saved === undefined || oldBrandDefaults[id + '.' + key] === saved) return [key, field.value];
      return [key, field.kind === 'image' ? saved.trim() || field.value : saved];
    }))];
  })) as SiteCopy;
}
export const defaultCopy = resolveCopy();
