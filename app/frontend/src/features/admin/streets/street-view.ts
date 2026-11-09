import type { IntensityMetric } from './street-intensity'
export type StreetView = { rankedKeys: string[]; metric: IntensityMetric; category: string; search: string; background: 'soft' | 'normal'; boundary: boolean; points: boolean; focus: { id: string; ids?: string[]; revision: number } | null }
export const initialStreetView: StreetView = { rankedKeys: [], metric: 'base-rate', category: 'all', search: '', background: 'soft', boundary: true, points: true, focus: null }
