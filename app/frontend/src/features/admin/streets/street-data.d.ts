import type { StreetResult, StreetFeature } from '../components/StreetDiagnostic'
export type StreetEntry = { feature: StreetFeature; number: number }
export function streetCategory(feature: StreetFeature): 'with-points' | 'no-points'
export function streetEntries(data: StreetResult): StreetEntry[]
export function visibleStreets(entries: StreetEntry[], category?: string, search?: string): StreetEntry[]
export function streetTotals(entries: StreetEntry[]): Record<string, number>
