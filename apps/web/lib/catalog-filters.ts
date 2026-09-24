type FilterName = 'search' | 'city' | 'maxRent';

export type CatalogSearchParams = Partial<Record<FilterName, string | string[]>>;

export function readCatalogFilters(searchParams: CatalogSearchParams) {
  const values = { search: '', city: '', maxRent: '' };
  const errors: Partial<Record<FilterName, string>> = {};
  const labels = { search: 'barrio o inmueble', city: 'ciudad', maxRent: 'canon máximo' };
  const params = new URLSearchParams();

  for (const name of ['search', 'city', 'maxRent'] as const) {
    const value = searchParams[name];
    values[name] = Array.isArray(value) ? value[0] ?? '' : value ?? '';
    if (Array.isArray(value) && value.length > 1) {
      errors[name] = `El filtro de ${labels[name]} está repetido. Revisa el valor y vuelve a buscar.`;
    }
  }

  const maxRent = values.maxRent.trim();
  if (maxRent && !errors.maxRent) {
    const amount = Number(maxRent);
    // Match the numeric input and the API's minimum without accepting Infinity or hex values.
    if (!/^(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(maxRent) || !Number.isFinite(amount) || amount < 1) {
      errors.maxRent = `El canon «${values.maxRent}» no es válido. Ingresa un número mayor o igual a 1 COP.`;
    }
  }

  if (values.search) params.set('search', values.search);
  if (values.city) params.set('city', values.city);
  if (maxRent && !errors.maxRent) params.set('maxRent', maxRent);

  return { values, errors, query: params.toString(), invalid: Object.keys(errors).length > 0 };
}
