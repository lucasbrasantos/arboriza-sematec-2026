import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, ChevronRight, Info, Layers, Leaf, MapPin, Route, Search, X } from 'lucide-react'
import Toggle from '../../../shared/ui/controls/Toggle'
import LivingGraphic from '../../../shared/ui/graphics/LivingGraphic'
import MapResultGroup from './MapResultGroup'
import type { ResultGroupView, ResultKind } from './MapResultGroup'
import { areas, itemPosition, normalizeSearch, priorityLabels } from '../data/map-data'
import type { AreaId, LayerVisibility, MapItem } from '../data/map-data'

type MapSidebarProps = {
  open: boolean
  areaId: AreaId
  layers: LayerVisibility
  items: MapItem[]
  selected: MapItem | null
  query: string
  onQuery: (query: string) => void
  onArea: (area: AreaId) => void
  onLayer: (layer: keyof LayerVisibility, visible: boolean) => void
  onSelect: (item: MapItem) => void
  onBack: () => void
  onClose: () => void
}

export default function MapSidebar({ open, areaId, layers, items, selected, query, onQuery, onArea, onLayer, onSelect, onBack, onClose }: MapSidebarProps) {
  const [tab, setTab] = useState<'explore' | 'layers'>('explore')
  const [groups, setGroups] = useState<Record<ResultKind, ResultGroupView>>({ point: { scope: '', open: false, page: 1 }, segment: { scope: '', open: false, page: 1 } })
  const title = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const previousSelection = useRef<string | null>(null)
  useEffect(() => {
    if (open && selected) title.current?.focus()
    else if (open && previousSelection.current) {
      const previousItem = document.getElementById(`map-result-${previousSelection.current}`)
      if (previousItem?.getClientRects().length) previousItem.focus()
      else search.current?.focus()
    }
    previousSelection.current = selected?.id ?? null
  }, [selected, open])

  const term = normalizeSearch(query)
  const visibleItems = items.filter((item) => layers[item.kind === 'point' ? 'points' : 'segments'])
  const results = visibleItems.filter((item) => normalizeSearch(`${item.label} ${areas[item.area].label} ${item.kind === 'point' ? 'arvore ponto' : `trecho ${priorityLabels[item.priority]}`}`).includes(term))
  const areaResults = term ? Object.values(areas).filter((area) => area.id !== areaId && normalizeSearch(area.label).includes(term)) : []
  const pointCount = items.filter((item) => item.kind === 'point').length
  const segmentCount = items.length - pointCount
  const resultCount = results.length + areaResults.length
  const scope = `${areaId}:${term}`
  function groupView(kind: ResultKind): ResultGroupView { return groups[kind].scope === scope ? groups[kind] : { scope, open: Boolean(term), page: 1 } }
  function updateGroup(kind: ResultKind, update: Partial<Pick<ResultGroupView, 'open' | 'page'>>) { const current = groupView(kind); setGroups((state) => ({ ...state, [kind]: { ...current, ...update } })) }
  function back() { setTab('explore'); onBack() }

  return <aside id="map-sidebar" className="map-sidebar ar-glass" hidden={!open} aria-label={selected ? 'Detalhes do item selecionado' : 'Exploração do mapa'} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <div className="map-sidebar-heading"><div><Leaf size={19} /><strong>{selected ? 'Entender o mapa' : 'Explore com calma'}</strong></div><button type="button" className="map-icon-button" onClick={onClose} aria-label="Recolher painel lateral"><X size={18} /></button></div>
    {selected ? <div className="map-sidebar-body map-detail-body">
      <button type="button" className="map-back-button" onClick={back}><ArrowLeft size={16} /> Voltar à exploração</button>
      <span className={`map-detail-symbol ${selected.kind === 'segment' ? 'is-segment' : ''}`}>{selected.kind === 'point' ? <Leaf size={27} /> : <Route size={27} />}</span>
      <h2 ref={title} tabIndex={-1}>{selected.label}</h2>
      <p className="map-detail-type">{selected.kind === 'point' ? 'Marcação de demonstração' : 'Trecho de demonstração'}</p>
      <button type="button" className="map-text-button map-show-selection" onClick={onClose}>Ver este item no mapa <ArrowUpRight size={15} /></button>
      <section className="map-detail-section"><h3>O que estou vendo?</h3><p>{selected.kind === 'point' ? 'Um exemplo de como a posição de uma possível árvore pode aparecer no mapa. Este ponto foi criado para demonstrar a consulta.' : 'Um traçado ilustrativo para mostrar como consultar a prioridade de avaliação de um trecho. Ele não representa um diagnóstico desta rua.'}</p></section>
      {selected.kind === 'segment' && <section className="map-detail-section"><h3>Prioridade ilustrativa</h3><span className={`map-priority map-priority--${selected.priority}`}>{priorityLabels[selected.priority]}</span><p>Classe fictícia para avaliar a interface. Não é uma recomendação de intervenção neste local.</p></section>}
      <dl className="map-detail-facts"><div><dt>Origem</dt><dd>Exemplo criado para a interface</dd></div><div><dt>Recorte exibido</dt><dd>{areas[selected.area].label}</dd></div><div><dt>Revisão da equipe</dt><dd>Não se aplica ao exemplo</dd></div></dl>
      <div className="map-explanation"><Info size={18} /><p>{selected.kind === 'point' ? 'Um ponto não confirma uma árvore. Na consulta final, as marcações publicadas precisarão passar pela revisão da equipe.' : 'A prioridade ajuda a organizar a avaliação dos trechos. Os critérios do diagnóstico real ainda precisam ser definidos e validados.'}</p></div>
      <details className="map-source-details"><summary>Localização e limites</summary><p>Latitude: {itemPosition(selected)[0].toFixed(6)}<br />Longitude: {itemPosition(selected)[1].toFixed(6)}<br />Coordenadas em WGS84. Para trechos, é mostrado um vértice de referência.</p><p>Posições e traçados fictícios. Contagem de pontos não equivale a cobertura de copas nem ao atendimento à regra 3-30-300.</p></details>
    </div> : <>
      <div className="map-panel-tabs" role="group" aria-label="Conteúdo do painel"><button type="button" aria-pressed={tab === 'explore'} onClick={() => setTab('explore')}><Search size={16} /> Explorar</button><button type="button" aria-pressed={tab === 'layers'} onClick={() => setTab('layers')}><Layers size={16} /> Camadas</button></div>
      <div className="map-sidebar-body">
        <label className="map-field-label" htmlFor="map-area">Onde explorar</label>
        <select id="map-area" value={areaId} onChange={(event) => { const area = Object.values(areas).find((item) => item.id === event.target.value); if (area) onArea(area.id) }}>{Object.values(areas).map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select>
        {tab === 'explore' ? <>
          {areas[areaId].hasExamples && <p className="map-area-summary">{pointCount} {pointCount === 1 ? 'ponto' : 'pontos'} e {segmentCount} {segmentCount === 1 ? 'trecho ilustrativo' : 'trechos ilustrativos'}</p>}
          <label className="map-field-label map-search-label" htmlFor="public-map-search">Buscar nos exemplos</label><div className="map-search-field"><Search size={17} /><input ref={search} id="public-map-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Área, ponto ou trecho" maxLength={80} />{query && <button type="button" onClick={() => { onQuery(''); search.current?.focus() }} aria-label="Limpar busca"><X size={16} /></button>}</div>
          <p className="map-search-summary" role="status">{term ? `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'} nesta demonstração` : 'Abra um grupo para consultar os itens.'}</p>
          {areaResults.length > 0 && <div className="map-results">{areaResults.map((area) => <button key={area.id} type="button" className="map-result" onClick={() => onArea(area.id)}><MapPin size={18} /><span><strong>{area.label}</strong><small>Abrir este recorte</small></span><ChevronRight size={16} /></button>)}</div>}
          {!areas[areaId].hasExamples && !term ? <div className="map-empty"><LivingGraphic kind="leaf" /><h2>Uma cidade para explorar.</h2><p>Esta vista ainda não tem resultados publicados no app. Você pode navegar pela cidade ou abrir um dos recortes de exemplo.</p><button type="button" className="map-text-button" onClick={() => onArea('centro')}>Ver exemplo do Centro <ArrowUpRight size={15} /></button></div> : <>
            {results.length > 0 && <div className="map-results" aria-label="Grupos de itens ilustrativos">{(['point', 'segment'] as const).map((kind) => { const groupItems = results.filter((item) => item.kind === kind); const view = groupView(kind); return groupItems.length > 0 && <MapResultGroup key={kind} kind={kind} items={groupItems} view={view} onToggle={() => updateGroup(kind, { open: !view.open })} onPage={(page) => updateGroup(kind, { page })} onSelect={onSelect} /> })}</div>}
            {results.length === 0 && areaResults.length === 0 && <div className="map-empty map-empty--compact"><Search size={26} /><h2>{visibleItems.length ? 'Nenhum exemplo encontrado.' : 'As camadas estão ocultas.'}</h2><p>{visibleItems.length ? 'Tente “ponto”, “trecho” ou o nome de outro recorte.' : 'Abra Camadas para exibir pontos ou trechos no mapa e na lista.'}</p>{!visibleItems.length && <button className="map-text-button" type="button" onClick={() => setTab('layers')}>Abrir camadas <ArrowUpRight size={15} /></button>}</div>}
          </>}
        </> : <>
          <section className="map-layer-section" aria-labelledby="map-layer-title"><h2 id="map-layer-title">O que aparece no mapa</h2>
            <div className="map-layer-row"><Toggle label="Pontos ilustrativos" checked={layers.points} onChange={(value) => onLayer('points', value)} /><p>Marcações de possíveis árvores, criadas como exemplo.</p></div>
            <div className="map-layer-row"><Toggle label="Trechos ilustrativos" checked={layers.segments} onChange={(value) => onLayer('segments', value)} /><p>Exemplos de prioridades de avaliação, sem diagnóstico real.</p></div>
            <div className="map-layer-row"><Toggle label="Limite do recorte" checked={layers.boundary} onChange={(value) => onLayer('boundary', value)} /><p>Retângulo do exemplo, sem representar limite oficial de bairro.</p></div>
          </section>
          <div className="map-explanation"><Info size={18} /><p>Os pontos e as prioridades são fictícios. A base cartográfica representa o território; as marcações sobre ela demonstram a interface.</p></div>
          <details className="map-source-details"><summary>Fontes e limites</summary><p>Imagem aérea: IGC-SP / DataGEO, base 2023/2024, com prévias locais do protótipo. Ruas: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap e colaboradores</a>.</p><p>Os recortes são exemplos de estudo. Não há cálculo de cobertura de copas nem da regra 3-30-300.</p></details>
        </>}
      </div>
    </>}
    <div className="map-sidebar-foot"><span /> Dados ilustrativos · sem diagnóstico real</div>
  </aside>
}
