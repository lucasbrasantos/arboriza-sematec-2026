import { useId, useState } from 'react'
import { Layers, LocateFixed, Search, Trash2 } from 'lucide-react'
import { normalizeSearch } from '../../map/data/map-data'
import type { ResultLayer } from '../data/result-layers'

type Props = { layers: readonly ResultLayer[]; activeId: string; visibleIds: ReadonlySet<string>; autoFit: boolean; onAutoFit: (value: boolean) => void; onActivate: (id: string) => void; onVisible: (id: string, visible: boolean) => void; onFit: (layer: ResultLayer) => void; onFitVisible: () => void; onRemove: (ids: string[]) => void }
export default function ResultLayerManager({ layers, activeId, visibleIds, autoFit, onAutoFit, onActivate, onVisible, onFit, onFitVisible, onRemove }: Props) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [page, setPage] = useState(1)
  const term = normalizeSearch(query)
  const results = layers.filter((layer) => normalizeSearch(`${layer.name} ${layer.execution} ${layer.category} ${layer.origin}`).includes(term) && (filter === 'all' || visibleIds.has(layer.id) === (filter === 'visible')))
  const allVisible = layers.length > 0 && layers.every((layer) => visibleIds.has(layer.id))
  const pages = Math.max(1, Math.ceil(results.length / 10))
  const currentPage = Math.min(page, pages)
  const shown = results.slice((currentPage - 1) * 10, currentPage * 10)
  const executions = [...new Set(shown.map((layer) => layer.executionId))]
  return <section className="result-layer-manager" aria-labelledby={titleId}>
    <header><h2 id={titleId}><Layers size={18} /> Camadas de resultados</h2><span>{visibleIds.size} visíveis · {layers.length} disponíveis</span></header>
    <div className="result-layer-bulk"><button type="button" disabled={!layers.length || allVisible} onClick={() => { for (const layer of layers) onVisible(layer.id, true) }}>Ativar todas</button><button type="button" disabled={!visibleIds.size} onClick={() => { for (const layer of layers) onVisible(layer.id, false) }}>Desativar todas</button></div>
    <button type="button" className="result-layer-clear" disabled={!layers.length} onClick={() => { if (window.confirm('Remover todas as camadas deste mapa? As análises originais permanecem no backend.')) onRemove(layers.map((layer) => layer.id)) }}><Trash2 size={13} /> Limpar todas as camadas</button>
    <div className="result-layer-search"><Search size={17} /><input aria-label="Buscar camadas" placeholder="Nome, execução ou categoria" value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} /></div>
    <div className="result-layer-options"><label>Mostrar<select aria-label="Filtrar camadas" value={filter} onChange={(event) => { const value = event.currentTarget.value; if (value === 'all' || value === 'visible' || value === 'hidden') { setFilter(value); setPage(1) } }}><option value="all">Todas</option><option value="visible">Visíveis</option><option value="hidden">Ocultas</option></select></label><button type="button" onClick={onFitVisible} disabled={!visibleIds.size}><LocateFixed size={15} /> Enquadrar visíveis</button></div>
    <label className="result-layer-autofit"><input type="checkbox" checked={autoFit} onChange={(event) => onAutoFit(event.currentTarget.checked)} /> Enquadrar ao ativar camada</label>
    <p className="result-layer-summary" role="status">{results.length} {results.length === 1 ? 'camada encontrada' : 'camadas encontradas'}</p>
    <div className="result-layer-scroll">{executions.map((execution) => <section className="result-layer-family" key={execution}><h3>{shown.find((layer) => layer.executionId === execution)?.execution}</h3>{shown.filter((layer) => layer.executionId === execution).map((layer) => <div key={layer.id} className="result-layer-row" data-active={activeId === layer.id}>
      <label className="result-layer-visibility"><input type="checkbox" checked={visibleIds.has(layer.id)} onChange={(event) => onVisible(layer.id, event.currentTarget.checked)} aria-label={`Exibir camada ${layer.name}`} /></label>
      <button type="button" className="result-layer-activate" aria-pressed={activeId === layer.id} aria-label={`Ativar camada ${layer.name}`} title={layer.name} onClick={() => onActivate(layer.id)}><strong><span style={{ background: layer.color }} />{layer.name.split(' · ').at(-1)}</strong><small>{layer.segmentation ? `${layer.segmentation.features.length} polígonos` : `${layer.items.filter((item) => item.kind === 'point').length} pontos`}{activeId === layer.id ? ' · Em edição' : ''}</small><small>{layerDate(layer)}</small></button>
      <button type="button" className="result-layer-fit" onClick={() => onFit(layer)} aria-label={`Enquadrar camada ${layer.name}`} title="Enquadrar camada"><LocateFixed size={17} /></button>
      <button type="button" className="result-layer-fit" aria-label={`Excluir camada ${layer.name} do mapa`} title="Excluir do mapa" onClick={() => { if (window.confirm(`Remover “${layer.name}” deste mapa? A análise original permanece no backend.`)) onRemove([layer.id]) }}><Trash2 size={14} /></button>
    </div>)}</section>)}{!results.length && <p className="result-layer-empty">Nenhuma camada corresponde à busca ou ao filtro. Ajuste os critérios para continuar.</p>}</div>
    <footer><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></footer>
  </section>
}

function layerDate(layer: ResultLayer) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(layer.executionId)
  const stamp = layer.createdAt ?? (match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z` : '')
  const date = new Date(stamp)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Exemplo · sem data registrada'
}
