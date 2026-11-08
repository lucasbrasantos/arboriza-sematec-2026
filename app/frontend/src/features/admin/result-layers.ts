import { areas, demoItems } from '../map/map-data'
import type { MapArea, MapItem } from '../map/map-data'

export type ResultLayer = {
  id: string
  name: string
  executionId: string
  execution: string
  origin: 'Análise demonstrativa' | 'Importação demonstrativa'
  category: 'Individuais' | 'Grupos' | 'Pendentes'
  color: string
  bounds: MapArea['bounds']
  items: MapItem[]
}

function sample(id: string, name: string, execution: { id: string; label: string }, source: MapItem[], bounds: MapArea['bounds'], color: string, category: ResultLayer['category'] = 'Individuais', origin: ResultLayer['origin'] = 'Análise demonstrativa'): ResultLayer {
  return { id, name, executionId: execution.id, execution: execution.label, origin, category, color, bounds, items: source.map((item) => ({ ...item, id: `${id}:${item.id}`, label: `${name} · ${item.label}` })) }
}
const center = demoItems.filter((item) => item.area === 'centro')
const north = demoItems.filter((item) => item.area === 'norte')
// Registros fictícios, sem máscaras ou resultados produzidos por modelos.
export const resultLayers = [
  sample('centro-a', 'Centro · individuais', { id: 'demo-centro-a', label: 'Centro · execução A' }, center, areas.centro.bounds, '#246b45'),
  sample('centro-grupos', 'Centro · grupos de exemplo', { id: 'demo-centro-a', label: 'Centro · execução A' }, center.filter((item) => item.kind === 'point').slice(0, 2), areas.centro.bounds, '#765699', 'Grupos'),
  sample('centro-pendentes', 'Centro · propostas pendentes', { id: 'demo-centro-a', label: 'Centro · execução A' }, center.filter((item) => item.kind === 'point').slice(2, 3), areas.centro.bounds, '#8a6718', 'Pendentes'),
  sample('norte-import', 'Centro-norte · importação', { id: 'demo-importacao-norte', label: 'Arquivo importado · exemplo' }, north, areas.norte.bounds, '#2b6685', 'Individuais', 'Importação demonstrativa'),
  sample('centro-b', 'Centro · comparação B', { id: 'demo-centro-b', label: 'Centro · execução B' }, center.slice(0, 4), areas.centro.bounds, '#a04f43'),
  sample('vazio', 'Centro · resultado vazio', { id: 'demo-vazio', label: 'Execução sem candidatos · exemplo' }, [], areas.centro.bounds, '#6d775e'),
] as const satisfies readonly ResultLayer[]

export function combineBounds(layers: readonly ResultLayer[]): MapArea['bounds'] | null {
  if (!layers.length) return null
  return [[Math.min(...layers.map((layer) => layer.bounds[0][0])), Math.min(...layers.map((layer) => layer.bounds[0][1]))], [Math.max(...layers.map((layer) => layer.bounds[1][0])), Math.max(...layers.map((layer) => layer.bounds[1][1]))]]
}

export function rectangleArea(bounds: MapArea['bounds']): number {
  const radians = Math.PI / 180
  return Math.abs(6371008.8 ** 2 * (Math.sin(bounds[1][0] * radians) - Math.sin(bounds[0][0] * radians)) * (bounds[1][1] - bounds[0][1]) * radians)
}
