import { FormEvent, useMemo, useState, useRef, useEffect } from 'react'
import { filterClients, nearestClient } from './services/clientSelection'
import { ClientMap } from './components/ClientMap'
import { distanceInMeters, formatDistance } from './services/distance'
import { getCurrentLocation, watchCurrentLocation } from './services/geolocation'
import { clientRepository, listVisits, saveData } from './services/clientRepository'
import type { Client, Coordinates, Visit } from './types'
import { makeBackup, parseBackup, mergeBackup, type Backup } from './services/backup'

export function App() {
  const [clients, setClients] = useState<Client[]>(() => clientRepository.list())
  const [position, setPosition] = useState<Coordinates | null>(null)
  const [message, setMessage] = useState('Activa tu ubicación para ver clientes cercanos.')
  const [isLocating, setIsLocating] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [capturedPosition, setCapturedPosition] = useState<Coordinates | null>(null)
  const [visitBusy, setVisitBusy] = useState(false)
  const visitLock = useRef(false)
  function beginWrite() { if (visitLock.current) return false; visitLock.current=true; setVisitBusy(true); return true }
  function endWrite() { visitLock.current=false; setVisitBusy(false) }
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'visited'>('all')
  useEffect(() => {
    if (!tracking) return
    return watchCurrentLocation(p => {
      setPosition(p)
      setMessage(`GPS en vivo · precisión aproximada de ${Math.round(p.accuracy ?? 0)} m · ${new Date().toLocaleTimeString('es-CO')}`)
    }, message => { setMessage(message); setTracking(false) })
  }, [tracking])
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [neighborhood, setNeighborhood] = useState('all')
  const [showClients, setShowClients] = useState(false)
  const [visits, setVisits] = useState<Visit[]>(() => listVisits())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [imported, setImported] = useState<Backup | null>(null)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = clients.find(c => c.id === selectedId)
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(makeBackup(clients, visits), null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `TAT-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Respaldo descargado: clientes e historial de visitas.')
  }
  async function readImport(file?: File) {
    if (!file) return
    setError(''); setNotice('')
    try { if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera el límite de 10 MB.'); setImported(parseBackup(await file.text())) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el respaldo.') }
    finally { if (fileInput.current) fileInput.current.value = '' }
  }
  async function confirmImport() {
    if (!imported || !beginWrite()) return
    try {
      const merged = mergeBackup(clients, visits, imported)
      await saveData(merged.clients, merged.visits)
      setClients(merged.clients); setVisits(merged.visits); setImported(null)
      setNotice(`Respaldo incorporado. ${merged.clients.length} clientes y ${merged.visits.length} visitas conservadas.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No hay espacio para guardar el respaldo.'); setImported(null) }
    finally { endWrite() }
  }
  const neighborhoods = useMemo(() => [...new Set(clients.map((c) => c.neighborhood).filter((n): n is string => Boolean(n)))].sort(), [clients])
  const visible = useMemo(() => filterClients(clients, neighborhood, query, statusFilter), [clients, neighborhood, query, statusFilter])
  const pending = visible.filter(c => c.visitStatus !== 'visited')
  const nearest = useMemo(() => nearestClient(visible, position), [position, visible])
  const nextPending = useMemo(() => nearestClient(visible, position, true), [position, visible])

  async function selectNextPending() {
    const fresh = await locate()
    if (!fresh) return
    const next = nearestClient(visible, fresh, true)
    if (next) { setSelectedId(next.client.id); setNotice(`Siguiente pendiente: ${next.client.name}. Distancia en línea recta: ${formatDistance(next.distance)}.`) }
    else { setSelectedId(null); setNotice('No quedan clientes pendientes con estos filtros.') }
  }

  async function locate() {
    setIsLocating(true)
    try { const p = await getCurrentLocation(); setPosition(p); setMessage(`Ubicación obtenida con precisión aproximada de ${Math.round(p.accuracy ?? 0)} m.`); return p }
    catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.'); return null }
    finally { setIsLocating(false) }
  }

  async function openForm() {
    setError('')
    const fresh = await locate()
    if (fresh) { setCapturedPosition(fresh); setShowForm(true) }
    else setError('No se pudo registrar la ubicación actual. Activa el GPS e inténtalo de nuevo.')
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!capturedPosition) return
    const form = new FormData(event.currentTarget), code = String(form.get('code') ?? '').trim().toUpperCase(), name = String(form.get('name') ?? '').trim(), area = String(form.get('neighborhood') ?? '').trim(), notes = String(form.get('notes') ?? '').trim()
    if (!code || !name || !area) { setError('Completa el código, el nombre y el barrio.'); return }
    if (clients.some((c) => c.code.toLowerCase() === code.toLowerCase())) { setError('Ya existe un cliente con ese código.'); return }
    const client: Client = { id: crypto.randomUUID(), code, name, coordinates: capturedPosition, createdAt: new Date().toISOString(), neighborhood: area || undefined, notes: notes || undefined, visitStatus: 'pending' }
    if (!beginWrite()) return
    try { await clientRepository.create(client); setClients((current) => [...current, client]); setShowForm(false); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el cliente.') }
    finally { endWrite() }
  }
  async function setVisitStatus(client: Client, visited: boolean) {
    if (visitLock.current) return
    visitLock.current = true; setVisitBusy(true); setError('')
    const fresh = visited ? await locate() : position
    if (visited && !fresh) { setError('La visita no se guardó: necesitamos una ubicación actual. Activa el GPS e inténtalo de nuevo.'); visitLock.current = false; setVisitBusy(false); return }
    const date = new Date().toISOString(), updated: Client = { ...client, visitStatus: visited ? 'visited' : 'pending', lastVisitAt: visited ? date : client.lastVisitAt }
    const nextClients = clients.map(c => c.id === client.id ? updated : c)
    const nextVisits: Visit[] = visited ? [...visits, { id: crypto.randomUUID(), clientId: client.id, createdAt: date, coordinates: fresh ?? undefined }] : visits
    try {
      await saveData(nextClients, nextVisits); setClients(nextClients); setVisits(nextVisits); setError('')
      if (visited) {
        const remaining = filterClients(nextClients, neighborhood, query, statusFilter)
        const next = nearestClient(remaining, fresh, true)
        setSelectedId(next?.client.id ?? null)
        setNotice(next ? `Visita guardada. Siguiente pendiente: ${next.client.name}. Calculado con el GPS de esta visita.` : remaining.some(c => c.visitStatus !== 'visited') ? 'Visita guardada. Activa tu ubicación para encontrar el siguiente pendiente.' : 'Visita guardada. No quedan pendientes con estos filtros.')
      }
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la visita.') }
    finally { visitLock.current = false; setVisitBusy(false) }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingClient) return
    const form = new FormData(event.currentTarget), code = String(form.get('code') ?? '').trim().toUpperCase(), name = String(form.get('name') ?? '').trim(), area = String(form.get('neighborhood') ?? '').trim(), notes = String(form.get('notes') ?? '').trim()
    if (!code || !name || !area) { setError('Completa el código, el nombre y el barrio.'); return }
    if (clients.some((c) => c.id !== editingClient.id && c.code.toLowerCase() === code.toLowerCase())) { setError('Ya existe otro cliente con ese código.'); return }
    const updated: Client = { ...editingClient, code, name, neighborhood: area || undefined, notes: notes || undefined }
    if (!beginWrite()) return
    try { await clientRepository.update(updated); setClients((current) => current.map((c) => c.id === updated.id ? updated : c)); setEditingClient(null); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.') }
    finally { endWrite() }
  }
  async function deleteClient(client: Client) {
    if (!window.confirm(`¿Eliminar a ${client.name}? Esta acción no se puede deshacer.`)) return
    if (!beginWrite()) return
    try { await clientRepository.remove(client.id); setClients((current) => current.filter((c) => c.id !== client.id)); setVisits((current) => current.filter((v) => v.clientId !== client.id)); setSelectedId(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el cliente.') }
    finally { endWrite() }
  }

  return <main className="app-shell"><fieldset className="app-controls" disabled={visitBusy}><legend className="sr-only">Herramienta TAT</legend>
    <header className="topbar"><div><p className="eyebrow">TU DÍA, MEJOR ORGANIZADO</p><h1>TAT<span className="brand-dot">.</span></h1><p className="subtitle">Cada cliente. Un paso más cerca.</p></div><button className="locate-button" onClick={() => void locate()} disabled={isLocating}>{isLocating ? 'Buscando…' : '⌖ Mi ubicación'}</button></header>
    <nav className="section-menu" aria-label="Secciones"><a href="#mapa">Mapa</a><a href="#clientes" onClick={() => setShowClients(true)}>Clientes</a><a href="#historial">Visitas</a><a href="#respaldo">Respaldo</a></nav>
    <section className="status-card" aria-live="polite"><div className="status-icon">📍</div><div><p className="eyebrow">UBICACIÓN ACTUAL</p><p className="status-copy">{message}</p><p className="tracking-note">{tracking ? 'Actualización mientras mantengas esta página activa.' : 'Puedes activar el GPS en vivo para actualizar las distancias al moverte.'}</p><button className="text-button" aria-pressed={tracking} onClick={() => { setTracking(!tracking); setMessage(tracking ? 'Seguimiento detenido. Se conserva la última ubicación obtenida.' : 'Iniciando GPS en vivo…') }}>{tracking ? 'Detener GPS en vivo' : 'Activar GPS en vivo'}</button></div></section>
    <section className="summary-grid"><article className="metric"><span>CLIENTES</span><strong>{visible.length}</strong><small>registrados</small></article><article className="metric pending-metric"><span>PENDIENTES</span><strong>{pending.length}</strong><small>por visitar</small></article><article className="nearest-card"><span>CLIENTE MÁS CERCANO</span>{nearest ? <><strong>{nearest.client.name}</strong><small>{nearest.client.code} · {formatDistance(nearest.distance)} en línea recta</small><button className="text-button" onClick={() => setSelectedId(nearest.client.id)}>Ver cliente más cercano ↗</button></> : <small>{position ? 'No hay clientes con estos filtros.' : 'Obtén tu ubicación para calcularlo.'}</small>}</article></section>
    <section className="search-section" role="search"><label htmlFor="client-search">Buscar clientes</label><div className="search-control"><input id="client-search" type="search" placeholder="Nombre, código o barrio" value={query} onChange={e => { setQuery(e.target.value); setSelectedId(null) }} />{query && <button onClick={() => { setQuery(''); setSelectedId(null) }}>Limpiar</button>}</div></section>
    <section className="filter-row"><label htmlFor="area">Barrio</label><select id="area" value={neighborhood} onChange={(e) => { setNeighborhood(e.target.value); setSelectedId(null) }}><option value="all">Todos los barrios</option>{neighborhoods.map((n) => <option key={n}>{n}</option>)}</select></section>
    <div className="status-filters" role="group" aria-label="Estado de visita">{(['all', 'pending', 'visited'] as const).map(status => <button key={status} aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setSelectedId(null) }}>{status === 'all' ? 'Todos' : status === 'pending' ? 'Pendientes' : 'Visitados'}</button>)}</div>
    <section className="next-stop" aria-labelledby="next-stop-title"><div><p className="eyebrow">CONTINÚA TU RECORRIDO</p><h2 id="next-stop-title">{nextPending ? nextPending.client.name : pending.length ? 'Encuentra tu siguiente parada' : 'Sin pendientes en esta vista'}</h2><p>{nextPending ? `${nextPending.client.code} · ${formatDistance(nextPending.distance)} en línea recta` : pending.length ? 'Activa tu ubicación para elegir el pendiente más cercano.' : statusFilter === 'visited' ? 'Cambia el filtro a Todos o Pendientes para continuar.' : visible.length ? 'Todos los clientes de esta vista están visitados.' : 'Prueba otra búsqueda o registra tu primer cliente.'}</p><small>Se respetan la búsqueda, el barrio y el estado seleccionados.</small></div><button className="route-link" onClick={() => void selectNextPending()} disabled={isLocating || !pending.length}>{isLocating ? 'Actualizando ubicación…' : 'Siguiente cliente pendiente'}</button></section>
    {query.trim() && <p className="search-count" role="status">{visible.length} resultado{visible.length === 1 ? '' : 's'} para «{query.trim()}»</p>}
    <section className="map-section" id="mapa"><div className="map-heading"><h2>Mapa de clientes</h2><span><i className="legend you" /> Tú <i className="legend client" /> Pendiente <i className="legend visited" /> Visitado</span></div><ClientMap clients={visible} position={position} selectedId={selectedId} onSelect={setSelectedId} /></section>
    {selected && <section className="destination-card"><div><p className="eyebrow">CLIENTE SELECCIONADO</p><h2>{selected.name}</h2><p>{selected.code}{selected.neighborhood ? ` · ${selected.neighborhood}` : ''}</p><p>{position ? `${formatDistance(distanceInMeters(position, selected.coordinates))} en línea recta desde ti` : 'Activa tu ubicación para calcular la distancia.'}</p>{selected.notes && <p>{selected.notes}</p>}</div><a className="route-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coordinates.latitude},${selected.coordinates.longitude}${position ? `&origin=${position.latitude},${position.longitude}` : ''}`}>Cómo llegar ↗</a><button className="visit-button" disabled={visitBusy || selected.visitStatus === 'visited'} onClick={() => setVisitStatus(selected, true)}>{selected.visitStatus === 'visited' ? 'Ya visitado' : 'Marcar visitado y continuar'}</button><button className="text-button" onClick={() => setSelectedId(null)}>Cerrar</button></section>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}<button className="primary-action" disabled={isLocating} onClick={() => void openForm()}>＋ Registrar cliente aquí</button><button className="secondary-action" onClick={() => setShowClients((value) => !value)}>{showClients ? 'Ocultar clientes' : `Ver clientes y visitas (${visible.length})`}</button>
    {(showClients || Boolean(query.trim())) && <section className="client-list" id="clientes"><h2>Clientes {neighborhood === 'all' ? '' : `en ${neighborhood}`}</h2>{visible.length === 0 ? <p className="empty-state">No hay coincidencias. Cambia la búsqueda o el barrio.</p> : [...visible].sort((a, b) => position ? distanceInMeters(position, a.coordinates) - distanceInMeters(position, b.coordinates) : a.name.localeCompare(b.name)).map((client) => { const done = client.visitStatus === 'visited', count = visits.filter((v) => v.clientId === client.id).length; return <article className="client-row" key={client.id}><div><button className="client-name" onClick={() => setSelectedId(client.id)}>{client.name} ↗</button><small>{position ? `${formatDistance(distanceInMeters(position, client.coordinates))} · ` : ''}{client.code}{client.neighborhood ? ` · ${client.neighborhood}` : ''}</small><small>{done ? `✓ Visitado · ${client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString('es-CO') : 'Registrado'}` : '● Pendiente'}{count ? ` · ${count} visita${count === 1 ? '' : 's'}` : ''}</small></div><div className="row-actions"><button disabled={visitBusy} className={done ? 'undo-button' : 'visit-button'} onClick={() => setVisitStatus(client, !done)}>{done ? 'Deshacer' : 'Visitar'}</button><button className="edit-button" onClick={() => { setError(''); setEditingClient(client) }}>Editar</button><button className="delete-button" onClick={() => deleteClient(client)} aria-label={`Eliminar ${client.name}`}>×</button></div></article> })}</section>}
    <section className="backup-card" id="respaldo"><div><p className="eyebrow">TODO TU RECORRIDO, CONTIGO</p><h2>Tu recorrido, siempre a mano.</h2><p>Guarda clientes, ubicaciones, notas e historial para recuperarlos en esta app o en una versión compatible.</p></div><div className="backup-actions"><button onClick={exportData}>↓ Exportar respaldo</button><button onClick={() => fileInput.current?.click()}>↑ Importar respaldo</button><input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={e => void readImport(e.target.files?.[0])} /></div><small>Los datos se guardan en la base de datos de este navegador. El respaldo incluye ubicaciones y datos de tus clientes.</small></section>
    <section className="history" id="historial"><p className="eyebrow">TU ACTIVIDAD</p><h2>Historial de visitas <span>{visits.length}</span></h2>{visits.length === 0 ? <p className="empty-state">Tu recorrido comienza con la primera visita.</p> : <ol>{[...visits].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(v => <li key={v.id}><span className="history-dot" /><div><strong>{clients.find(c => c.id === v.clientId)?.name ?? 'Cliente'}</strong><p>{new Date(v.createdAt).toLocaleString('es-CO')}</p>{v.coordinates && <small>{v.coordinates.latitude.toFixed(5)}, {v.coordinates.longitude.toFixed(5)}</small>}</div></li>)}</ol>}</section>
    <footer>TAT · A tu ritmo, en cada visita.</footer>
    {imported && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><h2 id="import-title">Recuperar tu recorrido</h2><p className="import-copy">El archivo contiene {imported.clients.length} clientes y {imported.visits.length} visitas. Se agregarán datos nuevos sin duplicar visitas. Para clientes con el mismo código o identificador, se conservará la ficha actual.</p><button className="primary-action" onClick={confirmImport}>Combinar y guardar</button><button className="secondary-action" onClick={() => setImported(null)}>Cancelar</button></section></div>}
    {showForm && capturedPosition && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><button className="close" onClick={() => setShowForm(false)} aria-label="Cerrar">×</button><p className="eyebrow">NUEVO CLIENTE</p><h2 id="register-title">Registrar en esta ubicación</h2><p className="coordinate">📍 {capturedPosition.latitude.toFixed(6)}, {capturedPosition.longitude.toFixed(6)} · precisión ±{Math.round(capturedPosition.accuracy ?? 0)} m</p><form onSubmit={saveClient}><label>Código<input name="code" placeholder="Ej. CL-00458" required maxLength={40} autoFocus /></label><label>Nombre<input name="name" placeholder="Ej. Tienda La Esperanza" required maxLength={100} /></label><label>Barrio<input required name="neighborhood" placeholder="Ej. La Libertad" defaultValue={neighborhood === 'all' ? '' : neighborhood} maxLength={80} /></label><label>Observaciones <small>(opcional)</small><textarea name="notes" placeholder="Ej. Entrada lateral" maxLength={500} rows={3} /></label>{error && <p className="form-alert" role="alert">{error}</p>}<p className="tracking-note">Se guardará el punto capturado al abrir este formulario.</p><button className="primary-action" type="submit">Guardar cliente</button></form></section></div>}
    {editingClient && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><button className="close" onClick={() => setEditingClient(null)} aria-label="Cerrar">×</button><p className="eyebrow">EDITAR CLIENTE</p><h2 id="edit-title">{editingClient.name}</h2><form onSubmit={saveEdit}><label>Código<input name="code" defaultValue={editingClient.code} required maxLength={40} autoFocus /></label><label>Nombre<input name="name" defaultValue={editingClient.name} required maxLength={100} /></label><label>Barrio<input required name="neighborhood" defaultValue={editingClient.neighborhood} maxLength={80} /></label><label>Observaciones <small>(opcional)</small><textarea name="notes" defaultValue={editingClient.notes} maxLength={500} rows={3} /></label>{error && <p className="form-alert">{error}</p>}<button className="primary-action" type="submit">Guardar cambios</button></form></section></div>}
  </fieldset>{visitBusy && <p className="saving-status" role="status">Obteniendo ubicación o guardando datos…</p>}</main>
}
