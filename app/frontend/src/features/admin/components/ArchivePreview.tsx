import { CircleMarker, MapContainer, Pane, TileLayer, WMSTileLayer } from 'react-leaflet'
import type { PointItem } from '../../map/data/map-data'
import type { WorkspaceSnapshot } from '../data/workspace-files'
import 'leaflet/dist/leaflet.css'

export default function ArchivePreview({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const layers = snapshot.layers.filter((layer) => snapshot.visible_ids.includes(layer.id))
  const points = layers.flatMap((layer) => layer.items.filter((item): item is PointItem => item.kind === 'point').map((point) => ({ point, color: layer.color })))
  if (!points.length) return <p>Nenhum ponto visível neste pacote.</p>
  const bounds = layers.map((layer) => layer.bounds)
  const extent: [[number, number], [number, number]] = [[Math.min(...bounds.map((value) => value[0][0])), Math.min(...bounds.map((value) => value[0][1]))], [Math.max(...bounds.map((value) => value[1][0])), Math.max(...bounds.map((value) => value[1][1]))]]
  return <figure className="archive-preview"><MapContainer key={snapshot.active_id} bounds={extent} boundsOptions={{ padding: [15, 15], maxZoom: 17 }} maxZoom={21} zoomControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} keyboard={false} preferCanvas attributionControl><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxNativeZoom={19} maxZoom={21} attribution="© OpenStreetMap contributors" /><WMSTileLayer url="https://datageo.ambiente.sp.gov.br/geoimage/datageoimg/ows" layers="ORTOFOTOS_SP_2023_2024" format="image/jpeg" version="1.1.1" tileSize={512} minZoom={12} maxNativeZoom={19} maxZoom={21} attribution="Ortofotos © IGC-SP / DataGEO e acervo local" /><Pane name="archive-local-orthophotos" style={{ zIndex: 230 }}><TileLayer url="/api/imagery/tiles/{z}/{x}/{y}.webp" minZoom={14} maxNativeZoom={19} maxZoom={21} bounds={[[-22, -51], [-20.5, -50]]} /></Pane>{points.map(({ point, color }) => <CircleMarker key={point.id} center={point.position} radius={3} interactive={false} pathOptions={{ color: '#fff', weight: 1, fillColor: color, fillOpacity: .9 }} />)}</MapContainer><figcaption>Prévia das camadas visíveis sobre a imagem aérea</figcaption></figure>
}
