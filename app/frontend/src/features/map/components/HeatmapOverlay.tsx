import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import Leaflet from 'leaflet'
import 'leaflet.heat'
import type { PointItem, HeatColors } from '../data/map-data'
import { uniqueDensityPoints } from '../data/point-density'

export default function HeatmapOverlay({ points, colors, prototype = false }: { points: PointItem[]; colors: HeatColors; prototype?: boolean }) {
  const map = useMap()
  useEffect(() => {
    // Identical WGS84 positions represent a single observation in the heatmap.
    // Do not merge nearby points: distinct trees may be close together.
    const unique = prototype ? uniqueDensityPoints(points) : points
    const heat = Leaflet.heatLayer(unique.map((point): Leaflet.HeatLatLngTuple => [...point.position, 1]), {
      ...(prototype ? { radius: 28, blur: 22, maxZoom: 19, minOpacity: .3 } : { radius: 45, blur: 30, maxZoom: 18, max: 1, minOpacity: .25, gradient: { .2: colors.low, 1: colors.high } }),
    })
    map.addLayer(heat)
    return () => { map.removeLayer(heat) }
  }, [map, points, colors, prototype])
  return null
}
