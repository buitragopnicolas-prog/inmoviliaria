export const saleCatalogs = { comprar: 'Inmuebles en venta', 'vehiculos-y-bienes': 'Vehículos y bienes' } as const;
export type SaleCatalog = keyof typeof saleCatalogs;
export const promotionNames = {premium:'Premium','new-project':'Nuevo proyecto'} as const;
import type { PropertyLocation } from './property-location';
export type SaleOffer = PropertyLocation & { id: string; catalog: SaleCatalog; title: string; category: string; city: string; description: string;
  promotion?: keyof typeof promotionNames | null; estimatedMonthlyRent?:string|null;
  bedrooms?:number|null; address?:string|null; neighborhood?:string|null; features?:string[]; price: string; images: string[]; published: boolean; revision: number };
export function isSaleCatalog(value: string): value is SaleCatalog { return Object.hasOwn(saleCatalogs, value); }
