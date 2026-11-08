import { useState } from 'react'
import { Eye, Layers, LocateFixed, Search } from 'lucide-react'
import { normalizeSearch } from '../map/map-data'
import type { ResultLayer } from './result-layers'

type Props = { layers: readonly ResultLayer[]; activeId: string; visibleIds: ReadonlySet<string>; autoFit: boolean; onAutoFit: (value: boolean) => void; onActivate: (id: string) => void; onVisible: (id: string, visible: boolean) => void; onFit: (layer: ResultLayer) => void; onFitVisible: () => void }
export default function ResultLayerManager({ layers, activeId, visibleIds, autoFit, onAutoFit, onActivate, onVisible, onFit, onFitVisible }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [page, setPage] = useState(1)
  const term = normalizeSearch(query)
  const results = layers.filter((layer) => normalizeSearch(`${layer.name} ${layer.execution} ${layer.category} ${layer.origin}`).includes(term) && (filter === 'all' || visibleIds.has(layer.id) === (filter === 'visible')))
  const pages = Math.max(1, Math.ceil(results.length / 5))
  const currentPage = Math.min(page, pages)
  const shown = results.slice((currentPage - 1) * 5, currentPage * 5)
  const executions = [...new Set(shown.map((layer) => layer.executionId))]
  return <section className="result-layer-manager" aria-labelledby="result-layers-title">
    <header><h2 id="result-layers-title"><Layers size={18} /> Camadas de resultados</h2><span>{visibleIds.size} visíveis · {layers.length} disponíveis</span></header>
    <div className="result-layer-search"><Search size={17} /><input aria-label="Buscar camadas" placeholder="Nome, execução ou categoria" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} /></div>
    <div className="result-layer-options"><label>Mostrar<select aria-label="Filtrar camadas" value={filter} onChange={(event) => { const value = event.currentTarget.value; if (value === 'all' || value === 'visible' || value === 'hidden') { setFilter(value); setPage(1) } }}><option value="all">Todas</option><option value="visible">Visíveis</option><option value="hidden">Ocultas</option></select></label><button type="button" onClick={onFitVisible} disabled={!visibleIds.size}><LocateFixed size={15} /> Enquadrar visíveis</button></div>
    <label className="result-layer-autofit"><input type="checkbox" checked={autoFit} onChange={(event) => onAutoFit(event.currentTarget.checked)} /> Enquadrar ao ativar camada</label>
    <p className="result-layer-summary" role="status">{results.length} {results.length === 1 ? 'camada encontrada' : 'camadas encontradas'}</p>
    <div className="result-layer-scroll">{executions.map((execution) => <section className="result-layer-family" key={execution}><h3>{shown.find((layer) => layer.executionId === execution)?.execution}</h3>{shown.filter((layer) => layer.executionId === execution).map((layer) => <div key={layer.id} className="result-layer-row" data-active={activeId === layer.id}>
      <label className="result-layer-visibility"><input type="checkbox" checked={visibleIds.has(layer.id)} onChange={(event) => onVisible(layer.id, event.currentTarget.checked)} aria-label={`Exibir camada ${layer.name}`} /><Eye size={17} aria-hidden="true" /></label>
      <button type="button" className="result-layer-activate" aria-pressed={activeId === layer.id} aria-label={`Ativar camada ${layer.name}`} onClick={() => onActivate(layer.id)}><strong><span style={{ background: layer.color }} />{layer.name}</strong><small>{layer.category} · {layer.items.filter((item) => item.kind === 'point').length} {layer.items.filter((item) => item.kind === 'point').length === 1 ? 'marcação' : 'marcações'}</small><small>{activeId === layer.id ? 'Ativa' : 'Disponível'} · {visibleIds.has(layer.id) ? 'visível' : 'oculta'}</small></button>
      <button type="button" className="result-layer-fit" onClick={() => onFit(layer)} aria-label={`Enquadrar camada ${layer.name}`} title="Enquadrar camada"><LocateFixed size={17} /></button>
    </div>)}</section>)}{!results.length && <p className="result-layer-empty">Nenhuma camada corresponde à busca ou ao filtro. Ajuste os critérios para continuar.</p>}</div>
    <footer><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></footer>
  </section>
}
