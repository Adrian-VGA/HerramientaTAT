import type { Client, Coordinates, Visit } from '../types'

export type Backup = { format: 'herramienta-tat'; version: 1; exportedAt: string; clients: Client[]; visits: Visit[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
function coordinates(v: unknown): v is Coordinates {
  return record(v) && typeof v.latitude === 'number' && Number.isFinite(v.latitude) && Math.abs(v.latitude) <= 90 && typeof v.longitude === 'number' && Number.isFinite(v.longitude) && Math.abs(v.longitude) <= 180 && (v.accuracy === undefined || typeof v.accuracy === 'number' && Number.isFinite(v.accuracy) && v.accuracy >= 0)
}
export function makeBackup(clients: Client[], visits: Visit[]): Backup {
  return { format: 'herramienta-tat', version: 1, exportedAt: new Date().toISOString(), clients, visits }
}
export function parseBackup(source: string): Backup {
  const data: unknown = JSON.parse(source)
  if (!record(data) || data.format !== 'herramienta-tat' || data.version !== 1 || !date(data.exportedAt) || !Array.isArray(data.clients) || !Array.isArray(data.visits)) throw new Error('Este archivo no es un respaldo TAT compatible.')
  const ids = new Set<string>(), codes = new Set<string>(), visitIds = new Set<string>()
  for (const c of data.clients) {
    if (!record(c) || !text(c.id) || !text(c.code) || !text(c.name) || !date(c.createdAt) || !coordinates(c.coordinates) || ![undefined, 'pending', 'visited'].includes(c.visitStatus as string | undefined) || ['notes', 'neighborhood'].some(k => c[k] !== undefined && typeof c[k] !== 'string') || c.lastVisitAt !== undefined && !date(c.lastVisitAt)) throw new Error('El respaldo contiene un cliente con datos inválidos.')
    if (ids.has(c.id) || codes.has(c.code.trim().toLowerCase())) throw new Error('El respaldo contiene clientes duplicados.')
    ids.add(c.id); codes.add(c.code.trim().toLowerCase())
  }
  for (const v of data.visits) {
    if (!record(v) || !text(v.id) || !text(v.clientId) || !ids.has(v.clientId) || !date(v.createdAt) || v.coordinates !== undefined && !coordinates(v.coordinates) || visitIds.has(v.id)) throw new Error('El respaldo contiene visitas inválidas o sin cliente.')
    visitIds.add(v.id)
  }
  return data as Backup
}
export function mergeBackup(current: Client[], history: Visit[], backup: Backup) {
  const clients = [...current], visits = [...history], aliases = new Map<string, string>()
  for (const c of backup.clients) {
    const existing = clients.find(x => x.id === c.id) ?? clients.find(x => x.code.trim().toLowerCase() === c.code.trim().toLowerCase())
    if (existing) aliases.set(c.id, existing.id)
    else { clients.push(c); aliases.set(c.id, c.id) }
  }
  for (const v of backup.visits) {
    const mapped = { ...v, clientId: aliases.get(v.clientId)! }
    const existing = visits.find(x => x.id === v.id)
    if (existing && (existing.clientId !== mapped.clientId || existing.createdAt !== mapped.createdAt || JSON.stringify(existing.coordinates) !== JSON.stringify(mapped.coordinates))) throw new Error('Hay una visita con el mismo identificador y datos distintos. No se importó nada.')
    if (!existing) visits.push(mapped)
  }
  return { clients, visits: visits.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)) }
}
