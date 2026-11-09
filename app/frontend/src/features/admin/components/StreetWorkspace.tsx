import { intensityMetrics } from '../streets/street-intensity'
import StreetRanking from './StreetRanking'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { StreetResult } from './StreetDiagnostic'
import { streetTemplate } from '../streets/street-template'
import { createStreetPanel } from '../streets/street-panel.js'
import { streetEntries, streetTotals, visibleStreets } from '../streets/street-data.js'
import '../styles/street-workspace.css'

import type { StreetView } from '../streets/street-view'
type Props = { data: StreetResult | null; name: string; busy: boolean; error: string; selected: string | null; view: StreetView; autoFit: boolean; onView: (patch: Partial<StreetView>) => void; onSelect: (id: string | null) => void; onBack: () => void; onRetry: () => void }
export default function StreetWorkspace(props: Props) {
  const panel = useRef<ReturnType<typeof createStreetPanel> | null>(null)
  const current = useRef(props)
  useEffect(() => { current.current = props })
  useEffect(() => {
    const focus = (id: string) => current.current.onView({ focus: { id, revision: performance.now() } })
    panel.current = createStreetPanel({ select: (id) => { current.current.onSelect(id); if (current.current.autoFit) focus(id) }, focus, back: () => current.current.onBack(), retry: () => current.current.onRetry(), filter: (category, search) => current.current.onView({ ...(category === null ? {} : { category }), ...(search === null ? {} : { search }) }), presentation: (mode) => current.current.onView({ background: mode === 'normal' ? 'normal' : 'soft' }), boundary: (show) => current.current.onView({ boundary: show }), points: (show) => current.current.onView({ points: show }) })
    panel.current.open({ name: props.name })
    return () => { panel.current = null }
  }, [props.name])
  useEffect(() => {
    const api = panel.current
    if (!api) return
    if (props.busy) { api.open({ name: props.name }); return }
    if (props.error) { api.error(props.error); return }
    if (!props.data) return
    const entries = streetEntries(props.data)
    const visible = visibleStreets(entries, props.view.category, props.view.search)
    api.ready(props.data, streetTotals(entries)); api.background(props.view.background)
    const explanation = document.getElementById('street-v2-explanation')
    if (explanation) explanation.textContent = `As cores comparam ${intensityMetrics[props.view.metric].label.toLocaleLowerCase('pt-BR')}. Complementos pendentes não entram no indicador. A cobertura das máscaras é uma medida estimada separada, disponível no detalhe de cada trecho.`
    api.list(visible, props.view.category, entries.length)
    api.detail(visible.find((entry) => String(entry.feature.id) === props.selected) ?? null, Number(props.data.arboriza.distancia_m), !(props.view.rankedKeys?.length))
    if (props.selected && !visible.some((entry) => String(entry.feature.id) === props.selected)) props.onSelect(null)
  }, [props])
  // Unrelated renders can occur between a native checkbox's click and change.
  // Only synchronize checked state when its actual source changes.
  useEffect(() => {
    panel.current?.visibility({ boundary: props.view.boundary, points: props.view.points })
  }, [props.name, props.data, props.busy, props.error, props.view.boundary, props.view.points])
  const target = document.getElementById('street-workspace-slot')
  return target ? createPortal(<><div dangerouslySetInnerHTML={{ __html: streetTemplate }} />{props.data && !props.busy && !props.error && <StreetRanking data={props.data} view={props.view} onView={props.onView} onSelect={props.onSelect} />}</>, target) : null
}
