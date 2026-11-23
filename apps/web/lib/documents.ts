export type DocumentFile = { serviceType?:string|null; id: string; originalName: string; size: number; createdAt: string };
export type DocumentAccount = { portal:import('./portals').Portal; id: string; name: string; email: string };
export const rentalFormats = { solicitud: 'Solicitud de arrendamiento', contrato: 'Contrato modelo' } as const;
export type FormatKey = keyof typeof rentalFormats;
export type RentalFormat = { key: FormatKey; file: DocumentFile };
