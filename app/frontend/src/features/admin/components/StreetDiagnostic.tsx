import { rankStreets } from '../streets/street-intensity'
import StreetWorkspace from './StreetWorkspace'
import type { StreetView } from '../streets/street-view'
import { createStreetMap } from '../streets/street-map.js'
import { streetEntries, visibleStreets } from '../streets/street-data.js'
import { useEffect, useRef, useState } from 'react'
import type { Feature, FeatureCollection, LineString } from 'geojson'
import { useMap } from 'react-leaflet'
import { api } from '../../auth/services/api'
import type { ResultLayer } from '../data/result-layers'
import Button from '../../../shared/ui/controls/Button'

export type StreetFeature = Feature<LineString, Record<string, unknown>>
export type StreetResult = FeatureCollection<LineString, Record<string, unknown>> & { arboriza: Record<string, unknown> }
export function StreetMap({ data, selected, onSelect, onClear, view, points }: { onClear: () => void; data: StreetResult; selected: string | null; onSelect: (id: string) => void; view: StreetView; points: number[][] }) {
  const map = useMap()
  const renderer = useRef<ReturnType<typeof createStreetMap> | null>(null)
  const currentSelect = useRef(onSelect)
  const currentClear = useRef(onClear)
  useEffect(() => { currentClear.current = onClear }, [onClear])
  useEffect(() => { const clear = () => currentClear.current(); map.on('click', clear); return () => { map.off('click', clear) } }, [map])
  useEffect(() => { currentSelect.current = onSelect }, [onSelect])
  useEffect(() => {
    const drawing = createStreetMap(map, (id) => currentSelect.current(id), view.metric); renderer.current = drawing
    drawing.draw(data, (data.arboriza.pontos_diagnostico as number[][] | undefined) ?? points)
    return () => { drawing.clear(); renderer.current = null }
  }, [map, data, points, view.metric])
  useEffect(() => { const chosen = new Set(view.rankedKeys); const ids = rankStreets(data).filter((row) => chosen.has(row.key)).flatMap((row) => row.ids); if (selected) ids.push(selected); renderer.current?.select(ids) }, [selected, data, view.metric, view.rankedKeys])
  useEffect(() => { renderer.current?.filter(new Set(visibleStreets(streetEntries(data), view.category, view.search).map((entry) => String(entry.feature.id)))) }, [view.category, view.search, data, view.metric])
  useEffect(() => { renderer.current?.showBoundary(view.boundary) }, [view.boundary, data, view.metric])
  useEffect(() => { renderer.current?.showPoints(view.points) }, [view.points, data, points, view.metric])
  useEffect(() => { if (view.focus) renderer.current?.focus(view.focus.ids ?? view.focus.id) }, [view.focus])
  return null
}

export default function StreetDiagnostic({ active, layers, result, selected, onResult, onSelect, onBack, mode, view, autoFit, onView, onMode, onPoints }: { mode: boolean; view: StreetView; autoFit: boolean; onView: (patch: Partial<StreetView>) => void; onMode: (open: boolean) => void; onPoints: (points: number[][]) => void; active: ResultLayer; layers: readonly ResultLayer[]; result: StreetResult | null; selected: string | null; onResult: (result: StreetResult) => void; onSelect: (id: string | null) => void; onBack: () => void }) {
  const [distance, setDistance] = useState('25')
  const [chosen, setChosen] = useState<string[] | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const candidates = layers.filter((layer) => layer.executionId === active.executionId && layer.linkedCrowns && !layer.segmentation)
  const number = Number(distance)
  const valid = distance.trim() !== '' && Number.isFinite(number) && number >= 5 && number <= 100
  async function run() {
    setBusy(true); setError(''); onMode(true)
    const controller = new AbortController(); request.current = controller
    const timer = window.setTimeout(() => controller.abort(), 30000)
    try {
      const members = candidates.filter((layer) => chosen ? chosen.includes(layer.id) : layer.id === active.id)
      const body = active.linkedCrowns ? { camadas: members.map((layer) => ({ id_camada: layer.id, ids_copas: layer.items.flatMap((item) => typeof item.properties?.copa_id === 'string' ? [item.properties.copa_id] : []) })) } : { pontos: active.items.flatMap((item) => item.kind === 'point' ? [[item.position[1], item.position[0]]] : []) }
      onPoints(active.items.flatMap((item) => item.kind === 'point' ? [[item.position[1], item.position[0]]] : []))
      const data = await api<StreetResult>('/ruas/diagnostico', { method: 'POST', body: JSON.stringify({ analysis_id: active.executionId, distancia_m: number, ...body }), signal: controller.signal })
      if (!controller.signal.aborted) { onResult(data) }
    } catch (reason) { setError(controller.signal.aborted ? 'A consulta foi cancelada ou excedeu 30 segundos. Tente novamente.' : reason instanceof Error ? reason.message : 'Não foi possível analisar as ruas.') }
    finally { window.clearTimeout(timer); setBusy(false) }
  }
  if (mode) return <StreetWorkspace data={result} name={active.linkedCrowns ? `Modelo v2 · ${chosen?.length ?? 1} camada(s) da mesma análise` : active.name} busy={busy} error={error} selected={selected} view={view} autoFit={autoFit} onView={onView} onSelect={onSelect} onBack={() => { request.current?.abort(); onMode(false); onBack() }} onRetry={() => void run()} />
  return <div className="street-diagnostic"><p>Camada: <strong>{active.name}</strong></p>{active.linkedCrowns && <fieldset><legend>Camadas do modelo v2</legend><p>Selecione camadas desta mesma análise. Indivíduos e grupos têm contagens separadas. Complementos pendentes ficam fora da cobertura-base.</p>{candidates.map((layer) => <label key={layer.id}><input type="checkbox" checked={chosen ? chosen.includes(layer.id) : layer.id === active.id} onChange={(event) => { const current = chosen ?? [active.id]; setChosen(event.target.checked ? [...current, layer.id] : current.filter((id) => id !== layer.id)) }} />{layer.category}</label>)}</fieldset>}<label className="editor-field-label" htmlFor="street-distance">Distância de comparação (m)</label><input id="street-distance" type="number" min="5" max="100" value={distance} onChange={(event) => setDistance(event.target.value)} /><Button disabled={busy || !valid || !active.territory || Boolean(active.segmentation)} onClick={() => void run()}>Analisar ruas próximas</Button>{!active.territory && <p>Selecione uma análise real com setores de origem.</p>}</div>
}
