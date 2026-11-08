import { areas, demoItems } from '../../map/data/map-data'
import type { MapArea, MapItem } from '../../map/data/map-data'
import type { FeatureCollection, Geometry } from 'geojson'
import { api } from '../../auth/services/api'
import { readSectors, sectorBounds } from './territory-data'
import type { SectorCollection } from './territory-data'

export type ResultLayer = {
  id: string
  name: string
  createdAt?: string
  executionId: string
  execution: string
  origin: string
  category: string
  color: string
  bounds: MapArea['bounds']
  items: MapItem[]
  segmentation?: FeatureCollection<Geometry, Record<string, unknown>>
  territory?: { ids: string[]; source: string }
  linkedCrowns?: boolean
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

type CompletedAnalysis = { id: string; state: string; request: { perfil: string } }
type AnalysisTerritory = { ids: string[]; fonte_malha: string }
type UnknownCollection = FeatureCollection<Geometry, Record<string, unknown>>

const resultColors = { primary: '#176b49', groups: '#765699', pending: '#8a6718', segmentation: '#246c94' } as const
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function collection(value: unknown): UnknownCollection | null {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) return null
  return value as unknown as UnknownCollection
}

async function readLayer(id: string, name: string): Promise<UnknownCollection> {
  const data = collection(await api<unknown>(`/analises/${encodeURIComponent(id)}/camadas/${name}`))
  if (!data) throw new Error(`A camada ${name} retornou GeoJSON inválido.`)
  return data
}

export async function loadAnalysisResultLayers(job: CompletedAnalysis, currentTerritory: SectorCollection | null): Promise<ResultLayer[]> {
  if (job.state !== 'concluida') return []
  const territory = await api<AnalysisTerritory>(`/analises/${encodeURIComponent(job.id)}/territorio`)
  const sectors = currentTerritory ?? readSectors(await api<unknown>('/territorio/setores'))
  const knownIds = new Set(sectors.features.map((feature) => String(feature.id)))
  if (!Array.isArray(territory.ids) || !territory.ids.length || territory.fonte_malha !== sectors.arboriza.sha256_fonte || territory.ids.some((id) => !knownIds.has(id))) throw new Error('A malha territorial da análise não corresponde à versão disponível. Não foi possível restaurar sua área.')
  const territoryBounds = sectorBounds(sectors, new Set(territory.ids))
  if (!territoryBounds) throw new Error('Não foi possível recuperar os limites dos setores da análise.')
  const fusion = job.request.perfil === 'fusao'
  const names = fusion ? ['pontos', 'pontos-grupos', 'pontos-complementos', 'copas'] : ['pontos']
  const values = await Promise.all(names.map((name) => readLayer(job.id, name)))
  const source = new Map(names.map((name, index) => [name, values[index] ?? null]))
  if (fusion) {
    const crowns = source.get('copas')?.features ?? []
    const byId = new Map<string, string>()
    for (const crown of crowns) {
      const id = crown.properties?.copa_id
      const kind = crown.properties?.tipo
      if (typeof id !== 'string' || !id || crown.id !== id || byId.has(id) || typeof kind !== 'string' || !['copa_individual', 'grupo_de_copas', 'complemento_pendente'].includes(kind) || !['Polygon', 'MultiPolygon'].includes(crown.geometry?.type ?? '')) throw new Error('A segmentação contém vínculos de copas inválidos ou duplicados.')
      byId.set(id, kind)
    }
    const seen = new Set<string>()
    for (const name of ['pontos', 'pontos-grupos', 'pontos-complementos']) for (const point of source.get(name)?.features ?? []) {
      const id = point.properties?.copa_id
      const coordinates = point.geometry?.type === 'Point' ? point.geometry.coordinates : []
      if (typeof id !== 'string' || !id || point.id !== id || seen.has(id) || byId.get(id) !== point.properties?.tipo || coordinates.length < 2 || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[0] ?? Infinity) > 180 || Math.abs(coordinates[1] ?? Infinity) > 90) throw new Error('Há pontos sem copa correspondente ou vínculos duplicados nesta análise.')
      seen.add(id)
    }
    if (seen.size !== byId.size) throw new Error('Há copas sem ponto correspondente nesta análise.')
  }
  const execution = `Análise ${job.id}`
  const modelLabel = job.request.perfil === 'fusao' ? 'Modelo v2 · Restor + Cambridge' : `Controle · ${job.request.perfil}`
  const output: ResultLayer[] = []
  const itemCollection = (name: string, category: string, color: string) => {
    const data = source.get(name)
    if (!data) return
    const items: MapItem[] = data.features.flatMap((feature, index) => {
      if (feature.geometry?.type !== 'Point') return []
      const [longitude, latitude] = feature.geometry.coordinates
      if (typeof longitude !== 'number' || typeof latitude !== 'number' || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return []
      const properties = isRecord(feature.properties) ? feature.properties : {}
      const rawScore = properties.score
      const scoreLabel = typeof rawScore === 'number' && Number.isFinite(rawScore) ? ` · score ${rawScore.toFixed(2)}` : ''
      const id = String(feature.id ?? `${name}-${index + 1}`)
      const itemLabel = category === 'Individuais' ? 'Possível árvore' : category === 'Grupos de copas' ? 'Grupo de copas' : category === 'Complementos pendentes' ? 'Complemento pendente' : 'Ponto detectado'
      return [{ id: `${job.id}:${name}:${id}`, area: 'cidade' as const, kind: 'point' as const,
        label: `${itemLabel} ${index + 1}${scoreLabel}`, position: [latitude, longitude] as [number, number], properties }]
    })
    output.push({ id: `${job.id}:${name}`, name: `${modelLabel} · ${category}`, executionId: job.id, execution,
      origin: 'Análise real · resultado do backend', category, color, bounds: territoryBounds, items, territory: { ids: territory.ids, source: territory.fonte_malha }, linkedCrowns: fusion })
  }
  itemCollection('pontos', fusion ? 'Individuais' : 'Pontos detectados', resultColors.primary)
  if (fusion) {
    itemCollection('pontos-grupos', 'Grupos de copas', resultColors.groups)
    itemCollection('pontos-complementos', 'Complementos pendentes', resultColors.pending)
    const segmentation = source.get('copas')
    if (segmentation) output.push({ id: `${job.id}:copas`, name: `${modelLabel} · Segmentação`, executionId: job.id, execution,
      origin: 'Análise real · polígonos de copa do backend', category: 'Segmentação de copas', color: resultColors.segmentation,
      bounds: territoryBounds, items: [], segmentation, territory: { ids: territory.ids, source: territory.fonte_malha }, linkedCrowns: true })
  }
  if (!output.length) throw new Error('A API concluiu a análise, mas não retornou camadas GeoJSON disponíveis.')
  return output
}
