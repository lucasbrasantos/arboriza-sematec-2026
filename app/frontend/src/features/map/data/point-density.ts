import type { PointItem } from './map-data'

/** One contribution per identical WGS84 position, without merging nearby trees. */
export function uniqueDensityPoints(points: readonly PointItem[]): PointItem[] {
  return [...new Map(points.map((point) => [JSON.stringify(point.position), point])).values()]
}
