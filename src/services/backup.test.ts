import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeBackup, parseBackup, mergeBackup } from './backup'
import { clientRepository, listVisits, saveData, initializeRepository } from './clientRepository'
import { readDatabase, writeDatabase } from './database'
vi.mock('./database', () => ({readDatabase:vi.fn(),writeDatabase:vi.fn()}))
import type { Client, Visit } from '../types'
const client: Client = { id:'a', code:'C1', name:'Tienda', createdAt:'2026-09-18T10:00:00Z', coordinates:{ latitude:7.9, longitude:-72.5 }, notes:'Entrada lateral', visitStatus:'visited', lastVisitAt:'2026-09-18T11:00:00Z' }
const visit: Visit = { id:'v1', clientId:'a', createdAt:'2026-09-18T11:00:00Z', coordinates:client.coordinates }
afterEach(() => vi.unstubAllGlobals())
describe('respaldos y recorrido', () => {
  it('conserva todos los datos al exportar y recuperar', () => {
    const backup = parseBackup(JSON.stringify(makeBackup([client], [visit])))
    expect(mergeBackup([], [], backup)).toEqual({ clients:[client], visits:[visit] })
  })
  it('importar dos veces no duplica visitas', () => {
    const backup=makeBackup([client],[visit]); const first=mergeBackup([],[],backup)
    expect(mergeBackup(first.clients,first.visits,backup)).toEqual(first)
  })
  it('combina códigos existentes sin perder la ficha actual ni visitas', () => {
    const backup=makeBackup([{...client,id:'b'}],[{...visit,clientId:'b'}])
    const result=mergeBackup([{...client,name:'Nombre actualizado'}],[],backup)
    expect(result.clients).toHaveLength(1); expect(result.clients[0].name).toBe('Nombre actualizado'); expect(result.visits[0].clientId).toBe('a')
  })
  it('rechaza coordenadas inválidas y visitas huérfanas', () => {
    expect(() => parseBackup(JSON.stringify(makeBackup([{...client,coordinates:{latitude:200,longitude:0}}],[])))).toThrow()
    expect(() => parseBackup(JSON.stringify(makeBackup([],[visit])))).toThrow()
  })
  it('rechaza versiones desconocidas e identificadores de visita conflictivos', () => {
    expect(() => parseBackup(JSON.stringify({...makeBackup([],[]),version:2}))).toThrow()
    expect(() => mergeBackup([client],[visit],makeBackup([client],[{...visit,createdAt:'2026-09-19T11:00:00Z'}]))).toThrow()
  })
  it('migra los datos anteriores y guarda clientes y visitas en una sola transacción', async () => {
    const storage=new Map<string,string>([['clientes-gps.clients.v1',JSON.stringify([client])],['clientes-gps.visits.v1',JSON.stringify([visit])]])
    const setItem=vi.fn((k:string,v:string)=>storage.set(k,v))
    vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem})
    vi.mocked(readDatabase).mockResolvedValue(undefined); vi.mocked(writeDatabase).mockResolvedValue()
    await initializeRepository()
    expect(clientRepository.list()).toEqual([client]); expect(listVisits()).toEqual([visit])
    expect(writeDatabase).toHaveBeenCalledWith({clients:[client],visits:[visit]})
    await saveData([client],[visit]); expect(setItem).not.toHaveBeenCalled()
    expect(clientRepository.list()).toEqual([client]); expect(listVisits()).toEqual([visit])
  })
  it('un fallo de base de datos no reemplaza el estado anterior', async () => {
    vi.mocked(readDatabase).mockResolvedValue({clients:[client],visits:[visit]})
    await initializeRepository()
    vi.mocked(writeDatabase).mockRejectedValueOnce(new Error('Sin espacio'))
    await expect(saveData([],[])).rejects.toThrow('Sin espacio')
    expect(clientRepository.list()).toEqual([client]); expect(listVisits()).toEqual([visit])
  })
})
