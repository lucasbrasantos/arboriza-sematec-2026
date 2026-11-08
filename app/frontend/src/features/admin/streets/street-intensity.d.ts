import type { StreetFeature, StreetResult } from '../components/StreetDiagnostic'
export type IntensityMetric = 'base-rate' | 'individual-rate' | 'coverage'
export type RankedStreet = { key: string; name: string; ids: string[]; length: number; count: number; individuals: number; groups: number; pending: number; partial: number; value: number }
export const intensityMetrics: Record<IntensityMetric, {label: string; unit: string}>
export function segmentIntensity(feature: StreetFeature, metric?: IntensityMetric): number
export function intensityColor(value: number, maximum: number): string
export function rankStreets(data: StreetResult, metric?: IntensityMetric, ascending?: boolean): RankedStreet[]
