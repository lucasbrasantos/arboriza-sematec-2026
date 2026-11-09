import { useEffect, useRef } from 'react'
import Leaflet from 'leaflet'
import { useMap } from 'react-leaflet'
import type { Coordinate, PointItem } from '../../map/data/map-data'
import type { ResultLayer } from '../data/result-layers'
import type { PointTool } from './PointToolbar'

type Props = { enabled: boolean; tool: PointTool; layer: ResultLayer; selected: ReadonlySet<string>; busy: boolean; onPick: (point: PointItem, additive: boolean) => void; onSelectMany: (ids: string[], additive: boolean) => void; onClear: () => void; onAdd: (point: Coordinate) => void; onMove: (points: Map<string, Coordinate>) => void; onStatus: (message: string) => void; onSuppressClick: () => void }

export default function PointEditingMap({ enabled, tool, layer, selected, busy, onPick, onSelectMany, onClear, onAdd, onMove, onStatus, onSuppressClick }: Props) {
  const map = useMap()
  const current = useRef({ layer, selected, busy, onPick, onSelectMany, onClear, onAdd, onMove, onStatus, onSuppressClick })
  useEffect(() => { current.current = { layer, selected, busy, onPick, onSelectMany, onClear, onAdd, onMove, onStatus, onSuppressClick } }, [layer, selected, busy, onPick, onSelectMany, onClear, onAdd, onMove, onStatus, onSuppressClick])
  useEffect(() => {
    if (!enabled) return
    const container = map.getContainer()
    type Gesture = { pointer: number; start: Leaflet.Point; additive: boolean; type: 'box' | 'move'; moved: boolean; point?: PointItem; origins: { id: string; screen: Leaflet.Point }[]; rectangle?: Leaflet.Rectangle; ghost?: Leaflet.LayerGroup; ghosts?: Leaflet.CircleMarker[]; coordinates?: Map<string, Coordinate> }
    let gesture: Gesture | null = null
    let ignoreClickUntil = 0
    function finish() {
      if (!gesture) return
      gesture.rectangle?.remove(); gesture.ghost?.remove()
      if (container.hasPointerCapture(gesture.pointer)) container.releasePointerCapture(gesture.pointer)
      gesture = null; map.dragging.enable()
    }
    function down(event: PointerEvent) {
      if (current.current.busy || gesture || event.button !== 0 || !event.isPrimary || (event.target as Element | null)?.closest('.leaflet-control, button, input, select, a')) return
      if (tool === 'add') return
      const start = map.mouseEventToContainerPoint(event), points = current.current.layer.items.filter((item): item is PointItem => item.kind === 'point')
      const additive = event.ctrlKey || event.metaKey || event.shiftKey
      const hit = points.find((item) => map.latLngToContainerPoint(item.position).distanceTo(start) <= (item.properties?.analise_id ? 10 : 18))
      if (tool === 'select' && (!hit || additive || current.current.layer.linkedCrowns)) return
      if (tool === 'move' && !current.current.selected.size) { current.current.onStatus('Selecione pontos antes de usar a ferramenta Mover.'); return }
      if (tool === 'move' || tool === 'select') {
        const chosen = tool === 'select' && hit && !current.current.selected.has(hit.id) ? new Set([hit.id]) : current.current.selected
        if (tool === 'select' && hit && !current.current.selected.has(hit.id)) current.current.onPick(hit, false)
        gesture = { pointer: event.pointerId, start, additive, type: 'move', moved: false, ...(hit ? { point: hit } : {}), origins: points.filter((item) => chosen.has(item.id)).map((item) => ({ id: item.id, screen: map.latLngToContainerPoint(item.position) })) }
      } else {
        const pos = map.containerPointToLatLng(start)
        gesture = { pointer: event.pointerId, start, additive, type: 'box', moved: false, origins: [], rectangle: Leaflet.rectangle(Leaflet.latLngBounds(pos, pos), { color: '#1682bf', weight: 2, fillOpacity: .12, interactive: false }).addTo(map) }
      }
      map.dragging.disable(); container.setPointerCapture(event.pointerId); event.preventDefault()
    }
    function move(event: PointerEvent) {
      if (!gesture || gesture.pointer !== event.pointerId) return
      const point = map.mouseEventToContainerPoint(event)
      if (gesture.type === 'box') gesture.rectangle?.setBounds(Leaflet.latLngBounds(map.containerPointToLatLng(gesture.start), map.containerPointToLatLng(point)))
      else if (point.distanceTo(gesture.start) > 4) {
        gesture.moved = true
        const delta = point.subtract(gesture.start)
        if (!gesture.ghost) { gesture.ghost = Leaflet.layerGroup().addTo(map); gesture.ghosts = gesture.origins.map((origin) => Leaflet.circleMarker(map.containerPointToLatLng(origin.screen), { radius: 6, color: '#1682bf', weight: 2, fillColor: '#5fc4f2', fillOpacity: .75, interactive: false }).addTo(gesture?.ghost as Leaflet.LayerGroup)) }
        gesture.coordinates = new Map(gesture.origins.map((origin, index) => { const value = map.containerPointToLatLng(origin.screen.add(delta)); gesture?.ghosts?.[index]?.setLatLng(value); return [origin.id, [value.lat, value.lng]] }))
      }
    }
    function up(event: PointerEvent) {
      if (!gesture || gesture.pointer !== event.pointerId) return
      const completed = gesture, end = map.mouseEventToContainerPoint(event)
      const bounds = completed.rectangle?.getBounds()
      finish(); ignoreClickUntil = performance.now() + 350
      if (completed.type === 'box' && bounds && completed.start.distanceTo(end) >= 5) {
        const ids = current.current.layer.items.filter((item): item is PointItem => item.kind === 'point').filter((item) => bounds.contains(item.position)).map((item) => item.id)
        current.current.onSelectMany(ids, completed.additive); current.current.onStatus(`${ids.length} ${ids.length === 1 ? 'ponto encontrado' : 'pontos encontrados'} no retângulo.`)
      } else if (completed.type === 'move' && completed.moved && completed.coordinates?.size) current.current.onMove(completed.coordinates)
      else if (completed.type === 'move' && tool === 'select' && completed.point) current.current.onPick(completed.point, false)
      current.current.onSuppressClick()
    }
    function click(event: Leaflet.LeafletMouseEvent) {
      if (current.current.busy || performance.now() < ignoreClickUntil) return
      if (tool === 'add') current.current.onAdd([event.latlng.lat, event.latlng.lng])
      else if (tool === 'select' && !(event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey)) current.current.onClear()
    }
    function cancel() { finish(); current.current.onStatus('Operação cancelada.') }
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape' && gesture) { event.preventDefault(); event.stopPropagation(); cancel() } }
    container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move); container.addEventListener('pointerup', up); container.addEventListener('pointercancel', cancel); window.addEventListener('keydown', keydown, true); map.on('click', click)
    return () => { finish(); container.removeEventListener('pointerdown', down); container.removeEventListener('pointermove', move); container.removeEventListener('pointerup', up); container.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', keydown, true); map.off('click', click) }
  }, [enabled, tool, map])
  return null
}
