import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Client, Coordinates } from '../types'

type Props = { clients: Client[]; position: Coordinates | null; selectedId: string | null; onSelect: (id: string) => void }
const defaultCenter: L.LatLngExpression = [7.8939, -72.5078]
function pin(color: string, label: string) {
  return L.divIcon({ className:'map-pin-wrapper', html:`<span class="map-pin" style="background:${color}">${label}</span>`, iconSize:[32,32], iconAnchor:[16,16] })
}
export function ClientMap({ clients, position, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const locationMarker = useRef<L.Marker | null>(null)
  const accuracyCircle = useRef<L.Circle | null>(null)
  const hadLocation = useRef(false)
  useEffect(() => {
    if (!container.current || map.current) return
    map.current = L.map(container.current, {zoomControl:false}).setView(defaultCenter,14)
    L.control.zoom({position:'bottomright'}).addTo(map.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map.current)
    markers.current = L.layerGroup().addTo(map.current)
    return () => { map.current?.remove(); map.current=null; locationMarker.current=null; accuracyCircle.current=null; hadLocation.current=false }
  }, [])
  useEffect(() => {
    if (!map.current || !markers.current) return
    markers.current.clearLayers()
    clients.forEach(client => {
      const visited=client.visitStatus==='visited'
      L.marker([client.coordinates.latitude,client.coordinates.longitude], {icon:pin(client.id===selectedId?'#007aff':visited?'#34a36d':'#8e8e93',visited?'✓':'C')})
        .bindPopup(`<strong>${escapeHtml(client.name)}</strong><br>${escapeHtml(client.code)}${client.neighborhood?`<br>${escapeHtml(client.neighborhood)}`:''}`)
        .on('click',()=>onSelect(client.id)).addTo(markers.current!)
    })
    const selected=clients.find(c=>c.id===selectedId)
    if (selected) { map.current.setView([selected.coordinates.latitude,selected.coordinates.longitude],17); return }
    const points: L.LatLngExpression[]=clients.map(c=>[c.coordinates.latitude,c.coordinates.longitude])
    if (locationMarker.current) points.push(locationMarker.current.getLatLng())
    if (points.length===1) map.current.setView(points[0],16)
    if (points.length>1) map.current.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:16})
  },[clients,selectedId,onSelect])
  useEffect(() => {
    if (!map.current || !position) return
    const point: L.LatLngExpression=[position.latitude,position.longitude]
    if (!locationMarker.current) locationMarker.current=L.marker(point,{icon:pin('#2563eb','Tú')}).bindPopup('Tu ubicación actual').addTo(map.current)
    else locationMarker.current.setLatLng(point)
    if (!accuracyCircle.current) accuracyCircle.current=L.circle(point,{radius:position.accuracy??0,color:'#007aff',weight:1,fillOpacity:.08,interactive:false}).addTo(map.current)
    else accuracyCircle.current.setLatLng(point).setRadius(position.accuracy??0)
    if (!hadLocation.current && !selectedId) map.current.setView(point,16)
    hadLocation.current=true
  },[position,selectedId])
  return <div ref={container} className="map" aria-label="Mapa de clientes" />
}
function escapeHtml(value:string) { const node=document.createElement('span'); node.textContent=value; return node.innerHTML }
