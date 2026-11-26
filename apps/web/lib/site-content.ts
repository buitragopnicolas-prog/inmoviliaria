import schema from '../../../shared/site-fields.json';

export const sections = schema;
export type SectionId = keyof typeof schema;
export type SiteCopy = { [S in SectionId]: { [K in keyof typeof schema[S]['fields']]: string } };
export type SiteSection = { id: SectionId; revision: number; values: Record<string,string> };

export function resolveCopy(rows: SiteSection[] = []): SiteCopy {
  return Object.fromEntries(Object.entries(schema).map(([id, section]) => {
    const record = rows.find(row => row.id === id);
    return [id, Object.fromEntries(Object.entries(section.fields).map(([key, field]) =>
      [key, (field.kind === 'image' ? record?.values[key]?.trim() || field.value : record?.values[key] ?? field.value)]))];
  })) as SiteCopy;
}
export const defaultCopy = resolveCopy();
