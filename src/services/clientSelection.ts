import type { Client, Coordinates } from '../types'
import { distanceInMeters } from './distance'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function filterClients(clients: Client[], neighborhood: string, query: string, status: 'all' | 'pending' | 'visited' = 'all') {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return clients.filter(client => {
    const searchable = normalize(`${client.code} ${client.name} ${client.neighborhood ?? ''}`)
    return (neighborhood === 'all' || client.neighborhood === neighborhood) && (status === 'all' || (client.visitStatus ?? 'pending') === status) && terms.every(term => searchable.includes(term))
  })
}

export function nearestClient(clients: Client[], position: Coordinates | null, pendingOnly = false) {
  if (!position) return null
  const candidates = pendingOnly ? clients.filter(client => client.visitStatus !== 'visited') : clients
  return candidates.map(client => ({ client, distance: distanceInMeters(position, client.coordinates) }))
    .sort((a, b) => a.distance - b.distance || a.client.code.localeCompare(b.client.code))[0] ?? null
}
