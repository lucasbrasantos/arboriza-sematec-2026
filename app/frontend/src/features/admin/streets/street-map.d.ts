import type { Map } from 'leaflet'
import type { IntensityMetric } from './street-intensity'
export function createStreetMap(map: Map, onSelect: (id: string) => void, metric?: IntensityMetric): {draw: (data: unknown, points: number[][]) => void; clear: () => void; select: (id: string | string[] | null) => void; focus: (id: string | string[]) => void; filter: (ids: Set<string>) => void; showBoundary: (show: boolean) => void}
