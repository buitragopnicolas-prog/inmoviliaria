const contactSubjects = {
  compra: 'Comprar un inmueble',
  bienes: 'Consultar por un vehículo u otro bien',
  servicios: 'Solicitar asesoría',
} as const;

export function contactHref(interest: keyof typeof contactSubjects) {
  return `/contacto?interes=${interest}`;
}

export function contactSubject(interest: string | string[] | undefined) {
  if (typeof interest !== 'string' || !Object.hasOwn(contactSubjects, interest)) return '';
  return contactSubjects[interest as keyof typeof contactSubjects];
}
