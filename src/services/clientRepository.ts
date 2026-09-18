import type { Client, ClientRepository, Visit } from '../types'
const KEY = 'clientes-gps.data.v2'
function read(): { clients: Client[]; visits: Visit[] } {
  const saved = localStorage.getItem(KEY)
  if (saved) return JSON.parse(saved)
  return { clients: JSON.parse(localStorage.getItem('clientes-gps.clients.v1') ?? '[]'), visits: JSON.parse(localStorage.getItem('clientes-gps.visits.v1') ?? '[]') }
}
export function saveData(clients: Client[], visits: Visit[]) {
  localStorage.setItem(KEY, JSON.stringify({ clients, visits }))
}
export class LocalClientRepository implements ClientRepository {
  list() { return read().clients }
  create(client: Client) { const d = read(); saveData([...d.clients, client], d.visits) }
  update(client: Client) { const d = read(); saveData(d.clients.map(c => c.id === client.id ? client : c), d.visits) }
  remove(id: string) { const d = read(); saveData(d.clients.filter(c => c.id !== id), d.visits.filter(v => v.clientId !== id)) }
}
export const clientRepository = new LocalClientRepository()
export function listVisits() { return read().visits }
export function saveVisit(visit: Visit) { const d = read(); saveData(d.clients, [...d.visits, visit]) }
