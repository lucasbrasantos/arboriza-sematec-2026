import { useEffect, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import type { MapArea } from '../map/map-data'

export type SectorProperties = { CD_SETOR: string; AREA_KM2: number }
export type SectorCollection = FeatureCollection<Polygon, SectorProperties>
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function readSectors(value: unknown): SectorCollection {
  if (!isObject(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) throw new Error('Arquivo territorial inválido.')
  if (!isObject(value.arboriza) || value.arboriza.codigo_municipio !== '3502804' || value.arboriza.crs_geojson !== 'EPSG:4326' || value.arboriza.situacao !== 'Urbana') throw new Error('A malha precisa conter os setores urbanos de Araçatuba em coordenadas WGS84.')
  const seen = new Set<string>()
  const features: SectorCollection['features'] = value.features.map((feature: unknown) => {
    if (!isObject(feature) || feature.type !== 'Feature' || typeof feature.id !== 'string' || !/^\d{15}$/.test(feature.id) || seen.has(feature.id) || !isObject(feature.properties) || feature.properties.CD_SETOR !== feature.id || typeof feature.properties.AREA_KM2 !== 'number' || !Number.isFinite(feature.properties.AREA_KM2) || feature.properties.AREA_KM2 < 0 || !isObject(feature.geometry) || feature.geometry.type !== 'Polygon' || !Array.isArray(feature.geometry.coordinates) || !feature.geometry.coordinates.length) throw new Error('A malha contém setor inválido ou repetido.')
    if (feature.properties.CD_MUN !== '3502804' || feature.properties.SITUACAO !== 'Urbana') throw new Error('Foi encontrado um setor fora do recorte urbano de Araçatuba.')
    seen.add(feature.id)
    const coordinates = feature.geometry.coordinates.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error('Polígono territorial inválido.')
      const positions = ring.map((point: unknown) => {
        if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number' || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Coordenadas territoriais inválidas.')
        return [point[0], point[1]]
      })
      const first = positions[0], last = positions.at(-1)
      if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) throw new Error('Anel territorial não fechado.')
      return positions
    })
    return { type: 'Feature', id: feature.id, properties: { CD_SETOR: feature.id, AREA_KM2: feature.properties.AREA_KM2 }, geometry: { type: 'Polygon', coordinates } }
  })
  if (!features.length) throw new Error('A malha territorial está vazia.')
  return { type: 'FeatureCollection', features }
}

export function useTerritoryData(enabled: boolean) {
  const [collection, setCollection] = useState<SectorCollection | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || collection) return
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/setores-urbanos-aracatuba-ibge-2022.geojson`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('Não foi possível carregar a malha territorial.'); return readSectors(await response.json()) })
      .then((data) => { if (!controller.signal.aborted) { setCollection(data); setError('') } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha ao carregar os setores.') })
    return () => controller.abort()
  }, [enabled, collection, attempt])
  return { collection, error, retry: () => { setError(''); setAttempt((value) => value + 1) } }
}

export function sectorBounds(collection: SectorCollection, ids: ReadonlySet<string>): MapArea['bounds'] | null {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity
  for (const feature of collection.features) if (ids.has(String(feature.id))) for (const ring of feature.geometry.coordinates) for (const point of ring) {
    const [lng, lat] = point
    if (lng === undefined || lat === undefined) continue
    south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lng); east = Math.max(east, lng)
  }
  return Number.isFinite(south) ? [[south, west], [north, east]] : null
}
