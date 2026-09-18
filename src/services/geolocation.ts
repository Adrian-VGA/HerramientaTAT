import type { Coordinates } from '../types'

export function getCurrentLocation(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Este navegador no permite obtener la ubicación.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const messages: Record<number, string> = {
          1: 'No autorizaste el acceso a la ubicación.',
          2: 'No se pudo determinar tu ubicación.',
          3: 'La ubicación tardó demasiado. Inténtalo de nuevo.',
        }
        reject(new Error(messages[error.code] ?? 'No se pudo obtener la ubicación.'))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  })
}
