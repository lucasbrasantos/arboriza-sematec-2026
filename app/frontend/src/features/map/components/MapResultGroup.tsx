import { useId } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Leaf, Route } from 'lucide-react'
import { priorityLabels } from '../data/map-data'
import type { MapItem } from '../data/map-data'
import '../styles/map-result-group.css'

export type ResultGroupView = { scope: string; open: boolean; page: number }
export type ResultKind = MapItem['kind']
type MapResultGroupProps = {
  kind: ResultKind
  realData?: boolean
  items: MapItem[]
  view: ResultGroupView
  onToggle: () => void
  onPage: (page: number) => void
  onSelect: (item: MapItem, additive?: boolean) => void
}
const pageSize = 5
const numbers = new Intl.NumberFormat('pt-BR')

export default function MapResultGroup({ kind, realData = false, items, view, onToggle, onPage, onSelect }: MapResultGroupProps) {
  const id = useId()
  const label = kind === 'point' ? 'Pontos' : 'Trechos'
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(view.page, pages)
  const start = (page - 1) * pageSize
  const shown = items.slice(start, start + pageSize)
  return <section className="map-result-group" aria-label={`${label} ${realData ? 'da análise' : 'ilustrativos'}`}>
    <h2><button type="button" className="map-group-toggle" aria-expanded={view.open} aria-controls={id} onClick={onToggle}>
      {kind === 'point' ? <Leaf size={19} /> : <Route size={19} />}
      <span><strong>{label}</strong><small>{kind === 'point' ? realData ? 'Possíveis árvores · resultado do modelo' : 'Possíveis árvores · exemplos' : realData ? 'Trechos do resultado' : 'Prioridades ilustrativas'}</small></span>
      <span className="map-group-count">{numbers.format(items.length)}</span><ChevronDown size={17} className={view.open ? 'is-open' : ''} />
    </button></h2>
    <div id={id} hidden={!view.open}>
      <div className="map-group-items">{shown.map((item) => <button type="button" key={item.id} id={`map-result-${item.id}`} className="map-result" onClick={(event) => onSelect(item, event.ctrlKey || event.metaKey || event.shiftKey)}>
        <span><strong>{item.label}</strong><small>{item.kind === 'point' ? 'Abrir localização e origem' : `Prioridade ilustrativa: ${priorityLabels[item.priority]}`}</small></span><ChevronRight size={16} />
      </button>)}</div>
      <div className="map-group-pagination"><span role="status">{numbers.format(start + 1)}–{numbers.format(Math.min(start + pageSize, items.length))} de {numbers.format(items.length)}</span><div>
        <button type="button" aria-label={`Página anterior de ${label.toLowerCase()}`} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={17} /></button>
        <span>{page} / {pages}</span><button type="button" aria-label={`Próxima página de ${label.toLowerCase()}`} disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={17} /></button>
      </div></div>
    </div>
  </section>
}
