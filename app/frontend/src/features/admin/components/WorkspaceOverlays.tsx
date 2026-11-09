import { useEffect, useMemo, useRef } from 'react'
import type { FeatureCollection, Geometry } from 'geojson'
import type { GeoJSON as LeafletGeoJSON, LeafletMouseEvent } from 'leaflet'
import { GeoJSON, Rectangle, useMap } from 'react-leaflet'
import type { SectorCollection } from '../data/territory-data'
import type { ResultLayer } from '../data/result-layers'
import type { PointItem } from '../../map/data/map-data'

type Props = { layers: readonly ResultLayer[]; allLayers: readonly ResultLayer[]; visibleIds: ReadonlySet<string>; selectedIds: ReadonlySet<string>; activeId: string; showBounds: boolean; showSegmentation: boolean; sectors: SectorCollection | null; selectedSectors: ReadonlySet<string>; onSector: (id: string) => void; selectSectors: boolean; crownsInteractive: boolean; onCrownSelect: (point: PointItem, additive: boolean) => void }

function CrownOverlay({ data, points, selectedIds, interactive, onSelect }: { data: FeatureCollection<Geometry, Record<string, unknown>>; points: ReadonlyMap<string, PointItem>; selectedIds: ReadonlySet<string>; interactive: boolean; onSelect: (point: PointItem, additive: boolean) => void }) {
  const ref = useRef<LeafletGeoJSON>(null)
  const current = useRef({ points, onSelect, interactive })
  useEffect(() => { current.current = { points, onSelect, interactive } }, [points, onSelect, interactive])
  useEffect(() => { const layer = ref.current; if (layer) { layer.clearLayers(); layer.addData(data) } }, [data])
  return <GeoJSON ref={ref} data={data} interactive={interactive} bubblingMouseEvents={false} style={(feature) => {
    const point = points.get(String(feature?.properties?.copa_id ?? feature?.id))
    const chosen = point && selectedIds.has(point.id)
    const kind = feature?.properties?.tipo
    const color = chosen ? '#1683e0' : kind === 'grupo_de_copas' ? '#f1aa43' : kind === 'complemento_pendente' ? '#53aff0' : '#25b882'
    return { color, weight: chosen ? 3 : 2, fillColor: color, fillOpacity: chosen ? .3 : .18, dashArray: kind === 'complemento_pendente' ? '3 3' : undefined }
  }} onEachFeature={(feature, layer) => layer.on('click', (event: LeafletMouseEvent) => {
    const point = current.current.points.get(String(feature.properties?.copa_id ?? feature.id))
    if (point && current.current.interactive) current.current.onSelect(point, Boolean(event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey))
  })} />
}

export default function WorkspaceOverlays({ layers, allLayers, visibleIds, selectedIds, showBounds, showSegmentation, sectors, selectedSectors, onSector, selectSectors, crownsInteractive, onCrownSelect }: Props) {
  const map = useMap()
  const crownLayers = useMemo(() => layers.flatMap((layer) => {
    if (!layer.segmentation) return []
    const points = new Map<string, PointItem>()
    for (const member of allLayers) if (member.executionId === layer.executionId && member.linkedCrowns && !member.segmentation && visibleIds.has(member.id)) for (const item of member.items) {
      if (item.kind === 'point' && typeof item.properties?.copa_id === 'string') points.set(item.properties.copa_id, item)
    }
    const data = { ...layer.segmentation, features: layer.segmentation.features.filter((feature) => points.has(String(feature.properties?.copa_id ?? feature.id))) }
    return [{ id: layer.id, data, points }]
  }), [layers, allLayers, visibleIds])
  useEffect(() => {
    const source = 'Setores © IBGE · Censo 2022'
    map.attributionControl.addAttribution(source)
    return () => { map.attributionControl.removeAttribution(source) }
  }, [map])
  return <>
    {showBounds && layers.filter((layer) => !layer.segmentation).filter((layer, index, points) => points.findIndex((other) => other.executionId === layer.executionId) === index).map((layer) => <Rectangle key={layer.id} bounds={layer.bounds} interactive={false} pathOptions={{ color: '#F39D24', weight: 4, dashArray: '6 5', fillColor: '#F39D24', fillOpacity: .15, interactive: false }} />)}
    {showSegmentation && crownLayers.map((layer) => <CrownOverlay key={`segmentation:${layer.id}`} data={layer.data} points={layer.points} selectedIds={selectedIds} interactive={crownsInteractive} onSelect={onCrownSelect} />)}
    {sectors && <GeoJSON key={selectSectors ? 'select' : 'view'} data={sectors} interactive={selectSectors} style={(feature) => selectedSectors.has(String(feature?.id)) ? { color: '#075b8e', weight: 1.25, fillColor: '#2389bd', fillOpacity: .3 } : { color: '#386a50', weight: .8, fillColor: '#92c594', fillOpacity: .08 }} onEachFeature={(feature, layer) => { const id = String(feature.id); layer.bindTooltip(`Setor ${id}`); layer.on('click', (event) => { if (selectSectors) { onSector(id); requestAnimationFrame(() => (event.originalEvent.target as SVGElement).blur?.()) } }) }} />}
  </>
}
