import { BadRequestException } from '@nestjs/common';
import { Allow } from 'class-validator';

export class LocationInput {
  @Allow() latitude?: unknown;
  @Allow() longitude?: unknown;
}

function coordinate(value: unknown, limit: number) {
  if (value === null || value === '' || value === undefined) return null;
  if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d{1,3}(?:\.\d+)?$/.test(value))) {
    throw new BadRequestException('Usa coordenadas decimales válidas para el pin.');
  }
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > limit) {
    throw new BadRequestException('El pin está fuera del rango del mapa.');
  }
  return result;
}

export function locationFields(input: LocationInput) {
  if (input.latitude === undefined && input.longitude === undefined) return {};
  if (input.latitude === undefined || input.longitude === undefined) {
    throw new BadRequestException('Envía la latitud y la longitud juntas.');
  }
  const latitude = coordinate(input.latitude, 90);
  const longitude = coordinate(input.longitude, 180);
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException('Completa ambas coordenadas o retira el pin.');
  }
  return { latitude, longitude };
}
