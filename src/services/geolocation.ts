import type { Coordinates } from '../types'

export function watchCurrentLocation(onPosition: (position: Coordinates) => void, onError: (message: string) => void): () => void {
  if (!navigator.geolocation) { onError('Este navegador no permite obtener la ubicación.'); return () => {} }
  let active = true
  const id = navigator.geolocation.watchPosition(
    position => { if (active) onPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }) },
    error => { if (active) onError(error.code === 1 ? 'No autorizaste el acceso a la ubicación.' : 'Se interrumpió la señal GPS. Vuelve a activar el seguimiento.') },
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
  )
  return () => { active = false; navigator.geolocation.clearWatch(id) }
}

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
