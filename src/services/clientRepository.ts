import type { Client, ClientRepository, Visit } from '../types'
import { readDatabase, writeDatabase, type Dataset } from './database'
import { makeBackup, parseBackup } from './backup'
let snapshot: Dataset | null = null
function readLegacy(): Dataset {
  const saved=localStorage.getItem('clientes-gps.data.v2')
  if (saved) return JSON.parse(saved)
  return {clients:JSON.parse(localStorage.getItem('clientes-gps.clients.v1')??'[]'),visits:JSON.parse(localStorage.getItem('clientes-gps.visits.v1')??'[]')}
}
export async function initializeRepository() {
  const stored=await readDatabase()
  const data=stored??readLegacy()
  // Validate before migrating; keep legacy storage intact as a recovery copy.
  parseBackup(JSON.stringify(makeBackup(data.clients,data.visits)))
  if (!stored) await writeDatabase(data)
  snapshot=data
}
function read() { if (!snapshot) throw new Error('La base de datos aún no está lista.'); return snapshot }
export async function saveData(clients: Client[],visits: Visit[]) {
  const data={clients,visits}
  await writeDatabase(data, read())
  snapshot=data
}
export class LocalClientRepository implements ClientRepository {
  list() { return read().clients }
  async create(client:Client) { const d=read(); await saveData([...d.clients,client],d.visits) }
  async update(client:Client) { const d=read(); await saveData(d.clients.map(c=>c.id===client.id?client:c),d.visits) }
  async remove(id:string) { const d=read(); await saveData(d.clients.filter(c=>c.id!==id),d.visits.filter(v=>v.clientId!==id)) }
}
export const clientRepository=new LocalClientRepository()
export function listVisits() { return read().visits }
export async function saveVisit(visit:Visit) { const d=read(); await saveData(d.clients,[...d.visits,visit]) }

