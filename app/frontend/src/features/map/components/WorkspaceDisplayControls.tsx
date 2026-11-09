import { useEffect, useRef, useState } from 'react'
import { DomEvent } from 'leaflet'
import { useMapEvents } from 'react-leaflet'
import { Check, Copy, Layers, Map, Satellite } from 'lucide-react'
import type { BaseMap, LayerVisibility, MapView } from '../data/map-data'

type Props = { densityScope: 'visible' | 'active'; densityStats: { total: number; unique: number }; onDensityScope: (scope: 'visible' | 'active') => void; base: BaseMap; view: MapView; layers: LayerVisibility; crowns: boolean; onBase: (base: BaseMap) => void; onView: (view: MapView) => void; onLayer: (key: keyof LayerVisibility, value: boolean) => void }
export default function MapDisplayControls({ densityStats, base, view, layers, crowns, onBase, onView, onLayer }: Props) {
  const [open, setOpen] = useState(false)
  const [coordinate, setCoordinate] = useState<[number, number] | null>(null)
  const [copy, setCopy] = useState('')
  const root = useRef<HTMLDivElement>(null)
  useMapEvents({ mousemove: (event) => setCoordinate([event.latlng.lat, event.latlng.lng]) })
  useEffect(() => { if (root.current) { DomEvent.disableClickPropagation(root.current); DomEvent.disableScrollPropagation(root.current) } }, [])
  async function copyCoordinates() {
    if (!coordinate) return
    try { await navigator.clipboard.writeText(coordinate.map((value) => value.toFixed(6)).join(', ')); setCopy('Coordenadas copiadas') }
    catch { setCopy('Não foi possível copiar. Tente novamente.') }
  }
  return <div ref={root} className="map-display-controls" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}>
    {open && <div className="map-display-menu" role="group" aria-label="Visualização das camadas"><strong>Visualização do mapa</strong><label><input type="checkbox" checked={layers.points} onChange={(event) => onLayer('points', event.target.checked)} />Mostrar pontos</label><label><input type="checkbox" checked={view === 'density'} onChange={(event) => onView(event.target.checked ? 'density' : 'points')} />Densidade de pontos</label><label><input type="checkbox" checked={layers.segments} disabled={!crowns} onChange={(event) => onLayer('segments', event.target.checked)} />Mostrar copas</label><small>{densityStats.unique.toLocaleString('pt-BR')} posições únicas · {densityStats.total - densityStats.unique} repetições removidas. Camadas de execuções diferentes podem representar as mesmas árvores em posições próximas. A densidade representa concentração de pontos.</small></div>}
    {/* {open && crowns && <div className="map-crown-legend" aria-label="Legenda das copas"><span style={{ color: '#25b882' }}>● Individuais</span><span style={{ color: '#f1aa43' }}>● Grupos</span><span style={{ color: '#53aff0' }}>● Complementos pendentes</span><span style={{ color: '#1683e0' }}>● Seleção</span></div>} */}
    <button type="button" aria-label="Opções de visualização" aria-expanded={open} onClick={() => setOpen(!open)}><Layers size={18} /></button>
    <button type="button" className="map-base-switch" onClick={() => onBase(base === 'aerial' ? 'streets' : 'aerial')} aria-label={base === 'aerial' ? 'Alternar para mapa de ruas' : 'Alternar para imagem aérea'}>{base === 'aerial' ? <Map size={22} /> : <Satellite size={22} />}<span>{base === 'aerial' ? 'Ruas' : 'Imagem aérea'}</span></button>
    <button type="button" className="map-coordinate-copy" disabled={!coordinate} onClick={() => void copyCoordinates()} title="Copiar latitude e longitude">{copy === 'Coordenadas copiadas' ? <Check size={12} /> : <Copy size={12} />}{coordinate ? coordinate.map((value) => value.toFixed(6)).join(', ') : 'Mova o cursor sobre o mapa'}</button><span className="sr-only" role="status">{copy}</span>
  </div>
}
