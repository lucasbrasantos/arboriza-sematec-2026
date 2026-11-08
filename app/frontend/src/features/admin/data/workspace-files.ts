import type { ResultLayer } from './result-layers'
import type { Feature } from 'geojson'

export type WorkspaceSnapshot = { layers: ResultLayer[]; visible_ids: string[]; active_id: string }
export function workspaceGeoJSON(snapshot: WorkspaceSnapshot) {
  const living = new Set(snapshot.layers.flatMap((layer) => layer.items.flatMap((item) => typeof item.properties?.copa_id === 'string' ? [`${layer.executionId}:${item.properties.copa_id}`] : [])))
  const features = snapshot.layers.flatMap<Feature>((layer) => layer.segmentation ? layer.segmentation.features.filter((feature) => living.has(`${layer.executionId}:${feature.properties?.copa_id}`)) : layer.items.flatMap((item) => item.kind === 'point' ? [{ type: 'Feature' as const, id: item.id, properties: { ...item.properties, camada: layer.id, nome: item.label }, geometry: { type: 'Point' as const, coordinates: [item.position[1], item.position[0]] } }] : []))
  return { type: 'FeatureCollection', features, arboriza: { workspace: snapshot } }
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/geo+json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
