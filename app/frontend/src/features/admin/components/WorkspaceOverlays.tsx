import { useEffect } from 'react'
import { GeoJSON, Rectangle, useMap } from 'react-leaflet'
import type { SectorCollection } from '../data/territory-data'
import type { ResultLayer } from '../data/result-layers'

type Props = { layers: readonly ResultLayer[]; activeId: string; showBounds: boolean; sectors: SectorCollection | null; selectedSectors: ReadonlySet<string>; onSector: (id: string) => void; selectSectors: boolean }
export default function WorkspaceOverlays({ layers, activeId, showBounds, sectors, selectedSectors, onSector, selectSectors }: Props) {
  const map = useMap()
  useEffect(() => {
    const source = 'Setores © IBGE · Censo 2022'
    map.attributionControl.addAttribution(source)
    return () => { map.attributionControl.removeAttribution(source) }
  }, [map])
  return <>
    {showBounds && layers.map((layer) => <Rectangle key={layer.id} bounds={layer.bounds} interactive={false} pathOptions={{ color: layer.color, weight: layer.id === activeId ? 3 : 1.5, fill: false, dashArray: layer.id === activeId ? undefined : '5 6', opacity: .95 }} />)}
    {sectors && <GeoJSON key={selectSectors ? 'select' : 'view'} data={sectors} interactive={selectSectors} style={(feature) => ({ color: selectedSectors.has(String(feature?.id)) ? '#17659c' : '#386a50', weight: selectedSectors.has(String(feature?.id)) ? 2 : 1, fillColor: selectedSectors.has(String(feature?.id)) ? '#2887bd' : '#92c594', fillOpacity: selectedSectors.has(String(feature?.id)) ? .3 : .1 })} onEachFeature={(feature, layer) => { const id = String(feature.id); layer.bindTooltip(`Setor ${id}`); layer.on('click', () => { if (selectSectors) onSector(id) }) }} />}
  </>
}
