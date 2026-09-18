import type { Coordinates } from '../types'

const EARTH_RADIUS_METERS = 6_371_000
const radians = (degrees: number) => degrees * Math.PI / 180

export function distanceInMeters(a: Coordinates, b: Coordinates): number {
  const latDelta = radians(b.latitude - a.latitude)
  const lonDelta = radians(b.longitude - a.longitude)
  const sinLat = Math.sin(latDelta / 2)
  const sinLon = Math.sin(lonDelta / 2)
  const h = sinLat ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * sinLon ** 2
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`
}
