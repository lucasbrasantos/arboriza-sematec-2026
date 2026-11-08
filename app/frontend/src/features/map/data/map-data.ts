export type Coordinate = [latitude: number, longitude: number]
export type AreaId = 'centro' | 'norte' | 'cidade'
export type BaseMap = 'aerial' | 'streets'
export type MapView = 'points' | 'density'
export type HeatPalette = 'forest' | 'sun' | 'blue' | 'custom'
export type HeatColors = { low: string; high: string }
export const heatPalettes: Record<Exclude<HeatPalette, 'custom'>, { label: string; colors: HeatColors }> = {
  forest: { label: 'Vegetal', colors: { low: '#cee4b2', high: '#174c31' } },
  sun: { label: 'Solar', colors: { low: '#f6dc8e', high: '#b34728' } },
  blue: { label: 'Azul', colors: { low: '#c9e5f3', high: '#255b92' } },
}
export type Priority = 'high' | 'medium' | 'low'
export type LayerVisibility = { points: boolean; segments: boolean; boundary: boolean }
export type MapArea = { id: AreaId; label: string; bounds: [Coordinate, Coordinate]; hasExamples: boolean }
type ItemBase = { id: string; area: AreaId; label: string }
export type PointItem = ItemBase & { kind: 'point'; position: Coordinate }
export type SegmentItem = ItemBase & { kind: 'segment'; positions: Coordinate[]; priority: Priority }
export type MapItem = PointItem | SegmentItem

// Limites de visualização reaproveitados de prototipo-01/frontend/js/map.js.
// São recortes retangulares de estudo, não limites oficiais de bairros ou do município.
export const areas: Record<AreaId, MapArea> = {
  centro: { id: 'centro', label: 'Centro · exemplo', bounds: [[-21.2102, -50.4404], [-21.2079, -50.4379]], hasExamples: true },
  norte: { id: 'norte', label: 'Centro-norte · exemplo', bounds: [[-21.208, -50.442], [-21.2057, -50.4395]], hasExamples: true },
  cidade: { id: 'cidade', label: 'Vista da cidade · sem resultados', bounds: [[-21.27, -50.49], [-21.15, -50.38]], hasExamples: false },
}

export const priorityLabels: Record<Priority, string> = { high: 'Alta', medium: 'Moderada', low: 'Baixa' }
export const priorityColors: Record<Priority, string> = { high: '#a04f43', medium: '#8a6718', low: '#386a50' }

// Posições, traçados e prioridades inventados apenas para validar a interface.
// Não são saídas do detector, árvores confirmadas nem recomendações para essas ruas.
export const demoItems: MapItem[] = [
  { id: 'c01', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 01', position: [-21.20855, -50.43995] },
  { id: 'c02', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 02', position: [-21.20835, -50.4392] },
  { id: 'c03', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 03', position: [-21.2091, -50.4386] },
  { id: 'c04', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 04', position: [-21.20955, -50.43965] },
  { id: 'c05', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 05', position: [-21.2098, -50.4381] },
  { id: 'c06', area: 'centro', kind: 'point', label: 'Ponto ilustrativo 06', position: [-21.2085, -50.43825] },
  { id: 'ca', area: 'centro', kind: 'segment', label: 'Trecho ilustrativo A', priority: 'high', positions: [[-21.20995, -50.44005], [-21.20935, -50.43935], [-21.20885, -50.4388]] },
  { id: 'cb', area: 'centro', kind: 'segment', label: 'Trecho ilustrativo B', priority: 'medium', positions: [[-21.20855, -50.43995], [-21.2082, -50.4392]] },
  { id: 'n01', area: 'norte', kind: 'point', label: 'Ponto ilustrativo 07', position: [-21.2063, -50.4413] },
  { id: 'n02', area: 'norte', kind: 'point', label: 'Ponto ilustrativo 08', position: [-21.2071, -50.4408] },
  { id: 'n03', area: 'norte', kind: 'point', label: 'Ponto ilustrativo 09', position: [-21.2074, -50.4401] },
  { id: 'na', area: 'norte', kind: 'segment', label: 'Trecho ilustrativo C', priority: 'low', positions: [[-21.20765, -50.4416], [-21.2072, -50.44105], [-21.2067, -50.44045]] },
]

export function itemPosition(item: MapItem): Coordinate {
  return item.kind === 'point' ? item.position : item.positions[Math.floor(item.positions.length / 2)] ?? areas[item.area].bounds[0]
}

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
