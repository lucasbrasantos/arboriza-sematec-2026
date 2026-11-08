import { useState } from 'react'
import type { SectorCollection } from '../data/territory-data'

type Props = { selecting: boolean; enabled: boolean; onEnabled: (value: boolean) => void; collection: SectorCollection | null; error: string; onRetry: () => void; selected: ReadonlySet<string>; onToggle: (id: string) => void; onSelection: (ids: Set<string>) => void; onFit: () => void; onFitAll: () => void }
export default function TerritoryPanel({ selecting, enabled, onEnabled, collection, error, onRetry, selected, onToggle, onSelection, onFit, onFitAll }: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = collection?.features.filter((feature) => String(feature.id).includes(query.trim())) ?? []
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const area = collection?.features.reduce((sum, feature) => selected.has(String(feature.id)) ? sum + feature.properties.AREA_KM2 : sum, 0) ?? 0
  return <section className="territory-panel" aria-labelledby="territory-title"><h2 id="territory-title">Setores censitários · IBGE 2022</h2>
    <label className="territory-enable"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.currentTarget.checked)} /> Exibir malha de setores</label>
    <p>Malha oficial preparada: setores urbanos de Araçatuba. A seleção inclui setores inteiros.</p>
    {enabled && (error ? <div role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Tentar carregar novamente</button></div> : !collection ? <p role="status">Carregando setores do arquivo local…</p> : <>
      <div className="territory-summary" role="status"><strong>{selected.size} de {collection.features.length} setores selecionados</strong><span>{area.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} km² · soma das áreas declaradas pelo IBGE</span></div>
      <div className="territory-actions"><button type="button" onClick={onFitAll}>Ver malha completa</button><button type="button" onClick={onFit} disabled={!selected.size}>Enquadrar seleção</button><button type="button" onClick={() => onSelection(new Set(collection.features.map((feature) => String(feature.id))))}>Todos</button><button type="button" onClick={() => onSelection(new Set(collection.features.filter((feature) => !selected.has(String(feature.id))).map((feature) => String(feature.id))))}>Inverter</button><button type="button" disabled={!selected.size} onClick={() => onSelection(new Set())}>Limpar</button></div>
      <label className="editor-field-label" htmlFor="sector-search">Buscar pelo código do setor</label><input id="sector-search" inputMode="numeric" maxLength={15} value={query} placeholder="Código completo ou parte dele" onChange={(event) => { setQuery(event.currentTarget.value.replace(/\D/g, '')); setPage(1) }} />
      <p className="editor-help">{selecting ? 'Clique nos polígonos do mapa ou marque os códigos abaixo.' : 'Navegação ativa: use Setores na barra para selecionar no mapa, ou marque os códigos abaixo.'} Selecionados em azul; demais setores em verde.</p>
      <div className="territory-code-list">{filtered.slice((currentPage - 1) * 10, currentPage * 10).map((feature) => <label key={String(feature.id)}><input type="checkbox" checked={selected.has(String(feature.id))} onChange={() => onToggle(String(feature.id))} />{String(feature.id)}</label>)}{!filtered.length && <p>Nenhum setor encontrado nesta malha.</p>}</div>
      <div className="territory-pagination"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>
    </>)}
    <details className="editor-advanced"><summary>Fonte, limites e próximas ferramentas</summary><p>IBGE · malha definitiva do Censo 2022, município 3502804, situação Urbana. Arquivo local reaproveitado do protótipo. Não equivale ao perímetro urbano legal atual.</p><p>Desenho livre, interseção, união geométrica e exportação territorial terão implementação própria. Nenhuma área aqui representa cobertura de copas.</p></details>
  </section>
}
