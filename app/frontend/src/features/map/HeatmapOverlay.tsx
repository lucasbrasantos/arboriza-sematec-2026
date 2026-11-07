import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import Leaflet from 'leaflet'
import 'leaflet.heat'
import type { PointItem, HeatColors } from './map-data'

export default function HeatmapOverlay({ points, colors }: { points: PointItem[]; colors: HeatColors }) {
  const map = useMap()
  useEffect(() => {
    const heat = Leaflet.heatLayer(points.map((point): Leaflet.HeatLatLngTuple => [...point.position, 1]), {
      radius: 45, blur: 30, maxZoom: 18, max: 1, minOpacity: .25,
      gradient: { .2: colors.low, 1: colors.high },
    })
    map.addLayer(heat)
    return () => { map.removeLayer(heat) }
  }, [map, points, colors])
  return null
}
