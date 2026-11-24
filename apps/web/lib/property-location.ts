export interface PropertyLocation {
  latitude?: number | null;
  longitude?: number | null;
}
export type MapPoint = [latitude: number, longitude: number];

export function savedPoint({ latitude, longitude }: PropertyLocation): MapPoint | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return [latitude, longitude];
}
