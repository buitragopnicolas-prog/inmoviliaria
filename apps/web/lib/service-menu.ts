import type { SiteCopy } from './site-content';
const slots = [['legal','juridicos'],['accounting','contables'],['property','inmobiliarios'],['service4','servicio-4'],['service5','servicio-5'],['service6','servicio-6'],['service7','servicio-7'],['service8','servicio-8']] as const;
export function serviceMenu(copy:SiteCopy['servicios']) {
  return slots.filter(([key])=>copy[key].trim()).map(([slot,key])=>({
    key,name:copy[slot],description:copy[`${slot}Text`],
    href:slot==='legal'||slot==='accounting'||slot==='property'?copy[`${slot}Link`]:'/contacto?servicio='+key,
  }));
}
