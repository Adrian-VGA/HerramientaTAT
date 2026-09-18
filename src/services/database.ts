import type { Client, Visit } from '../types'
export type Dataset = { clients: Client[]; visits: Visit[] }
let database: IDBDatabase | null = null
export async function openDatabase(): Promise<IDBDatabase> {
  if (database) return database
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('herramienta-tat',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('data')
    request.onerror=()=>reject(new Error('No se pudo abrir la base de datos local.'))
    request.onblocked=()=>reject(new Error('Cierra las otras pestañas de TAT y vuelve a intentarlo.'))
    request.onsuccess=()=>{ database=request.result; database.onversionchange=()=>{database?.close();database=null}; resolve(database) }
  })
}
export async function readDatabase(): Promise<Dataset | undefined> {
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('data','readonly'), request=tx.objectStore('data').get('current')
    tx.oncomplete=()=>resolve(request.result)
    tx.onabort=()=>reject(new Error('No se pudieron leer los datos locales.'))
    tx.onerror=()=>reject(new Error('No se pudieron leer los datos locales.'))
  })
}
export async function writeDatabase(data: Dataset, expected?: Dataset): Promise<void> {
  const db=await openDatabase()
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('data','readwrite')
    const store=tx.objectStore('data')
    const current=store.get('current')
    current.onsuccess=()=>{
      if (JSON.stringify(current.result)!==JSON.stringify(expected)) {
        reject(new Error('Los datos cambiaron en otra pestaña. Recarga la página antes de guardar.'))
        tx.abort(); return
      }
      store.put(data,'current')
    }
    tx.oncomplete=()=>resolve()
    tx.onabort=()=>reject(new Error('No se pudo guardar. Los datos anteriores siguen intactos. Revisa el espacio del dispositivo.'))
    tx.onerror=()=>reject(new Error('Error al guardar en la base de datos local.'))
  })
}
