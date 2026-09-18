import { FormEvent, useMemo, useState, useRef } from 'react'
import { ClientMap } from './components/ClientMap'
import { distanceInMeters, formatDistance } from './services/distance'
import { getCurrentLocation } from './services/geolocation'
import { clientRepository, listVisits, saveData } from './services/clientRepository'
import type { Client, Coordinates, Visit } from './types'
import { makeBackup, parseBackup, mergeBackup, type Backup } from './services/backup'

export function App() {
  const [clients, setClients] = useState<Client[]>(() => clientRepository.list())
  const [position, setPosition] = useState<Coordinates | null>(null)
  const [message, setMessage] = useState('Activa tu ubicación para ver clientes cercanos.')
  const [isLocating, setIsLocating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [error, setError] = useState('')
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
  function confirmImport() {
    if (!imported) return
    try {
      const merged = mergeBackup(clients, visits, imported)
      saveData(merged.clients, merged.visits)
      setClients(merged.clients); setVisits(merged.visits); setImported(null)
      setNotice(`Respaldo incorporado. ${merged.clients.length} clientes y ${merged.visits.length} visitas conservadas.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No hay espacio para guardar el respaldo.'); setImported(null) }
  }
  const neighborhoods = useMemo(() => [...new Set(clients.map((c) => c.neighborhood).filter((n): n is string => Boolean(n)))].sort(), [clients])
  const visible = useMemo(() => neighborhood === 'all' ? clients : clients.filter((c) => c.neighborhood === neighborhood), [clients, neighborhood])
  const pending = visible.filter((c) => c.visitStatus !== 'visited')
  const nearest = useMemo(() => !position || !visible.length ? null : [...visible].sort((a, b) => position ? distanceInMeters(position, a.coordinates) - distanceInMeters(position, b.coordinates) : a.name.localeCompare(b.name)).map((client) => ({ client, distance: distanceInMeters(position, client.coordinates) })).sort((a, b) => a.distance - b.distance)[0], [position, visible])

  async function locate() {
    setIsLocating(true)
    try { const p = await getCurrentLocation(); setPosition(p); setMessage(`Ubicación obtenida con precisión aproximada de ${Math.round(p.accuracy ?? 0)} m.`) }
    catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.') }
    finally { setIsLocating(false) }
  }

  function openForm() { setError(''); if (!position) { setError('Primero obtén tu ubicación para guardar las coordenadas actuales.'); void locate(); return }; setShowForm(true) }
  function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!position) return
    const form = new FormData(event.currentTarget), code = String(form.get('code') ?? '').trim().toUpperCase(), name = String(form.get('name') ?? '').trim(), area = String(form.get('neighborhood') ?? '').trim()
    if (clients.some((c) => c.code.toLowerCase() === code.toLowerCase())) { setError('Ya existe un cliente con ese código.'); return }
    const client: Client = { id: crypto.randomUUID(), code, name, coordinates: position, createdAt: new Date().toISOString(), neighborhood: area || undefined, visitStatus: 'pending' }
    clientRepository.create(client); setClients((current) => [...current, client]); setShowForm(false); setError('')
  }
  function setVisitStatus(client: Client, visited: boolean) {
    const date = new Date().toISOString(), updated: Client = { ...client, visitStatus: visited ? 'visited' : 'pending', lastVisitAt: visited ? date : undefined }
    const nextClients = clients.map(c => c.id === client.id ? updated : c)
    const nextVisits: Visit[] = visited ? [...visits, { id: crypto.randomUUID(), clientId: client.id, createdAt: date, coordinates: position ?? undefined }] : visits
    try { saveData(nextClients, nextVisits); setClients(nextClients); setVisits(nextVisits) }
    catch { setError('No se pudo guardar la visita. Exporta un respaldo y revisa el espacio del navegador.') }
  }
  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingClient) return
    const form = new FormData(event.currentTarget), code = String(form.get('code') ?? '').trim().toUpperCase(), name = String(form.get('name') ?? '').trim(), area = String(form.get('neighborhood') ?? '').trim(), notes = String(form.get('notes') ?? '').trim()
    if (clients.some((c) => c.id !== editingClient.id && c.code.toLowerCase() === code.toLowerCase())) { setError('Ya existe otro cliente con ese código.'); return }
    const updated: Client = { ...editingClient, code, name, neighborhood: area || undefined, notes: notes || undefined }
    clientRepository.update(updated); setClients((current) => current.map((c) => c.id === updated.id ? updated : c)); setEditingClient(null); setError('')
  }
  function deleteClient(client: Client) {
    if (!window.confirm(`¿Eliminar a ${client.name}? Esta acción no se puede deshacer.`)) return
    clientRepository.remove(client.id); setClients((current) => current.filter((c) => c.id !== client.id)); setVisits((current) => current.filter((v) => v.clientId !== client.id))
  }

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">TU DÍA, MEJOR ORGANIZADO</p><h1>TAT<span className="brand-dot">.</span></h1><p className="subtitle">Cada cliente. Un paso más cerca.</p></div><button className="locate-button" onClick={() => void locate()} disabled={isLocating}>{isLocating ? 'Buscando…' : '⌖ Mi ubicación'}</button></header>
    <section className="status-card" aria-live="polite"><div className="status-icon">📍</div><div><p className="eyebrow">UBICACIÓN ACTUAL</p><p className="status-copy">{message}</p></div></section>
    <section className="summary-grid"><article className="metric"><span>CLIENTES</span><strong>{visible.length}</strong><small>registrados</small></article><article className="metric pending-metric"><span>PENDIENTES</span><strong>{pending.length}</strong><small>por visitar</small></article><article className="nearest-card"><span>TU PRÓXIMA PARADA</span>{nearest ? <><strong>{nearest.client.name}</strong><small>{nearest.client.code} · {formatDistance(nearest.distance)} en línea recta</small><button className="text-button" onClick={() => setSelectedId(nearest.client.id)}>Ver cliente más cercano ↗</button></> : <small>{position ? 'Aún no hay clientes registrados.' : 'Obtén tu ubicación para calcularlo.'}</small>}</article></section>
    <section className="filter-row"><label htmlFor="area">Barrio</label><select id="area" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}><option value="all">Todos los barrios</option>{neighborhoods.map((n) => <option key={n}>{n}</option>)}</select></section>
    <section className="map-section"><div className="map-heading"><h2>Mapa de clientes</h2><span><i className="legend you" /> Tú <i className="legend client" /> Pendiente <i className="legend visited" /> Visitado</span></div><ClientMap clients={visible} position={position} selectedId={selectedId} onSelect={setSelectedId} /></section>
    {selected && <section className="destination-card"><div><p className="eyebrow">CLIENTE SELECCIONADO</p><h2>{selected.name}</h2><p>{selected.code}{selected.neighborhood ? ` · ${selected.neighborhood}` : ''}</p><p>{position ? `${formatDistance(distanceInMeters(position, selected.coordinates))} en línea recta desde ti` : 'Activa tu ubicación para calcular la distancia.'}</p>{selected.notes && <p>{selected.notes}</p>}</div><a className="route-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coordinates.latitude},${selected.coordinates.longitude}${position ? `&origin=${position.latitude},${position.longitude}` : ''}`}>Cómo llegar ↗</a><button className="text-button" onClick={() => setSelectedId(null)}>Cerrar</button></section>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}<button className="primary-action" onClick={openForm}>＋ Registrar cliente aquí</button><button className="secondary-action" onClick={() => setShowClients((value) => !value)}>{showClients ? 'Ocultar clientes' : `Ver clientes y visitas (${visible.length})`}</button>
    {showClients && <section className="client-list"><h2>Clientes {neighborhood === 'all' ? '' : `en ${neighborhood}`}</h2>{visible.length === 0 ? <p className="empty-state">Todavía no hay clientes en esta vista.</p> : [...visible].sort((a, b) => position ? distanceInMeters(position, a.coordinates) - distanceInMeters(position, b.coordinates) : a.name.localeCompare(b.name)).map((client) => { const done = client.visitStatus === 'visited', count = visits.filter((v) => v.clientId === client.id).length; return <article className="client-row" key={client.id}><div><button className="client-name" onClick={() => setSelectedId(client.id)}>{client.name} ↗</button><small>{position ? `${formatDistance(distanceInMeters(position, client.coordinates))} · ` : ''}{client.code}{client.neighborhood ? ` · ${client.neighborhood}` : ''}</small><small>{done ? `✓ Visitado · ${client.lastVisitAt ? new Date(client.lastVisitAt).toLocaleDateString('es-CO') : 'Registrado'}` : '● Pendiente'}{count ? ` · ${count} visita${count === 1 ? '' : 's'}` : ''}</small></div><div className="row-actions"><button className={done ? 'undo-button' : 'visit-button'} onClick={() => setVisitStatus(client, !done)}>{done ? 'Deshacer' : 'Visitar'}</button><button className="edit-button" onClick={() => { setError(''); setEditingClient(client) }}>Editar</button><button className="delete-button" onClick={() => deleteClient(client)} aria-label={`Eliminar ${client.name}`}>×</button></div></article> })}</section>}
    <section className="backup-card"><div><p className="eyebrow">TODO TU RECORRIDO, CONTIGO</p><h2>Tu recorrido, siempre a mano.</h2><p>Guarda clientes, ubicaciones, notas e historial para recuperarlos en esta app o en una versión compatible.</p></div><div className="backup-actions"><button onClick={exportData}>↓ Exportar respaldo</button><button onClick={() => fileInput.current?.click()}>↑ Importar respaldo</button><input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={e => void readImport(e.target.files?.[0])} /></div><small>Los datos se guardan en este navegador. El respaldo incluye ubicaciones y datos de tus clientes.</small></section>
    <section className="history"><p className="eyebrow">TU ACTIVIDAD</p><h2>Historial de visitas <span>{visits.length}</span></h2>{visits.length === 0 ? <p className="empty-state">Tu recorrido comienza con la primera visita.</p> : <ol>{[...visits].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(v => <li key={v.id}><span className="history-dot" /><div><strong>{clients.find(c => c.id === v.clientId)?.name ?? 'Cliente'}</strong><p>{new Date(v.createdAt).toLocaleString('es-CO')}</p>{v.coordinates && <small>{v.coordinates.latitude.toFixed(5)}, {v.coordinates.longitude.toFixed(5)}</small>}</div></li>)}</ol>}</section>
    <footer>TAT · A tu ritmo, en cada visita.</footer>
    {imported && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><h2 id="import-title">Recuperar tu recorrido</h2><p className="import-copy">El archivo contiene {imported.clients.length} clientes y {imported.visits.length} visitas. Se agregarán datos nuevos sin duplicar visitas. Para clientes con el mismo código o identificador, se conservará la ficha actual.</p><button className="primary-action" onClick={confirmImport}>Combinar y guardar</button><button className="secondary-action" onClick={() => setImported(null)}>Cancelar</button></section></div>}
    {showForm && position && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><button className="close" onClick={() => setShowForm(false)} aria-label="Cerrar">×</button><p className="eyebrow">NUEVO CLIENTE</p><h2 id="register-title">Registrar en esta ubicación</h2><p className="coordinate">📍 {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p><form onSubmit={saveClient}><label>Código<input name="code" placeholder="Ej. CL-00458" required maxLength={40} autoFocus /></label><label>Nombre<input name="name" placeholder="Ej. Tienda La Esperanza" required maxLength={100} /></label><label>Barrio <small>(opcional)</small><input name="neighborhood" placeholder="Ej. La Libertad" maxLength={80} /></label><button className="primary-action" type="submit">Guardar cliente</button></form></section></div>}
    {editingClient && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><button className="close" onClick={() => setEditingClient(null)} aria-label="Cerrar">×</button><p className="eyebrow">EDITAR CLIENTE</p><h2 id="edit-title">{editingClient.name}</h2><form onSubmit={saveEdit}><label>Código<input name="code" defaultValue={editingClient.code} required maxLength={40} autoFocus /></label><label>Nombre<input name="name" defaultValue={editingClient.name} required maxLength={100} /></label><label>Barrio <small>(opcional)</small><input name="neighborhood" defaultValue={editingClient.neighborhood} maxLength={80} /></label><label>Observaciones <small>(opcional)</small><textarea name="notes" defaultValue={editingClient.notes} maxLength={500} rows={3} /></label>{error && <p className="form-alert">{error}</p>}<button className="primary-action" type="submit">Guardar cambios</button></form></section></div>}
  </main>
}
