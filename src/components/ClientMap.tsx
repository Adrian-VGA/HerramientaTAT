import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Client, Coordinates } from '../types'

type Props = { clients: Client[]; position: Coordinates | null }

const defaultCenter: L.LatLngExpression = [7.8939, -72.5078]

function pin(color: string, label: string) {
  return L.divIcon({
    className: 'map-pin-wrapper',
    html: `<span class="map-pin" style="background:${color}">${label}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

export function ClientMap({ clients, position }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!container.current || map.current) return
    map.current = L.map(container.current, { zoomControl: false }).setView(defaultCenter, 14)
    L.control.zoom({ position: 'bottomright' }).addTo(map.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current)
    markers.current = L.layerGroup().addTo(map.current)
    return () => { map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !markers.current) return
    markers.current.clearLayers()
    const points: L.LatLngExpression[] = []
    if (position) {
      const point: L.LatLngExpression = [position.latitude, position.longitude]
      points.push(point)
      L.marker(point, { icon: pin('#2563eb', 'Tú') }).bindPopup('Tu ubicación actual').addTo(markers.current)
    }
    clients.forEach((client) => {
      const point: L.LatLngExpression = [client.coordinates.latitude, client.coordinates.longitude]
      points.push(point)
      const visited = client.visitStatus === 'visited'
      L.marker(point, { icon: pin(visited ? '#16803c' : '#d58b00', visited ? '✓' : 'C') })
        .bindPopup(`<strong>${escapeHtml(client.name)}</strong><br>${escapeHtml(client.code)}`)
        .addTo(markers.current!)
    })
    if (points.length === 1) map.current.setView(points[0], 16)
    if (points.length > 1) map.current.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 16 })
  }, [clients, position])

  return <div ref={container} className="map" aria-label="Mapa de clientes" />
}

function escapeHtml(value: string) {
  const node = document.createElement('span')
  node.textContent = value
  return node.innerHTML
}
