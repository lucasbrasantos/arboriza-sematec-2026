import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, BoxSelect, ChevronRight, ClipboardCheck, FolderOpen, Info, Layers, MapPin, MousePointer2, Move, PanelLeft, PanelRight, Plus, Redo2, ScanLine, Trash2, Undo2, X } from 'lucide-react'
import MapCanvas from '../map/MapCanvas'
import { areas, heatPalettes, itemPosition, priorityLabels } from '../map/map-data'
import type { MapArea, BaseMap, LayerVisibility, MapItem, MapView } from '../map/map-data'
import MapResultGroup from '../map/MapResultGroup'
import type { ResultGroupView, ResultKind } from '../map/MapResultGroup'
import Toggle from '../../shared/ui/Toggle'
import Button from '../../shared/ui/Button'
import { paths } from '../../shared/config/paths'
import logo from '../../assets/brand/logo-horizontal.svg'
import AnalysisDemoDialog from './AnalysisDemoDialog'
import ResultLayerManager from './ResultLayerManager'
import TerritoryPanel from './TerritoryPanel'
import WorkspaceOverlays from './WorkspaceOverlays'
import { resultLayers, combineBounds, rectangleArea } from './result-layers'
import type { ResultLayer } from './result-layers'
import { useTerritoryData, sectorBounds } from './territory-data'
import '../map/map.css'
import './admin-editor.css'
import './result-workspace.css'

type Context = 'area' | 'analysis' | 'review' | 'layers'
const contexts = [{ id: 'area', label: 'Área', icon: MapPin }, { id: 'analysis', label: 'Análise', icon: ScanLine }, { id: 'review', label: 'Revisão', icon: ClipboardCheck }, { id: 'layers', label: 'Camadas', icon: Layers }] as const
const contextLabels: Record<Context, string> = { area: 'Definir território', analysis: 'Configurar análise', review: 'Revisar exemplos', layers: 'Organizar camadas' }
const futureTools = [{ label: 'Adicionar', icon: Plus }, { label: 'Mover', icon: Move }, { label: 'Retângulo', icon: BoxSelect }, { label: 'Apagar', icon: Trash2 }, { label: 'Desfazer', icon: Undo2 }, { label: 'Refazer', icon: Redo2 }]
const initialGroups: Record<ResultKind, ResultGroupView> = { point: { scope: '', open: true, page: 1 }, segment: { scope: '', open: false, page: 1 } }

export default function AdminMapPage() {
  const [context, setContext] = useState<Context>('layers')
  const [activeId, setActiveId] = useState('centro-a')
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(['centro-a', 'norte-import']))
  const [autoFit, setAutoFit] = useState(true)
  const [focusArea, setFocusArea] = useState<MapArea>({ ...areas.centro, hasExamples: false })
  const [inspectorTab, setInspectorTab] = useState<'layer' | 'selection'>('layer')
  const [sectorsEnabled, setSectorsEnabled] = useState(false)
  const [sectorSelectionMode, setSectorSelectionMode] = useState(true)
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(() => new Set())
  const territory = useTerritoryData(sectorsEnabled)
  const [base, setBase] = useState<BaseMap>('aerial')
  const [view, setView] = useState<MapView>('points')
  const [layers, setLayers] = useState<LayerVisibility>({ points: true, segments: true, boundary: true })
  const [selected, setSelected] = useState<MapItem | null>(null)
  const [leftOpen, setLeftOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [failure, setFailure] = useState(false)
  const [groups, setGroups] = useState(initialGroups)
  const leftToggle = useRef<HTMLButtonElement>(null)
  const rightToggle = useRef<HTMLButtonElement>(null)
  const inspectorTitle = useRef<HTMLHeadingElement>(null)
  const contextBody = useRef<HTMLDivElement>(null)
  const taskSettings = useRef<HTMLDivElement>(null)
  const analysisTrigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { document.title = 'Mapa administrativo | Arboriza' }, [])
  useEffect(() => { const body = contextBody.current; const task = taskSettings.current; if (body) body.scrollTop = context === 'layers' ? 0 : task ? task.offsetTop - body.offsetTop : 0 }, [context])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => { setCompact(media.matches); if (media.matches) setLeftOpen(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const activeLayer = resultLayers.find((layer) => layer.id === activeId) ?? resultLayers[0]
  const visibleLayers = useMemo(() => resultLayers.filter((layer) => visibleIds.has(layer.id)), [visibleIds])
  const items = useMemo(() => visibleLayers.flatMap((layer) => layer.items), [visibleLayers])
  const pointColors = useMemo(() => Object.fromEntries(visibleLayers.flatMap((layer) => layer.items.map((item) => [item.id, layer.color]))), [visibleLayers])
  const activeItems = activeLayer.items
  const points = activeItems.filter((item) => item.kind === 'point')
  const segments = activeItems.filter((item) => item.kind === 'segment')
  const selectingSectors = sectorsEnabled && sectorSelectionMode && context === 'area'
  const docked = false
  const panelsCoverMap = compact && (leftOpen || inspectorOpen)
  const area = focusArea
  function fit(bounds: MapArea['bounds'], label: string) { setFocusArea({ ...areas.centro, label, bounds, hasExamples: false }) }
  function fitLayer(layer: ResultLayer) { fit(layer.bounds, layer.name) }
  function activate(id: string) {
    const layer = resultLayers.find((item) => item.id === id)
    if (!layer) return
    setActiveId(id); setSelected(null); setInspectorTab('layer'); setInspectorOpen(true); setGroups(initialGroups)
    if (autoFit) fitLayer(layer)
    if (compact) setLeftOpen(false)
  }
  function setVisible(id: string, visible: boolean) {
    setVisibleIds((current) => { const next = new Set(current); if (visible) next.add(id); else next.delete(id); return next })
    if (!visible && selected && resultLayers.find((layer) => layer.id === id)?.items.some((item) => item.id === selected.id)) setSelected(null)
  }
  function toggleSector(id: string) { setSelectedSectors((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function fitSectors() { if (territory.collection) { const bounds = sectorBounds(territory.collection, selectedSectors); if (bounds) fit(bounds, 'Setores selecionados') } }
  function select(item: MapItem) { const owner = resultLayers.find((layer) => layer.items.some((candidate) => candidate.id === item.id)); if (owner) setActiveId(owner.id); setSelected(item); setInspectorTab('selection'); setInspectorOpen(true); if (compact) setLeftOpen(false); requestAnimationFrame(() => inspectorTitle.current?.focus()) }
  function switchContext(next: Context) { setContext(next); setLeftOpen(true); if (compact) setInspectorOpen(false) }
  function closeLeft() { setLeftOpen(false); leftToggle.current?.focus() }
  function closeInspector() { setInspectorOpen(false); rightToggle.current?.focus() }
  function openAnalysis(event: MouseEvent<HTMLButtonElement>) { analysisTrigger.current = event.currentTarget; setDialogOpen(true) }
  function closeAnalysis() { setDialogOpen(false); requestAnimationFrame(() => { if (analysisTrigger.current?.isConnected) analysisTrigger.current.focus() }) }
  function toggleLayer(key: keyof LayerVisibility, visible: boolean) {
    setLayers((current) => ({ ...current, [key]: visible }))
    if (selected && !visible && (key === 'points' && selected.kind === 'point' || key === 'segments' && selected.kind === 'segment')) { setSelected(null); setInspectorOpen(false) }
  }

  return <section className="admin-editor public-map-page" data-layout-mode="compact" data-context={context} aria-labelledby="editor-title">
    <div className="editor-map" style={docked ? { left: leftOpen ? 378 : 0, right: inspectorOpen ? 310 : 0 } : undefined} role="region" aria-label="Mapa de trabalho demonstrativo" inert={panelsCoverMap}>
      <MapCanvas pointColors={pointColors} itemsInteractive={!selectingSectors} area={area} base={base} layers={layers} items={items} selected={selected} view={view} heatColors={heatPalettes.forest.colors} leftInset={leftOpen && !compact && !docked ? 342 : 0} rightInset={inspectorOpen && !compact && !docked ? 300 : 0} onSelect={select} onClear={() => setSelected(null)}><WorkspaceOverlays layers={visibleLayers} activeId={activeId} showBounds={layers.boundary} sectors={sectorsEnabled ? territory.collection : null} selectedSectors={selectedSectors} onSector={toggleSector} selectSectors={selectingSectors} /></MapCanvas>
    </div>
    <header className="editor-topbar ar-glass">
      <Link to={paths.admin} className="editor-brand" aria-label="Voltar à Administração"><img src={logo} alt="Arboriza" /></Link>
      <div className="editor-title"><h1 id="editor-title">Mapa administrativo</h1><span>Demonstração · dados fictícios</span></div>
      <nav aria-label="Navegação administrativa"><Link to={paths.admin} aria-label="Portal administrativo" title="Portal administrativo"><ArrowLeft size={16} /><span>Portal</span></Link><Link to={paths.adminArchive} aria-label="Acervo de análises" title="Acervo de análises"><FolderOpen size={16} /><span>Acervo</span></Link><Link to={paths.home}>Início</Link></nav>
    </header>
    <div className="editor-panel-triggers"><button ref={leftToggle} type="button" aria-expanded={leftOpen} aria-controls="editor-context-panel" onClick={() => { if (leftOpen) closeLeft(); else { setLeftOpen(true); if (compact) setInspectorOpen(false) } }}><PanelLeft size={18} /> Ferramentas</button><button ref={rightToggle} type="button" aria-expanded={inspectorOpen} aria-controls="editor-inspector" onClick={() => { if (inspectorOpen) closeInspector(); else { setInspectorOpen(true); if (compact) setLeftOpen(false) } }}><PanelRight size={18} /> Propriedades</button></div>
    <aside id="editor-context-panel" className="editor-context-panel ar-glass" hidden={!leftOpen} aria-label="Contexto de trabalho" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeLeft() } }}>
      <header><strong>{contextLabels[context]}</strong><button className="editor-icon-button" type="button" onClick={closeLeft} aria-label="Recolher ferramentas"><X size={18} /></button></header>
      <div className="editor-context-tabs" role="group" aria-label="Tarefa atual">{contexts.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={context === id} onClick={() => switchContext(id)}><Icon size={17} /><span>{label}</span></button>)}</div>
      <div ref={contextBody} className="editor-panel-body">
        <div hidden={context !== 'layers'}><ResultLayerManager layers={resultLayers} activeId={activeId} visibleIds={visibleIds} autoFit={autoFit} onAutoFit={setAutoFit} onActivate={activate} onVisible={setVisible} onFit={fitLayer} onFitVisible={() => { const bounds = combineBounds(visibleLayers); if (bounds) fit(bounds, 'Camadas visíveis') }} /></div>
        <div ref={taskSettings} className="editor-task-settings">
        <p className="editor-active-layer-name">Camada ativa: <strong>{activeLayer.name}</strong>{!visibleIds.has(activeId) && ' · oculta'}</p>
        {context === 'area' && <><TerritoryPanel enabled={sectorsEnabled} onEnabled={(enabled) => { setSectorsEnabled(enabled); if (enabled) setSectorSelectionMode(true) }} selecting={selectingSectors} collection={territory.collection} error={territory.error} onRetry={territory.retry} selected={selectedSectors} onToggle={toggleSector} onSelection={setSelectedSectors} onFit={fitSectors} onFitAll={() => { if (territory.collection) { const bounds = sectorBounds(territory.collection, new Set(territory.collection.features.map((feature) => String(feature.id)))); if (bounds) fit(bounds, 'Malha urbana IBGE 2022') } }} /><Button onClick={() => switchContext('analysis')}>Configurar demonstração <ChevronRight size={16} /></Button></>}
        {context === 'analysis' && <><h2>Uma análise por vez</h2><p>Confira o perfil e experimente o acompanhamento antes de conectarmos o processamento.</p><label className="editor-field-label" htmlFor="editor-profile">Perfil</label><select id="editor-profile"><option>Demonstração de detecção</option></select><details className="editor-advanced"><summary>Configurações técnicas previstas</summary><p>Perfil do modelo, corte de score e parâmetros de processamento serão definidos com a integração. Score não equivale a probabilidade de acerto.</p><p>Fonte selecionada: {base === 'aerial' ? 'imagem aérea' : 'ruas'}. Na análise real será necessário confirmar uma fonte de imagem compatível.</p></details><label className="editor-field-label" htmlFor="editor-outcome">Cenário para testar a interface</label><select id="editor-outcome" value={failure ? 'error' : 'success'} onChange={(event) => setFailure(event.currentTarget.value === 'error')}><option value="success">Preparação → análise → conclusão</option><option value="error">Preparação → análise → erro</option></select><div className="editor-note"><Info size={17} /><p>Nenhuma imagem é enviada à IA. O progresso é uma simulação por etapas, sem porcentagem fictícia.</p></div><Button onClick={openAnalysis}>Conferir demonstração <ScanLine size={17} /></Button><p className="editor-help">O mapa e os painéis ficarão bloqueados durante o acompanhamento.</p></>}
        {context === 'review' && <><h2>Inspecione os exemplos</h2><p>Selecione uma marcação no mapa ou na lista. As informações aparecem no painel de propriedades.</p>{activeItems.length ? (['point', 'segment'] as const).map((kind) => { const list = activeItems.filter((item) => item.kind === kind && layers[kind === 'point' ? 'points' : 'segments']); return list.length > 0 && <MapResultGroup key={kind} kind={kind} items={list} view={groups[kind]} onToggle={() => setGroups((current) => ({ ...current, [kind]: { ...current[kind], open: !current[kind].open } }))} onPage={(page) => setGroups((current) => ({ ...current, [kind]: { ...current[kind], page } }))} onSelect={select} /> }) : <p className="editor-note">Esta camada não contém marcações. O limite da análise continua disponível no mapa.</p>}<details className="editor-advanced"><summary>Copas e diagnóstico de ruas</summary><p>A revisão de copas vinculadas e o diagnóstico por rua serão trazidos do protótipo em etapas próprias. Não há copas nem diagnóstico real nesta amostra.</p></details></>}
        {context === 'layers' && <><h2>O que aparece no mapa</h2><Toggle label="Pontos ilustrativos" checked={layers.points} onChange={(value) => toggleLayer('points', value)} /><Toggle label="Trechos ilustrativos" checked={layers.segments} onChange={(value) => toggleLayer('segments', value)} /><Toggle label="Limite do recorte" checked={layers.boundary} onChange={(value) => toggleLayer('boundary', value)} /><label className="editor-field-label" htmlFor="editor-base">Mapa de fundo</label><select id="editor-base" value={base} onChange={(event) => { if (event.currentTarget.value === 'aerial' || event.currentTarget.value === 'streets') setBase(event.currentTarget.value) }}><option value="aerial">Imagem aérea · IGC / DataGEO</option><option value="streets">Ruas · OpenStreetMap</option></select><label className="editor-field-label" htmlFor="editor-view">Visualização dos pontos</label><select id="editor-view" value={view} onChange={(event) => { if (event.currentTarget.value === 'points' || event.currentTarget.value === 'density') setView(event.currentTarget.value) }}><option value="points">Pontos individuais</option><option value="density">Densidade relativa</option></select><p className="editor-help">A densidade não mede cobertura de copas ou temperatura.</p><div className="editor-future-actions"><Button appearance="secondary" disabled>Importar GeoJSON</Button><Button appearance="secondary" disabled>Exportar resultado</Button></div><p className="editor-help">Fluxos de arquivos serão implementados após esta validação.</p></>}
        </div>
      </div><footer>Sem IA, persistência ou publicação conectadas</footer>
    </aside>
    <aside id="editor-inspector" className="editor-inspector ar-glass" hidden={!inspectorOpen} aria-label="Propriedades da seleção" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeInspector() } }}>
      <header><strong>Propriedades</strong><button type="button" className="editor-icon-button" aria-label="Recolher propriedades" onClick={closeInspector}><X size={18} /></button></header>
      <div className="editor-panel-body"><div className="editor-inspector-tabs" role="group" aria-label="Tipo de propriedades"><button type="button" aria-pressed={inspectorTab === 'layer'} onClick={() => setInspectorTab('layer')}>Camada</button><button type="button" aria-pressed={inspectorTab === 'selection'} onClick={() => setInspectorTab('selection')}>Seleção</button></div>{inspectorTab === 'layer' ? <><h2>Propriedades da camada</h2><h3 className="editor-layer-title">{activeLayer.name}</h3><dl className="editor-facts"><div><dt>Execução / origem</dt><dd>{activeLayer.execution}<br />{activeLayer.origin}</dd></div><div><dt>Categoria</dt><dd>{activeLayer.category} · dados fictícios</dd></div><div><dt>Visibilidade</dt><dd>{visibleIds.has(activeId) ? 'Visível no mapa' : 'Oculta; permanece ativa para inspeção'}</dd></div><div><dt>Marcações na camada</dt><dd>{points.length} pontos representativos · {segments.length} trechos</dd></div><div><dt>Marcações dentro do retângulo</dt><dd>{points.filter((point) => point.position[0] >= activeLayer.bounds[0][0] && point.position[0] <= activeLayer.bounds[1][0] && point.position[1] >= activeLayer.bounds[0][1] && point.position[1] <= activeLayer.bounds[1][1]).length} pontos representativos</dd></div><div><dt>Área estimada do retângulo</dt><dd>{(rectangleArea(activeLayer.bounds) / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha<br />{rectangleArea(activeLayer.bounds).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²<br />{(rectangleArea(activeLayer.bounds) / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} km²</dd></div><div><dt>Território associado</dt><dd>Retângulo demonstrativo. Sem vínculo com os setores selecionados nesta sessão.</dd></div></dl><Button appearance="secondary" onClick={() => fitLayer(activeLayer)}>Enquadrar esta camada</Button><p className="editor-help">Área do retângulo não é área de copas nem união de setores. Contagens de camadas sobrepostas não representam árvores únicas.</p></> : selected ? <><span className="editor-selection-type">{selected.kind === 'point' ? 'Ponto ilustrativo' : 'Trecho ilustrativo'}</span><h2 ref={inspectorTitle} tabIndex={-1}>{selected.label}</h2><dl className="editor-facts"><div><dt>Origem</dt><dd>Exemplo criado para a interface</dd></div><div><dt>Revisão</dt><dd>Não se aplica ao exemplo</dd></div>{selected.kind === 'point' ? <><div><dt>Coordenadas · WGS84</dt><dd>{itemPosition(selected).map((value) => value.toFixed(6)).join(', ')}</dd></div><div><dt>Score / copa vinculada</dt><dd>Indisponíveis neste exemplo</dd></div></> : <div><dt>Prioridade ilustrativa</dt><dd>{priorityLabels[selected.priority]}</dd></div>}</dl><p className="editor-help">Selecionar não confirma uma árvore ou um diagnóstico. A edição e os parâmetros do detector ainda não estão integrados.</p><Button appearance="secondary" onClick={() => setSelected(null)}>Limpar seleção</Button></> : <div className="editor-inspector-empty"><MousePointer2 size={30} /><h2>Um olhar mais próximo</h2><p>Selecione um ponto ou trecho para consultar sua origem e propriedades.</p><Button appearance="secondary" onClick={() => switchContext('review')}>Explorar exemplos</Button></div>}</div>
    </aside>
    <div className="editor-floating-toolbar ar-glass" role="group" aria-label={`Ferramentas de ${contextLabels[context].toLowerCase()}`} inert={panelsCoverMap}>
      <span className="editor-toolbar-context">{contexts.find((item) => item.id === context)?.label}</span>
      {context === 'area' ? <><button type="button" aria-pressed={!selectingSectors} onClick={() => setSectorSelectionMode(false)}><MousePointer2 size={19} /><span>Navegar</span></button><button type="button" aria-pressed={selectingSectors} onClick={() => { setSectorsEnabled(true); setSectorSelectionMode(true) }} title="Selecionar setores por clique"><MapPin size={19} /><span>Setores</span></button></> : context === 'analysis' ? <><button type="button" onClick={openAnalysis}><ScanLine size={19} /><span>Conferir demo</span></button><button type="button" onClick={() => switchContext('review')}><ClipboardCheck size={19} /><span>Revisar exemplos</span></button></> : context === 'review' ? <><button type="button" aria-pressed="true"><MousePointer2 size={19} /><span>Selecionar</span></button>{futureTools.map(({ label, icon: Icon }) => <button key={label} type="button" disabled title={`${label}: próxima etapa de edição`}><Icon size={19} /><span>{label}</span></button>)}</> : <><button type="button" aria-pressed={view === 'points'} onClick={() => setView('points')}><MapPin size={19} /><span>Pontos</span></button><button type="button" aria-pressed={view === 'density'} onClick={() => setView('density')}><Layers size={19} /><span>Densidade</span></button></>}
    </div>
    <footer className="editor-statusbar"><span>{activeLayer.name} · {visibleIds.size} camadas visíveis</span><span>{selected ? '1 item selecionado' : 'Nenhuma seleção'} · Sem alterações salvas</span><strong>Dados fictícios</strong></footer>
    {dialogOpen && <AnalysisDemoDialog areaLabel={selectedSectors.size ? `${selectedSectors.size} setores selecionados · demonstração` : activeLayer.name} points={points.length} segments={segments.length} failure={failure} onClose={closeAnalysis} onReview={() => { setDialogOpen(false); setContext('review'); setLeftOpen(!compact); const first = points[0]; if (first) select(first) }} />}
  </section>
}
