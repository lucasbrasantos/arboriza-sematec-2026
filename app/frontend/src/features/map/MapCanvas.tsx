import { useEffect, useMemo, useRef, useState } from 'react'
import { DomEvent, divIcon } from 'leaflet'
import { ImageOverlay, LayerGroup, MapContainer, Marker, Pane, Polyline, Rectangle, ScaleControl, TileLayer, Tooltip, WMSTileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Info, LocateFixed, Minus, Plus, RotateCcw } from 'lucide-react'
import usePrefersReducedMotion from '../../shared/hooks/usePrefersReducedMotion'
import aerialImage from '../../assets/samples/aracatuba.jpg'
import centerImage from '../../assets/samples/centro.jpg'
import northImage from '../../assets/samples/norte.jpg'
import { areas, itemPosition, priorityColors, priorityLabels } from './map-data'
import type { BaseMap, HeatColors, LayerVisibility, MapArea, MapItem, MapView, PointItem } from './map-data'
import HeatmapOverlay from './HeatmapOverlay'
import 'leaflet/dist/leaflet.css'

type MapCanvasProps = {
  area: MapArea
  base: BaseMap
  layers: LayerVisibility
  items: MapItem[]
  selected: MapItem | null
  view: MapView
  heatColors: HeatColors
  leftInset: number
  onSelect: (item: MapItem) => void
  onClear: () => void
}

const leafMarkup = '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 4C12 2 4 6 5 13c1 8 14 8 15-9Z"/><path d="M4 21 16 9M9 16v-5m0 5h5"/></svg></span>'
const pointIcon = divIcon({ className: 'public-tree-marker', html: leafMarkup, iconSize: [34, 34], iconAnchor: [17, 17] })
const selectedIcon = divIcon({ className: 'public-tree-marker is-selected', html: leafMarkup, iconSize: [40, 40], iconAnchor: [20, 20] })

function MapBehavior({ area, selected, leftInset, onClear }: Pick<MapCanvasProps, 'area' | 'selected' | 'leftInset' | 'onClear'>) {
  const reduced = usePrefersReducedMotion()
  const map = useMapEvents({ keydown: (event) => { if (event.originalEvent.key === 'Escape') onClear() } })
  const inset = useRef(leftInset)
  useEffect(() => { inset.current = leftInset }, [leftInset])

  useEffect(() => {
    if (reduced) map.stop()
  }, [map, reduced])

  useEffect(() => {
    map.getContainer().setAttribute('aria-label', 'Mapa de Araçatuba. Use as setas para navegar e mais ou menos para alterar o zoom.')
    map.fitBounds(area.bounds, { paddingTopLeft: [inset.current + 30, 100], paddingBottomRight: [40, 150], maxZoom: 18, animate: false })
  }, [area, map])

  useEffect(() => {
    if (selected) {
      const center = map.project(itemPosition(selected))
      center.x -= inset.current / 2
      map.panTo(map.unproject(center), { animate: !reduced, duration: .25 })
    }
  }, [selected, reduced, map])

  useEffect(() => {
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: true, animate: false }))
    })
    observer.observe(map.getContainer())
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [map])

  return null
}

function MapTools({ area, leftInset }: { area: MapArea; leftInset: number }) {
  const map = useMap()
  const reduced = usePrefersReducedMotion()
  const [zoom, setZoom] = useState(map.getZoom())
  const tools = useRef<HTMLDivElement>(null)
  useEffect(() => { if (tools.current) { DomEvent.disableClickPropagation(tools.current); DomEvent.disableScrollPropagation(tools.current) } }, [])
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  return <div ref={tools} className="map-canvas-tools" role="group" aria-label="Navegação do mapa" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
    <button type="button" aria-label="Aproximar mapa" title="Aproximar" disabled={zoom >= map.getMaxZoom()} onClick={(event) => { event.stopPropagation(); map.zoomIn(undefined, { animate: !reduced }) }}><Plus size={20} /></button>
    <button type="button" aria-label="Afastar mapa" title="Afastar" disabled={zoom <= map.getMinZoom()} onClick={(event) => { event.stopPropagation(); map.zoomOut(undefined, { animate: !reduced }) }}><Minus size={20} /></button>
    <button type="button" aria-label="Centralizar no recorte selecionado" title="Ver recorte completo" onClick={(event) => { event.stopPropagation(); map.fitBounds(area.bounds, { paddingTopLeft: [leftInset + 30, 100], paddingBottomRight: [40, 150], maxZoom: 18, animate: !reduced }) }}><LocateFixed size={19} /></button>
  </div>
}

function BaseLayer({ base }: { base: BaseMap }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const events = {
    loading: () => setState((current) => current === 'error' ? current : 'loading'),
    load: () => setState((current) => current === 'error' ? current : 'ready'),
    tileerror: () => setState('error'),
  }
  return <>
    {base === 'aerial' ? <>
      <Pane name="local-preview" style={{ zIndex: 190 }}>
        <ImageOverlay url={aerialImage} bounds={areas.cidade.bounds} interactive={false} attribution="Ortofotos © IGC-SP / DataGEO" />
        <ImageOverlay url={centerImage} bounds={areas.centro.bounds} interactive={false} />
        <ImageOverlay url={northImage} bounds={areas.norte.bounds} interactive={false} />
      </Pane>
      <WMSTileLayer key={retry} url="https://datageo.ambiente.sp.gov.br/geoimage/datageoimg/ows" layers="ORTOFOTOS_SP_2023_2024" format="image/jpeg" version="1.1.1" tileSize={512} maxNativeZoom={19} maxZoom={20} updateWhenZooming={false} updateWhenIdle keepBuffer={2} eventHandlers={events} />
    </> : <TileLayer key={retry} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxNativeZoom={19} maxZoom={20} updateWhenZooming={false} eventHandlers={events} />}
    {state !== 'ready' && <div className={`map-base-status ${state === 'error' ? 'has-error' : ''}`} role="status">
      <Info size={15} /><span>{state === 'error' ? 'Alguns blocos do mapa não carregaram.' : 'Carregando base cartográfica…'}</span>
      {state === 'error' && <button type="button" onClick={(event) => { event.stopPropagation(); setState('loading'); setRetry((value) => value + 1) }}><RotateCcw size={13} /> Tentar novamente</button>}
    </div>}
  </>
}

export default function MapCanvas({ area, base, layers, items, selected, view, heatColors, leftInset, onSelect, onClear }: MapCanvasProps) {
  const points = useMemo(() => items.filter((item): item is PointItem => item.kind === 'point'), [items])
  return <MapContainer className="public-leaflet-map" bounds={area.bounds} boundsOptions={{ padding: [42, 42], maxZoom: 18 }} minZoom={11} maxZoom={20} zoomControl={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} inertia={false} scrollWheelZoom boxZoom={false}>
    <BaseLayer key={base} base={base} />
    <MapBehavior area={area} selected={selected} leftInset={leftInset} onClear={onClear} />
    <MapTools area={area} leftInset={leftInset} />
    {view === 'density' && layers.points && <HeatmapOverlay points={points} colors={heatColors} />}
    <ScaleControl position="bottomleft" imperial={false} />
    {layers.boundary && area.hasExamples && <LayerGroup>
      <Rectangle bounds={area.bounds} pathOptions={{ color: '#ffffff', weight: 5, dashArray: '7 7', fill: false, opacity: .85 }} interactive={false} />
      <Rectangle bounds={area.bounds} pathOptions={{ color: '#38644a', weight: 2, dashArray: '7 7', fillOpacity: .02 }} interactive={false} />
    </LayerGroup>}
    {items.map((item) => item.kind === 'point' ? layers.points && (view === 'points' || selected?.id === item.id) && <Marker key={item.id} position={item.position} icon={selected?.id === item.id ? selectedIcon : pointIcon} title={`${item.label} — abrir detalhes`} alt={item.label} eventHandlers={{ click: () => onSelect(item) }}>
      <Tooltip direction="top" offset={[0, -18]}>{item.label}</Tooltip>
    </Marker> : layers.segments && <LayerGroup key={item.id}>
      <Polyline positions={item.positions} pathOptions={{ color: '#ffffff', weight: selected?.id === item.id ? 13 : 10, opacity: .9, dashArray: item.priority === 'medium' ? '10 7' : undefined }} interactive={false} />
      <Polyline positions={item.positions} pathOptions={{ color: priorityColors[item.priority], weight: selected?.id === item.id ? 9 : 6, opacity: .95, dashArray: item.priority === 'medium' ? '10 7' : undefined }} eventHandlers={{ click: () => onSelect(item) }}>
        <Tooltip sticky>{item.label} · prioridade ilustrativa {priorityLabels[item.priority].toLowerCase()}</Tooltip>
      </Polyline>
    </LayerGroup>)}
  </MapContainer>
}
