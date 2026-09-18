import { describe, expect, it } from 'vitest'
import { filterClients, nearestClient } from './clientSelection'
import type { Client } from '../types'
const clients: Client[] = [
  { id:'1', code:'CL-001', name:'Tienda José', neighborhood:'Belén', coordinates:{latitude:0,longitude:0}, createdAt:'2026-09-18', visitStatus:'visited' },
  { id:'2', code:'CL-002', name:'Panadería', neighborhood:'Centro', coordinates:{latitude:0,longitude:.001}, createdAt:'2026-09-18', visitStatus:'pending' },
  { id:'3', code:'CL-003', name:'Mercado', neighborhood:'Centro', coordinates:{latitude:0,longitude:.002}, createdAt:'2026-09-18' },
]
const position={latitude:0,longitude:0}
describe('búsqueda y siguiente cliente', () => {
  it('busca sin distinguir tildes y mayúsculas', () => {
    expect(filterClients(clients,'all',' JOSE belen ').map(c=>c.id)).toEqual(['1'])
    expect(filterClients(clients,'all','cl-002').map(c=>c.id)).toEqual(['2'])
  })
  it('combina barrio y búsqueda y distingue cero resultados', () => {
    expect(filterClients(clients,'Centro','mercado').map(c=>c.id)).toEqual(['3'])
    expect(filterClients(clients,'Centro','jose')).toEqual([])
    expect(filterClients(clients,'all','   ')).toHaveLength(3)
  })
  it('omite visitados al elegir siguiente, pero mantiene la cercanía general', () => {
    expect(nearestClient(clients,position)?.client.id).toBe('1')
    expect(nearestClient(clients,position,true)?.client.id).toBe('2')
  })
  it('avanza al siguiente pendiente y reconoce el final del recorrido', () => {
    const after=clients.map(c=>c.id==='2'?{...c,visitStatus:'visited' as const}:c)
    expect(nearestClient(after,position,true)?.client.id).toBe('3')
    expect(nearestClient(after.map(c=>({...c,visitStatus:'visited'})),position,true)).toBeNull()
  })
  it('no inventa una distancia sin GPS ni un cliente en una lista vacía', () => {
    expect(nearestClient(clients,null,true)).toBeNull()
    expect(nearestClient([],position,true)).toBeNull()
  })
})
