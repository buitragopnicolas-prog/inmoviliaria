import { readCatalogFilters } from '@/lib/catalog-filters';
import { loadPublicCatalog } from '@/lib/public-catalog';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = readCatalogFilters({
    search: params.getAll('search'), city: params.getAll('city'), maxRent: params.getAll('maxRent'),
  });
  if (filters.invalid) return Response.json(filters.errors, { status: 400 });
  const properties = await loadPublicCatalog(filters.query);
  return Response.json(properties, {
    status: properties === null ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
