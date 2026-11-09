import { useEffect, useRef } from 'react'
import Leaflet from 'leaflet'
import { useMap } from 'react-leaflet'
import { api } from '../../auth/services/api'

export type TerritoryTool = 'click' | 'box' | 'free'
export type TerritoryOperation = 'replace' | 'add' | 'remove'
type Props = { enabled: boolean; tool: TerritoryTool; operation: TerritoryOperation; selected: ReadonlySet<string>; onSelection: (ids: Set<string>) => void; onBusy: (busy: boolean) => void; onStatus: (message: string) => void }

export default function TerritoryDrawing({ enabled, tool, operation, selected, onSelection, onBusy, onStatus }: Props) {
  const map = useMap()
  const current = useRef({ operation, selected, onSelection, onBusy, onStatus })
  useEffect(() => { current.current = { operation, selected, onSelection, onBusy, onStatus } }, [operation, selected, onSelection, onBusy, onStatus])
  useEffect(() => {
    if (!enabled || tool === 'click') return
    const container = map.getContainer()
    let alive = true
    let request: AbortController | null = null
    let drawing: { pointer: number; start: Leaflet.Point; points: Leaflet.Point[]; layer: Leaflet.Rectangle | Leaflet.Polyline } | null = null
    const endGesture = () => {
      if (!drawing) return
      drawing.layer.remove()
      if (container.hasPointerCapture(drawing.pointer)) container.releasePointerCapture(drawing.pointer)
      drawing = null; map.dragging.enable()
    }
    function down(event: PointerEvent) {
      if (!alive || request || drawing || event.button !== 0 || !event.isPrimary || (event.target as Element | null)?.closest('.leaflet-control, button, input, select, a')) return
      const start = map.mouseEventToContainerPoint(event), latlng = map.containerPointToLatLng(start)
      const layer = tool === 'box' ? Leaflet.rectangle(Leaflet.latLngBounds(latlng, latlng), { color: '#1682bf', weight: 2, fillOpacity: .15, interactive: false }) : Leaflet.polyline([latlng], { color: '#1682bf', weight: 2, interactive: false })
      drawing = { pointer: event.pointerId, start, points: [start], layer: layer.addTo(map) }
      map.dragging.disable(); container.setPointerCapture(event.pointerId); event.preventDefault()
    }
    function move(event: PointerEvent) {
      if (!drawing || drawing.pointer !== event.pointerId) return
      const point = map.mouseEventToContainerPoint(event)
      if (tool === 'box') (drawing.layer as Leaflet.Rectangle).setBounds(Leaflet.latLngBounds(map.containerPointToLatLng(drawing.start), map.containerPointToLatLng(point)))
      else if (point.distanceTo(drawing.points[drawing.points.length - 1] ?? drawing.start) >= 4 && drawing.points.length < 2500) { drawing.points.push(point); (drawing.layer as Leaflet.Polyline).addLatLng(map.containerPointToLatLng(point)) }
    }
    function up(event: PointerEvent) {
      if (!drawing || drawing.pointer !== event.pointerId) return
      const completed = drawing, end = map.mouseEventToContainerPoint(event)
      endGesture()
      let points: Leaflet.Point[]
      if (tool === 'box') {
        if (Math.abs(end.x - completed.start.x) < 5 || Math.abs(end.y - completed.start.y) < 5) { current.current.onStatus('Arraste para desenhar um retângulo com área.'); return }
        points = [completed.start, Leaflet.point(end.x, completed.start.y), end, Leaflet.point(completed.start.x, end.y)]
      } else {
        points = [...completed.points, end]
        if (points.length < 4) { current.current.onStatus('Desenhe uma área com pelo menos três lados.'); return }
      }
      const ring = points.map((point) => { const coordinate = map.containerPointToLatLng(point); return [coordinate.lng, coordinate.lat] })
      const first = ring[0]
      if (!first) return
      ring.push(first)
      request = new AbortController()
      const pending = request, op = current.current.operation
      current.current.onBusy(true); current.current.onStatus('Localizando os setores atingidos…')
      api<{ ids: string[] }>('/territorio/intersecoes', { method: 'POST', body: JSON.stringify({ geometry: { type: 'Polygon', coordinates: [ring] } }), signal: pending.signal }).then((result) => {
        if (!alive || pending.signal.aborted) return
        const next = op === 'replace' ? new Set<string>() : new Set(current.current.selected)
        for (const id of result.ids) { if (op === 'remove') next.delete(id); else next.add(id) }
        current.current.onSelection(next); current.current.onStatus(`${result.ids.length} ${result.ids.length === 1 ? 'setor atingido' : 'setores atingidos'}. A seleção considera setores inteiros.`)
      }).catch((error: unknown) => { if (alive && !pending.signal.aborted) current.current.onStatus(error instanceof Error ? error.message : 'Não foi possível localizar os setores.') })
        .finally(() => { if (alive) { request = null; current.current.onBusy(false) } })
    }
    function cancel() { endGesture(); current.current.onStatus('Desenho cancelado.') }
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape' && drawing) { event.preventDefault(); event.stopPropagation(); cancel() } }
    container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move); container.addEventListener('pointerup', up); container.addEventListener('pointercancel', cancel); window.addEventListener('keydown', keydown, true)
    return () => { alive = false; request?.abort(); endGesture(); current.current.onBusy(false); container.removeEventListener('pointerdown', down); container.removeEventListener('pointermove', move); container.removeEventListener('pointerup', up); container.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', keydown, true) }
  }, [enabled, tool, map])
  return null
}
