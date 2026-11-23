import { loadPublicData } from './public-data';
import type { Property, PropertyImage } from './types';

export type CatalogProperty = Pick<Property,
  'id' | 'slug' | 'title' | 'status' | 'city' | 'neighborhood' | 'monthlyRent' | 'administrationFee' |
  'areaM2' | 'bedrooms' | 'bathrooms' | 'parking' | 'tour360Url'
> & { images: Pick<PropertyImage, 'url' | 'alt'>[] };

function catalogCard(property: Property): CatalogProperty {
  const { id, slug, title, status, city, neighborhood, monthlyRent, administrationFee,
    areaM2, bedrooms, bathrooms, parking, tour360Url, images } = property;
  return {
    id, slug, title, status, city, neighborhood, monthlyRent, administrationFee,
    areaM2, bedrooms, bathrooms, parking, tour360Url, images: images.map(({ url, alt }) => ({ url, alt })),
  };
}

export async function loadPublicCatalog(query: string) {
  const properties = await loadPublicData<Property[]>(`/properties?${query}`);
  return properties?.map(catalogCard) ?? null;
}
