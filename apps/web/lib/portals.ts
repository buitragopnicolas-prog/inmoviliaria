export const portalNames = {TENANT:'Arrendatarios',OWNER:'Propietarios',SERVICES:'Clientes de servicios'} as const;
export type Portal = keyof typeof portalNames;
export const portalPaths = {TENANT:'/arrendatarios',OWNER:'/propietarios',SERVICES:'/clientes'} as const;
export const portalDescriptions = {
  TENANT:'Consulta tu contrato de arrendamiento, tus documentos y tus facturas.',
  OWNER:'Publica un inmueble en arriendo o venta, administra sus fotografías y consulta tus facturas.',
  SERVICES:'Consulta tus contratos de prestación de servicios jurídicos, contables o tributarios y tus facturas.',
};
