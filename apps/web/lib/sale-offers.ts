export const saleCatalogs = { comprar: 'Inmuebles en venta', 'vehiculos-y-bienes': 'Vehículos y bienes' } as const;
export type SaleCatalog = keyof typeof saleCatalogs;
export type SaleOffer = { id: string; catalog: SaleCatalog; title: string; category: string; city: string; description: string;
  bedrooms?:number|null; address?:string|null; neighborhood?:string|null; features?:string[]; price: string; images: string[]; published: boolean; revision: number };
export function isSaleCatalog(value: string): value is SaleCatalog { return Object.hasOwn(saleCatalogs, value); }
