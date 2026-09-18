import type { Client, ClientRepository } from '../types'

const STORAGE_KEY = 'clientes-gps.clients.v1'
const VISITS_STORAGE_KEY = 'clientes-gps.visits.v1'

export class LocalClientRepository implements ClientRepository {
  list(): Client[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      return Array.isArray(value) ? value as Client[] : []
    } catch {
      return []
    }
  }

  create(client: Client): void {
    const current = this.list()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, client]))
  }

  update(client: Client): void {
    const updated = this.list().map((current) => current.id === client.id ? client : current)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  remove(id: string): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list().filter((client) => client.id !== id)))
    localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify(listVisits().filter((visit) => visit.clientId !== id)))
  }
}

export const clientRepository = new LocalClientRepository()

export function listVisits(): import('../types').Visit[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(VISITS_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value as import('../types').Visit[] : []
  } catch {
    return []
  }
}

export function saveVisit(visit: import('../types').Visit) {
  localStorage.setItem(VISITS_STORAGE_KEY, JSON.stringify([...listVisits(), visit]))
}
