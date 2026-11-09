import { initialStreetView } from '../streets/street-view'
import type { StreetView } from '../streets/street-view'
import { uniqueDensityPoints } from '../../map/data/point-density'
import WorkspaceFiles from '../components/WorkspaceFiles'
import type { WorkspaceSnapshot } from '../data/workspace-files'
import StreetDiagnostic, { StreetMap } from '../components/StreetDiagnostic'
import type { StreetResult } from '../components/StreetDiagnostic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ChevronRight, ClipboardCheck, FolderOpen, Layers, MapPin, MousePointer2, PanelLeft, PanelRight, ScanLine, X } from 'lucide-react'
import MapCanvas from '../../map/components/MapCanvas'
import SectorComparison from '../../map/pages/SectorComparison'
import MapDisplayControls from '../../map/components/WorkspaceDisplayControls'
import { areas, heatPalettes, itemPosition } from '../../map/data/map-data'
import type { MapArea, BaseMap, Coordinate, LayerVisibility, MapItem, MapView } from '../../map/data/map-data'
import MapResultGroup from '../../map/components/MapResultGroup'
import type { ResultGroupView, ResultKind } from '../../map/components/MapResultGroup'
import Toggle from '../../../shared/ui/controls/Toggle'
import Button from '../../../shared/ui/controls/Button'
import { paths } from '../../../shared/config/paths'
import logo from '../../../assets/brand/logo-horizontal.svg'
import AnalysisConfig from '../components/AnalysisConfig'
import type { AnalysisPreferences } from '../components/AnalysisConfig'
import AdminSidebarV2 from '../components/AdminSidebarV2'
import ResultsPanelV2 from '../components/ResultsPanelV2'
import AnalysisProgressV2 from '../components/AnalysisProgressV2'
import AnalysisConfirmV2 from '../components/AnalysisConfirmV2'
import TerritoryDrawing from '../components/TerritoryDrawing'
import type { TerritoryOperation, TerritoryTool } from '../components/TerritoryDrawing'
import TerritoryToolbar from '../components/TerritoryToolbar'
import PointToolbar from '../components/PointToolbar'
import type { PointTool } from '../components/PointToolbar'
import PointEditingMap from '../components/PointEditingMap'
import { usePointEditor } from '../hooks/usePointEditor'
import { useAnalysisRunner } from '../hooks/useAnalysisRunner'
import ResultLayerManager from '../components/ResultLayerManager'
import TerritoryPanel from '../components/TerritoryPanel'
import WorkspaceOverlays from '../components/WorkspaceOverlays'
import { resultLayers, combineBounds, loadAnalysisResultLayers, rectangleArea } from '../data/result-layers'
import type { ResultLayer } from '../data/result-layers'
import { useTerritoryData, sectorBounds } from '../data/territory-data'
import { api } from '../../auth/services/api'
import '../../map/styles/map.css'
import '../styles/admin-editor.css'
import '../styles/result-workspace.css'

type Context = 'area' | 'analysis' | 'review' | 'layers'
type CompletedJob = { id: string; state: string; request: { perfil: string } }
const contexts = [{ id: 'area', label: 'Área', icon: MapPin }, { id: 'analysis', label: 'Análise', icon: ScanLine }, { id: 'review', label: 'Revisão', icon: ClipboardCheck }, { id: 'layers', label: 'Camadas', icon: Layers }] as const
const contextLabels: Record<Context, string> = { area: 'Definir território', analysis: 'Configurar análise', review: 'Revisar resultados', layers: 'Organizar camadas' }
const initialGroups: Record<ResultKind, ResultGroupView> = { point: { scope: '', open: true, page: 1 }, segment: { scope: '', open: false, page: 1 } }

export default function AdminMapPage() {
  const [comparisonOpen,setComparisonOpen] = useState(false)
  const skipSessionRestore = useRef(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [workspaceIssue, setWorkspaceIssue] = useState('')
  const [workspaceRevision, setWorkspaceRevision] = useState(0)
  const [savedWorkspace, setSavedWorkspace] = useState('')
  const [streetMode, setStreetMode] = useState(false)
  const [streetView, setStreetView] = useState<StreetView>(initialStreetView)
  const [streetPoints, setStreetPoints] = useState<number[][]>([])
  const [streetResult, setStreetResult] = useState<StreetResult | null>(null)
  const [streetSelected, setStreetSelected] = useState<string | null>(null)
  const [sidebarVersion, setSidebarVersion] = useState<'v1' | 'v2'>('v2')
  const [analysisPreferences, setAnalysisPreferences] = useState<AnalysisPreferences>({ model: 'controle', profile: 'controle', score: '0.15' })
  const [context, setContext] = useState<Context>('area')
  const [activeId, setActiveId] = useState('centro-a')
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(['centro-a', 'norte-import']))
  const [autoFit, setAutoFit] = useState(true)
  const [focusArea, setFocusArea] = useState<MapArea>({ ...areas.cidade, hasExamples: false })
  const [inspectorTab, setInspectorTab] = useState<'layer' | 'selection' | 'territory'>('layer')
  const [sectorsEnabled, setSectorsEnabled] = useState(true)
  const [sectorSelectionMode, setSectorSelectionMode] = useState(false)
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(() => new Set())
  const [territoryTool, setTerritoryTool] = useState<TerritoryTool>('click')
  const [territoryOperation, setTerritoryOperation] = useState<TerritoryOperation>('replace')
  const [territoryBusy, setTerritoryBusy] = useState(false)
  const [territoryStatus, setTerritoryStatus] = useState('Clique em um setor para selecionar ou remover.')
  const [confirmTerritory, setConfirmTerritory] = useState(false)
  const [pointTool, setPointTool] = useState<PointTool>('select')
  const [pointStatus, setPointStatus] = useState('Selecione pontos no mapa. Use Ctrl ou Shift para selecionar vários.')
  const [editingBusy, setEditingBusy] = useState(false)
  const suppressPointClick = useRef(0)
  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  const territory = useTerritoryData(sectorsEnabled)
  const [base, setBase] = useState<BaseMap>('aerial')
  const [densityScope, setDensityScope] = useState<'visible' | 'active'>('visible')
  const [view, setView] = useState<MapView>('points')
  const [layers, setLayers] = useState<LayerVisibility>({ points: true, segments: false, boundary: false })
  const [selected, setSelected] = useState<MapItem | null>(null)
  const [leftOpen, setLeftOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [inspectorOpen, setInspectorOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  const [groups, setGroups] = useState(initialGroups)
  const [resultTab, setResultTab] = useState<'layers' | 'points'>('layers')
  const [realLayers, setRealLayers] = useState<ResultLayer[]>([])
  const [analysisLoadError, setAnalysisLoadError] = useState('')
  const [failedJob, setFailedJob] = useState<CompletedJob | null>(null)
  const loadingAnalyses = useRef(new Set<string>())
  const leftToggle = useRef<HTMLButtonElement>(null)
  const rightToggle = useRef<HTMLButtonElement>(null)
  const inspectorTitle = useRef<HTMLHeadingElement>(null)
  const contextBody = useRef<HTMLDivElement>(null)
  const taskSettings = useRef<HTMLDivElement>(null)
  useEffect(() => { document.title = 'Mapa administrativo | Arboriza' }, [])
  useEffect(() => { const body = contextBody.current; const task = taskSettings.current; if (body) body.scrollTop = context === 'layers' ? 0 : task ? task.offsetTop - body.offsetTop : 0 }, [context])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => { setCompact(media.matches); if (media.matches) setLeftOpen(false) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [removedLayers, setRemovedLayers] = useState<Set<string>>(() => new Set())
  const sourceLayers = useMemo(() => [...realLayers, ...resultLayers].filter((layer) => !removedLayers.has(layer.id)), [realLayers, removedLayers])
  const editor = usePointEditor(sourceLayers)
  const allLayers = editor.layers
  const workspaceSnapshot = useMemo<WorkspaceSnapshot>(() => {
    const layers = allLayers.filter((layer) => !layer.origin.includes('demonstrativa'))
    return { layers, visible_ids: layers.filter((layer) => visibleIds.has(layer.id)).map((layer) => layer.id), active_id: layers.some((layer) => layer.id === activeId) ? activeId : layers[0]?.id ?? '' }
  }, [allLayers, visibleIds, activeId])
  const workspaceFingerprint = JSON.stringify(workspaceSnapshot)
  const workspaceDirty = workspaceReady && workspaceFingerprint !== savedWorkspace
  useEffect(() => {
    const controller = new AbortController()
    api<{ revision: number; snapshot: WorkspaceSnapshot | null }>('/workspace', { signal: controller.signal }).then(async (response) => {
      if (controller.signal.aborted) return
      const packageId = new URLSearchParams(window.location.search).get('pacote')
      const packageSnapshot = packageId ? (await api<{ snapshot: WorkspaceSnapshot }>(`/acervo/${encodeURIComponent(packageId)}`, { signal: controller.signal })).snapshot : null
      if (controller.signal.aborted) return
      skipSessionRestore.current = Boolean(response.snapshot || packageSnapshot)
      setWorkspaceRevision(response.revision)
      const restored = packageSnapshot ?? response.snapshot
      if (restored) {
        setRealLayers(restored.layers); setVisibleIds(new Set(restored.visible_ids)); setActiveId(restored.active_id)
        setLayers((current) => ({ ...current, segments: restored.layers.some((layer) => layer.segmentation && restored.visible_ids.includes(layer.id)) })); setRemovedLayers(new Set(resultLayers.map((layer) => layer.id))); setSavedWorkspace(JSON.stringify(response.snapshot ?? { layers: [], visible_ids: [], active_id: '' }))
        if (restored.layers[0]) fitLayer(restored.layers[0])
      } else setSavedWorkspace(JSON.stringify({ layers: [], visible_ids: [], active_id: '' }))
      setWorkspaceReady(true)
    }).catch((reason) => { if (!controller.signal.aborted) setWorkspaceIssue(reason instanceof Error ? reason.message : 'Não foi possível restaurar o espaço de trabalho.') })
    return () => controller.abort()
  }, [])
  async function saveWorkspace() {
    const submitted = workspaceSnapshot
    const response = await api<{ revision: number }>('/workspace', { method: 'PUT', body: JSON.stringify({ ...submitted, revision: workspaceRevision }) })
    setWorkspaceRevision(response.revision); setSavedWorkspace(JSON.stringify(submitted)); setWorkspaceIssue('')
  }
  const activeLayer = allLayers.find((layer) => layer.id === activeId) ?? allLayers[0] ?? { ...resultLayers[0], id: 'workspace-empty', name: 'Nenhuma camada', items: [] }
  const visibleLayers = useMemo(() => allLayers.filter((layer) => visibleIds.has(layer.id)), [allLayers, visibleIds])
  const hasSegmentation = allLayers.some((layer) => layer.segmentation)
  const items = useMemo(() => visibleLayers.flatMap((layer) => layer.items), [visibleLayers])
  const pointColors = useMemo(() => Object.fromEntries(visibleLayers.flatMap((layer) => layer.items.map((item) => [item.id, layer.color]))), [visibleLayers])
  const activeItems = activeLayer.items
  const points = activeItems.filter((item) => item.kind === 'point')
  const densityItems = useMemo(() => (densityScope === 'active' ? activeLayer.items : items).filter((item) => item.kind === 'point'), [densityScope, activeLayer.items, items])
  const densityStats = useMemo(() => ({ total: densityItems.length, unique: uniqueDensityPoints(densityItems).length }), [densityItems])
  const activeSelection = editor.selected(activeLayer)
  const editable = !activeLayer.segmentation && layers.points && view === 'points'
  const linked = Boolean(activeLayer.linkedCrowns)
  const segments = activeItems.filter((item) => item.kind === 'segment')
  const selectingSectors = sectorsEnabled && sectorSelectionMode && (sidebarVersion === 'v2' || context === 'area')
  const docked = false
  const panelsCoverMap = !streetMode && compact && (leftOpen || inspectorOpen)
  const area = focusArea
  function fit(bounds: MapArea['bounds'], label: string) { setFocusArea({ ...areas.centro, label, bounds, hasExamples: false }) }
  function fitLayer(layer: ResultLayer) { fit(layer.bounds, layer.name) }
  function activate(id: string) {
    const layer = allLayers.find((item) => item.id === id)
    if (!layer) return
    setActiveId(id); if (layer.linkedCrowns) setPointTool('select'); setSelected(null); setInspectorTab('layer'); setInspectorOpen(true); setGroups(initialGroups)
    if (autoFit) fitLayer(layer)
    if (compact) setLeftOpen(false)
  }
  function removeLayers(ids: string[]) {
    const removed = new Set(ids)
    setRemovedLayers((current) => new Set([...current, ...ids]))
    setVisibleIds((current) => new Set([...current].filter((id) => !removed.has(id))))
    if (removed.has(activeId)) { setActiveId(allLayers.find((layer) => !removed.has(layer.id))?.id ?? 'workspace-empty'); setSelected(null) }
  }
  function setVisible(id: string, visible: boolean) {
    setVisibleIds((current) => { const next = new Set(current); if (visible) next.add(id); else next.delete(id); return next })
    if (!visible && selected && allLayers.find((layer) => layer.id === id)?.items.some((item) => item.id === selected.id)) setSelected(null)
  }
  function toggleSector(id: string) { setSelectedSectors((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }); if (sidebarVersion === 'v1') { setInspectorTab('territory'); setInspectorOpen(true); if (compact) setLeftOpen(false) } }
  function applySectorSelection(ids: Set<string>) { setSelectedSectors(ids); if (sidebarVersion === 'v1') { setInspectorTab('territory'); if (ids.size) { setInspectorOpen(true); if (compact) setLeftOpen(false) } } }
  function finishTerritory() { if (territoryBusy) return; if (!selectedSectors.size) { setTerritoryStatus('Selecione ao menos um setor para confirmar a análise.'); return } setSectorSelectionMode(false); setConfirmTerritory(true) }
  function toggleTerritoryMode() { if (territoryBusy) return; setSectorsEnabled(true); setSectorSelectionMode((current) => !current); setTerritoryTool('click'); setTerritoryStatus('Clique em um setor para selecionar ou remover.'); if (compact) { setLeftOpen(false); setInspectorOpen(false) } }
  function fitSectors() { if (territory.collection) { const bounds = sectorBounds(territory.collection, selectedSectors); if (bounds) fit(bounds, 'Setores selecionados') } }
  function select(item: MapItem, additive = false) {
    if (performance.now() < suppressPointClick.current) return
    const owner = allLayers.find((layer) => layer.items.some((candidate) => candidate.id === item.id))
    if (owner) {
      setActiveId(owner.id)
      if (sidebarVersion === 'v2' && item.kind === 'point') { editor.pick(owner, item.id, additive); if (owner.linkedCrowns) setPointTool('select') }
    }
    setSelected(additive && owner && editor.selected(owner).has(item.id) ? null : item)
    setInspectorTab('selection'); setResultTab('points')
    if (!compact || sidebarVersion === 'v1') setInspectorOpen(true)
    if (compact && sidebarVersion === 'v1') setLeftOpen(false)
    if (sidebarVersion === 'v1') requestAnimationFrame(() => inspectorTitle.current?.focus())
  }
  function clearPoints() { editor.clear(activeLayer); setSelected(null) }
  async function validatePositions(layer: ResultLayer, positions: Coordinate[]) {
    if (layer.linkedCrowns) throw new Error('Pontos vinculados às copas têm posições fixas.')
    if (layer.territory) {
      const result = await api<{ fora: number[] }>('/territorio/validar-pontos', { method: 'POST', body: JSON.stringify({ ids: layer.territory.ids, fonte_malha: layer.territory.source, pontos: positions.map(([lat, lon]) => [lon, lat]) }) })
      if (result.fora.length) throw new Error('A posição deve permanecer dentro dos setores originais da análise.')
    } else if (layer.origin.includes('demonstrativa')) {
      if (positions.some(([lat, lon]) => lat < layer.bounds[0][0] || lat > layer.bounds[1][0] || lon < layer.bounds[0][1] || lon > layer.bounds[1][1])) throw new Error('Mantenha os pontos de exemplo dentro da área da camada.')
    } else throw new Error('Esta camada não possui território de origem validado para edição.')
  }
  async function addPoint(position: Coordinate) {
    const layer = activeLayer
    setEditingBusy(true)
    try { await validatePositions(layer, [position]); if (activeIdRef.current !== layer.id) throw new Error('A camada ativa mudou; tente novamente.'); editor.add(layer, position); setPointStatus('Ponto adicionado nesta sessão.') }
    catch (error) { setPointStatus(error instanceof Error ? error.message : 'Não foi possível validar o ponto.') }
    finally { setEditingBusy(false) }
  }
  async function movePoints(positions: Map<string, Coordinate>) {
    const layer = activeLayer
    setEditingBusy(true)
    try { await validatePositions(layer, [...positions.values()]); if (activeIdRef.current !== layer.id) throw new Error('A camada ativa mudou; tente novamente.'); editor.move(layer, positions); setSelected(null); setPointStatus(`${positions.size} ponto(s) movido(s) nesta sessão.`) }
    catch (error) { setPointStatus(error instanceof Error ? error.message : 'Não foi possível validar os pontos.') }
    finally { setEditingBusy(false) }
  }
  function switchContext(next: Context) { setContext(next); setLeftOpen(true); if (compact) setInspectorOpen(false) }
  function closeLeft() { setLeftOpen(false); leftToggle.current?.focus() }
  function closeInspector() { setInspectorOpen(false); rightToggle.current?.focus() }
  function toggleLayer(key: keyof LayerVisibility, visible: boolean) {
    setLayers((current) => ({ ...current, [key]: visible }))
    if (selected && !visible && (key === 'points' && selected.kind === 'point' || key === 'segments' && selected.kind === 'segment')) { setSelected(null); setInspectorOpen(false) }
  }
  function toggleSegmentation() {
    const show = !layers.segments
    setLayers((current) => ({ ...current, segments: show }))
    if (show) setVisibleIds((current) => new Set([...current, ...allLayers.filter((layer) => layer.segmentation).map((layer) => layer.id)]))
  }
  const loadCompletedAnalysis = useCallback(async (job: CompletedJob, options: { activate?: boolean } = {}) => {
    if (!workspaceReady || job.state !== 'concluida' || loadingAnalyses.current.has(job.id) || realLayers.some((layer) => layer.executionId === job.id)) return
    loadingAnalyses.current.add(job.id); setAnalysisLoadError('')
    try {
      const complete = await api<{ id: string; state: string; request: { perfil: string } }>(`/analises/${encodeURIComponent(job.id)}`)
      const loaded = await loadAnalysisResultLayers(complete, territory.collection)
      setFailedJob(null)
      setRealLayers((current) => [...loaded, ...current.filter((layer) => layer.executionId !== job.id)])
      const primary = loaded.find((layer) => layer.category === 'Pontos detectados' || layer.category === 'Individuais') ?? loaded[0]
      setVisibleIds((current) => { const next = new Set(current); for (const layer of loaded) if (layer.category === 'Pontos detectados' || layer.category === 'Individuais' || layer.category === 'Segmentação de copas') next.add(layer.id); return next })
      if (primary && options.activate !== false) { setStreetMode(false); setStreetResult(null); setStreetSelected(null); setSectorSelectionMode(false); setActiveId(primary.id); setSelected(null); setInspectorTab('layer'); setContext('layers'); setLeftOpen(true); if (compact) setInspectorOpen(false); fitLayer(primary) }
      if (options.activate !== false && loaded.some((layer) => layer.segmentation)) setLayers((current) => ({ ...current, segments: true }))
    } catch (reason) {
      setFailedJob(job)
      setAnalysisLoadError(reason instanceof Error ? reason.message : 'Não foi possível carregar as camadas reais.')
    } finally { loadingAnalyses.current.delete(job.id) }
  }, [realLayers, territory.collection, compact, workspaceReady])
  const runner = useAnalysisRunner((job, foreground) => { void loadCompletedAnalysis(job, { activate: foreground }) })
  useEffect(() => {
    if (!workspaceReady || skipSessionRestore.current) return
    const id = sessionStorage.getItem('arboriza.analysis.active')
    if (!id) return
    const controller = new AbortController()
    api<{ id: string; state: string; request: { perfil: string } }>(`/analises/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((job) => { if (!controller.signal.aborted && job.state === 'concluida') void loadCompletedAnalysis(job) })
      .catch(() => { /* A sessão pode apontar para uma análise que já não existe. */ })
    return () => controller.abort()
  }, [loadCompletedAnalysis, workspaceReady])
  const selectedSectorFeatures = territory.collection?.features.filter((feature) => selectedSectors.has(String(feature.id))) ?? []
  const selectedSectorIds = useMemo(() => [...selectedSectors].sort(), [selectedSectors])
  const selectedSectorArea = selectedSectorFeatures.reduce((sum, feature) => sum + feature.properties.AREA_KM2, 0)
  const selectedSectorExample = selectedSectorFeatures[0]
  useEffect(() => {
    if (sidebarVersion !== 'v2' || !selectingSectors) return
    function exitSelection(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]') || (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault(); setSectorSelectionMode(false)
    }
    window.addEventListener('keydown', exitSelection)
    return () => window.removeEventListener('keydown', exitSelection)
  }, [sidebarVersion, selectingSectors])
  const pointKeyHandler = useRef<(event: KeyboardEvent) => void>(() => {})
  useEffect(() => { pointKeyHandler.current = (event) => {
    if (comparisonOpen || streetMode || sidebarVersion !== 'v2' || selectingSectors || editingBusy || !editable || !visibleIds.has(activeLayer.id) || document.querySelector('dialog[open]') || (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
    const command = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (command && key === 'a') { event.preventDefault(); editor.selectAll(activeLayer); return }
    if (command && (key === 'z' || key === 'y')) { event.preventDefault(); editor.history(activeLayer, key === 'y' || event.shiftKey); setSelected(null); return }
    if (command || event.altKey) return
    if (key === 'delete' || key === 'backspace') { if (activeSelection.size) { event.preventDefault(); editor.remove(activeLayer); setSelected(null); setPointStatus('Seleção apagada nesta sessão.') } return }
    if (key === 'escape') { clearPoints(); return }
    const next: Record<string, PointTool> = { v: 'select', m: 'move', p: 'add', b: 'box' }
    const tool = next[key]
    if (tool && !(linked && (tool === 'move' || tool === 'add'))) { event.preventDefault(); setPointTool(tool) }
  } })
  useEffect(() => { const handler = (event: KeyboardEvent) => pointKeyHandler.current(event); window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [])
  const hasEdits = workspaceDirty
  useEffect(() => {
    if (!hasEdits) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const confirmNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
      const destination = new URL(anchor.href, window.location.href)
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
      if (!window.confirm('Há alterações não salvas neste espaço de trabalho. Deseja sair e descartá-las?')) { event.preventDefault(); event.stopPropagation() }
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', confirmNavigation, true)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', confirmNavigation, true) }
  }, [hasEdits])

  if(comparisonOpen) return <SectorComparison initialIds={[...selectedSectors]} onClose={()=>setComparisonOpen(false)} />
  return <section className="admin-editor public-map-page" data-layout-mode="compact" data-context={context} data-street-mode={streetMode} data-street-background={streetView.background} aria-labelledby="editor-title">
    <div className="editor-map" style={docked ? { left: leftOpen ? 378 : 0, right: inspectorOpen ? 310 : 0 } : undefined} role="region" aria-label="Mapa de trabalho" inert={panelsCoverMap}>
      <MapCanvas densityItems={densityItems} prototypeDensity={sidebarVersion === 'v2'} pointColors={pointColors} itemsInteractive={!selectingSectors && (sidebarVersion === 'v1' || pointTool === 'select') && !editingBusy} area={area} base={base} layers={layers} items={streetMode ? [] : items} selected={selected} selectedIds={sidebarVersion === 'v2' ? editor.selectedIds : new Set()} panToSelected={sidebarVersion === 'v1'} view={streetMode ? 'points' : view} heatColors={heatPalettes.forest.colors} leftInset={leftOpen && !compact && !docked ? sidebarVersion === 'v2' ? 370 : 342 : 0} rightInset={inspectorOpen && !compact && !docked ? sidebarVersion === 'v2' ? 330 : 300 : 0} onSelect={select} onClear={() => { if (streetMode) { setStreetSelected(null); setStreetView((current) => ({ ...current, rankedKeys: [] })); return } if (sidebarVersion === 'v2' && !selectingSectors) clearPoints(); else setSelected(null) }}>
        <TerritoryDrawing enabled={sidebarVersion === 'v2' && selectingSectors} tool={territoryTool} operation={territoryOperation} selected={selectedSectors} onSelection={applySectorSelection} onBusy={setTerritoryBusy} onStatus={setTerritoryStatus} />
        <PointEditingMap enabled={!streetMode && sidebarVersion === 'v2' && !selectingSectors && !panelsCoverMap && editable && visibleIds.has(activeLayer.id)} tool={pointTool} layer={activeLayer} selected={activeSelection} busy={editingBusy} onPick={select} onSelectMany={(ids, additive) => { editor.selectMany(activeLayer, ids, additive); setSelected(null) }} onClear={clearPoints} onAdd={(position) => void addPoint(position)} onMove={(positions) => void movePoints(positions)} onStatus={setPointStatus} onSuppressClick={() => { suppressPointClick.current = performance.now() + 350 }} />
        {!streetMode && <WorkspaceOverlays layers={visibleLayers} allLayers={allLayers} visibleIds={visibleIds} selectedIds={editor.selectedIds} activeId={activeId} showBounds={!selectingSectors} showSegmentation={layers.segments} sectors={sectorsEnabled && (sidebarVersion === 'v1' || selectingSectors) ? territory.collection : null} selectedSectors={selectedSectors} onSector={toggleSector} selectSectors={selectingSectors && (sidebarVersion === 'v1' || territoryTool === 'click')} crownsInteractive={sidebarVersion === 'v2' && !selectingSectors && pointTool === 'select' && !editingBusy} onCrownSelect={select} />}
        {sidebarVersion === 'v2' && <MapDisplayControls densityScope={densityScope} onDensityScope={setDensityScope} densityStats={densityStats} base={base} view={view} layers={layers} crowns={hasSegmentation} onBase={setBase} onView={setView} onLayer={(key, value) => { if (key === 'segments') { if (value !== layers.segments) toggleSegmentation() } else toggleLayer(key, value) }} />}
        {streetResult && <StreetMap data={streetResult} selected={streetSelected} onSelect={setStreetSelected} onClear={() => { setStreetSelected(null); setStreetView((current) => ({ ...current, rankedKeys: [] })) }} view={streetView} points={streetPoints} />}
      </MapCanvas>
    </div>
    <header className="editor-topbar ar-glass">
      <Link to={paths.admin} className="editor-brand" aria-label="Voltar à Administração"><img src={logo} alt="Arboriza" /></Link>
      <div className="editor-title"><h1 id="editor-title">Mapa administrativo</h1><span>Processamento real · dados de exemplo identificados</span></div>
      <div className="editor-version-switch" role="group" aria-label="Versão das ferramentas"><button type="button" aria-pressed={sidebarVersion === 'v1'} onClick={() => setSidebarVersion('v1')}>Atual</button><button type="button" aria-pressed={sidebarVersion === 'v2'} onClick={() => setSidebarVersion('v2')}>V2</button></div>
      {sidebarVersion === 'v2' && <button type="button" className="editor-territory-trigger" aria-pressed={selectingSectors} disabled={territoryBusy} onClick={toggleTerritoryMode}><MapPin size={16} /><span>Selecionar setores</span></button>}
      <button type="button" className="editor-territory-trigger" disabled={selectedSectors.size<2} title="Selecione pelo menos dois setores" onClick={()=>setComparisonOpen(true)}><Layers size={16}/><span>Comparar setores</span></button>
      <nav aria-label="Navegação administrativa"><Link to={paths.admin} aria-label="Portal administrativo" title="Portal administrativo"><ArrowLeft size={16} /><span>Portal</span></Link><Link to={paths.adminArchive} aria-label="Acervo de análises" title="Acervo de análises"><FolderOpen size={16} /><span>Acervo</span></Link><Link to={paths.home}>Início</Link></nav>
    </header>
    <div className="editor-panel-triggers"><button ref={leftToggle} type="button" aria-expanded={leftOpen} aria-controls={sidebarVersion === 'v2' ? 'editor-context-panel-v2' : 'editor-context-panel'} onClick={() => { if (leftOpen) closeLeft(); else { setLeftOpen(true); if (compact) setInspectorOpen(false) } }}><PanelLeft size={18} /> Ferramentas</button><button ref={rightToggle} type="button" aria-expanded={inspectorOpen} aria-controls={sidebarVersion === 'v2' ? 'editor-results-panel-v2' : 'editor-inspector'} onClick={() => { if (inspectorOpen) closeInspector(); else { setInspectorOpen(true); if (compact) setLeftOpen(false) } }}><PanelRight size={18} /> {sidebarVersion === 'v2' ? 'Camadas e pontos' : 'Propriedades'}</button></div>
    <aside id="editor-context-panel" className="editor-context-panel ar-glass" hidden={!leftOpen || sidebarVersion !== 'v1'} aria-label="Contexto de trabalho" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeLeft() } }}>
      <header><strong>{contextLabels[context]}</strong><button className="editor-icon-button" type="button" onClick={closeLeft} aria-label="Recolher ferramentas"><X size={18} /></button></header>
      <div className="editor-context-tabs" role="group" aria-label="Tarefa atual">{contexts.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={context === id} onClick={() => switchContext(id)}><Icon size={17} /><span>{label}</span></button>)}</div>
      <div ref={contextBody} className="editor-panel-body">
        <div hidden={context !== 'layers'}><ResultLayerManager onRemove={removeLayers} layers={allLayers} activeId={activeId} visibleIds={visibleIds} autoFit={autoFit} onAutoFit={setAutoFit} onActivate={activate} onVisible={setVisible} onFit={fitLayer} onFitVisible={() => { const bounds = combineBounds(visibleLayers); if (bounds) fit(bounds, 'Camadas visíveis') }} />{analysisLoadError && <div className="editor-note" role="alert"><p>{analysisLoadError} <button type="button" onClick={() => { if (failedJob) void loadCompletedAnalysis(failedJob) }}>Tentar novamente</button></p></div>}</div>
        <div ref={taskSettings} className="editor-task-settings">
        <p className="editor-active-layer-name">Camada ativa: <strong>{activeLayer.name}</strong>{!visibleIds.has(activeId) && ' · oculta'}</p>
        {context === 'area' && <><TerritoryPanel enabled={sectorsEnabled} onEnabled={(enabled) => { setSectorsEnabled(enabled); if (enabled) setSectorSelectionMode(true) }} selecting={selectingSectors} collection={territory.collection} error={territory.error} onRetry={territory.retry} selected={selectedSectors} onToggle={toggleSector} onSelection={applySectorSelection} onFit={fitSectors} onFitAll={() => { if (territory.collection) { const bounds = sectorBounds(territory.collection, new Set(territory.collection.features.map((feature) => String(feature.id)))); if (bounds) fit(bounds, 'Malha urbana IBGE 2022') } }} onMapSelect={() => { setSectorsEnabled(true); setSectorSelectionMode(true); if (compact) setLeftOpen(false) }} /><Button onClick={() => switchContext('analysis')}>Configurar análise <ChevronRight size={16} /></Button></>}
        {context === 'analysis' && <AnalysisConfig selected={selectedSectors} collection={territory.collection} preferences={analysisPreferences} onPreferences={setAnalysisPreferences} onCompleted={(job) => void loadCompletedAnalysis(job)} />}
        {context === 'review' && <><h2>{activeLayer.origin.includes('demonstrativa') ? 'Inspecione os exemplos' : 'Revise esta camada'}</h2><p>Selecione um ponto no mapa ou na lista para consultar score, modelo e origem.</p>{activeItems.length ? (['point', 'segment'] as const).map((kind) => { const list = activeItems.filter((item) => item.kind === kind && layers[kind === 'point' ? 'points' : 'segments']); return list.length > 0 && <MapResultGroup key={kind} kind={kind} realData={!activeLayer.origin.includes('demonstrativa')} items={list} view={groups[kind]} onToggle={() => setGroups((current) => ({ ...current, [kind]: { ...current[kind], open: !current[kind].open } }))} onPage={(page) => setGroups((current) => ({ ...current, [kind]: { ...current[kind], page } }))} onSelect={select} /> }) : <p className="editor-note">Esta camada não contém pontos. A segmentação, quando existente, pode ser exibida pela barra inferior.</p>}<details className="editor-advanced"><summary>Ferramentas de revisão</summary><p>A edição de pontos e a gravação do estado de revisão no backend ainda não estão conectadas.</p></details></>}
        {context === 'layers' && <><h2>Exibição do mapa</h2><Toggle label="Pontos" checked={layers.points} onChange={(value) => toggleLayer('points', value)} /><Toggle label="Segmentação de copas" checked={layers.segments} onChange={(value) => toggleLayer('segments', value)} /><Toggle label="Limites de território" checked={layers.boundary} onChange={(value) => toggleLayer('boundary', value)} /><details className="editor-advanced"><summary>Mapa de fundo e densidade</summary><label className="editor-field-label" htmlFor="editor-base">Mapa de fundo</label><select id="editor-base" value={base} onChange={(event) => { if (event.currentTarget.value === 'aerial' || event.currentTarget.value === 'streets') setBase(event.currentTarget.value) }}><option value="aerial">Imagem aérea · IGC / DataGEO</option><option value="streets">Ruas · OpenStreetMap</option></select><label className="editor-field-label" htmlFor="editor-view">Visualização dos pontos</label><select id="editor-view" value={view} onChange={(event) => { if (event.currentTarget.value === 'points' || event.currentTarget.value === 'density') setView(event.currentTarget.value) }}><option value="points">Pontos individuais</option><option value="density">Densidade relativa</option></select><p className="editor-help">A densidade não mede cobertura de copas ou temperatura.</p></details><details className="editor-advanced"><summary>Importar e exportar</summary><div className="editor-future-actions"><Button appearance="secondary" disabled>Importar GeoJSON</Button><Button appearance="secondary" disabled>Exportar resultado</Button></div><p className="editor-help">Fluxos de arquivos serão conectados na próxima etapa.</p></details></>}
        </div>
      </div><footer>Camadas do backend e exemplos identificados</footer>
    </aside>
    <div id="street-workspace-slot" />
    <AdminSidebarV2 files={<WorkspaceFiles active={activeLayer} snapshot={workspaceSnapshot} revision={workspaceRevision} ready={workspaceReady} issue={workspaceIssue} dirty={workspaceDirty} onSave={saveWorkspace} onImport={(imported) => { editor.replaceLayers(imported.map((layer) => layer.id)); setRealLayers((current) => [...imported, ...current.filter((layer) => !imported.some((item) => item.id === layer.id))]); setRemovedLayers((current) => new Set([...current].filter((id) => !imported.some((item) => item.id === id)))); setVisibleIds((current) => new Set([...current, ...imported.map((layer) => layer.id)])); if (imported[0]) { setActiveId(imported[0].id); fitLayer(imported[0]) } }} onTerritory={async () => {
      if (!selectedSectorIds.length || !territory.collection) throw new Error('Selecione os setores de origem antes de conferir a camada.')
      if (activeLayer.linkedCrowns || activeLayer.territory) throw new Error('A camada já possui território de origem. Ele não pode ser substituído por esta ação.')
      const updated = { ...activeLayer, territory: { ids: selectedSectorIds, source: territory.collection.arboriza.sha256_fonte } }
      await api('/workspace/validar', { method: 'POST', body: JSON.stringify({ layers: [updated], visible_ids: [updated.id], active_id: updated.id }) })
      setRealLayers((current) => current.map((layer) => layer.id === updated.id ? updated : layer))
    }} />} streetMode={streetMode} streets={<StreetDiagnostic mode={streetMode} view={streetView} autoFit={autoFit} onView={(patch) => setStreetView((current) => ({ ...current, ...patch }))} onPoints={setStreetPoints} onMode={(open) => { setStreetMode(open); if (open) { setStreetResult(null); setStreetSelected(null); setStreetView(initialStreetView); setSectorSelectionMode(false); setInspectorOpen(false) } }} key={activeLayer.id} active={activeLayer} layers={allLayers} result={streetResult} selected={streetSelected} onSelect={setStreetSelected} onBack={() => { setStreetMode(false); setStreetResult(null); setStreetSelected(null); if (!compact) setInspectorOpen(true) }} onResult={(result) => { setStreetResult(result); setSectorSelectionMode(false); setInspectorOpen(false); setLeftOpen(true) }} />} open={leftOpen && sidebarVersion === 'v2' && !streetMode} onClose={closeLeft} selected={selectedSectors} collection={territory.collection} territoryError={territory.error} onRetryTerritory={territory.retry} selecting={selectingSectors} onToggleTerritory={toggleTerritoryMode} onFitTerritory={fitSectors} preferences={analysisPreferences} onPreferences={setAnalysisPreferences} activeLayer={activeLayer} onCompleted={(job) => void loadCompletedAnalysis(job)} onStartAnalysis={(request) => void runner.start(request)} analysisActive={runner.active} analysisBlocked={runner.uncertain} />
    <AnalysisProgressV2 job={runner.job} sending={runner.sending} issue={runner.issue} uncertain={runner.uncertain} recent={runner.recent} checkedRecent={runner.checkedRecent} indicator={runner.indicator} modalOpen={runner.modalOpen} onOpen={runner.openModal} onClose={runner.closeModal} onCheck={() => void runner.checkAgain()} onClearUncertain={runner.clearUncertain} onDismiss={runner.dismiss} />
    {confirmTerritory && <AnalysisConfirmV2 ids={selectedSectorIds} mesh={territory.collection?.arboriza.sha256_fonte ?? ''} preferences={analysisPreferences} blocked={runner.active || runner.uncertain} onClose={() => setConfirmTerritory(false)} onStart={(request) => { setConfirmTerritory(false); void runner.start(request) }} />}
    {analysisLoadError && <div className="v2-load-error" role="alert"><span>Não foi possível carregar as camadas da análise.</span><button type="button" onClick={() => { if (sidebarVersion === 'v1') { setContext('layers'); setLeftOpen(true); if (compact) setInspectorOpen(false) } else { setInspectorOpen(true); setResultTab('layers'); if (compact) setLeftOpen(false) } }}>Ver detalhes</button></div>}
    <ResultsPanelV2 onRemove={removeLayers} open={!streetMode && inspectorOpen && sidebarVersion === 'v2'} onClose={closeInspector} layers={allLayers} activeLayer={activeLayer} visibleIds={visibleIds} autoFit={autoFit} onAutoFit={setAutoFit} onActivate={activate} onVisible={setVisible} onFit={fitLayer} onFitVisible={() => { const bounds = combineBounds(visibleLayers); if (bounds) fit(bounds, 'Camadas visíveis') }} selected={selected} onSelect={select} tab={resultTab} onTab={setResultTab} loadError={analysisLoadError} onRetryLoad={() => { if (failedJob) void loadCompletedAnalysis(failedJob) }} />
    <aside id="editor-inspector" className="editor-inspector ar-glass" hidden={!inspectorOpen || sidebarVersion !== 'v1'} aria-label="Propriedades da seleção" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closeInspector() } }}>
      <header><strong>Propriedades</strong><button type="button" className="editor-icon-button" aria-label="Recolher propriedades" onClick={closeInspector}><X size={18} /></button></header>
      <div className="editor-panel-body">
        <div className="editor-inspector-tabs" role="group" aria-label="Tipo de propriedades">
          <button type="button" aria-pressed={inspectorTab === 'layer'} onClick={() => setInspectorTab('layer')}>Camada</button>
          <button type="button" aria-pressed={inspectorTab === 'selection'} onClick={() => setInspectorTab('selection')}>Item</button>
          {selectedSectors.size > 0 && <button type="button" aria-pressed={inspectorTab === 'territory'} onClick={() => setInspectorTab('territory')}>Território</button>}
        </div>
        {inspectorTab === 'territory' && selectedSectors.size > 0 ? <>
          <span className="editor-selection-type">Seleção da área</span><h2>Território de análise</h2>
          <div className="territory-inspector-stats"><div><strong>{selectedSectors.size.toLocaleString('pt-BR')}</strong><span>setores selecionados</span></div><div><strong>{(selectedSectorArea * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong><span>hectares · soma IBGE</span></div></div>
          {selectedSectorExample && <dl className="editor-facts"><div><dt>Primeiro setor selecionado</dt><dd>{selectedSectorExample.properties.CD_SETOR}</dd></div><div><dt>Área declarada</dt><dd>{(selectedSectorExample.properties.AREA_KM2 * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha</dd></div><div><dt>Fonte</dt><dd>IBGE · Censo 2022 · Araçatuba urbana</dd></div></dl>}
          <Button appearance="secondary" onClick={fitSectors} disabled={!selectedSectors.size}>Enquadrar área selecionada</Button>
          <p className="editor-help">O total em hectares soma as áreas declaradas pelo IBGE. O backend calcula a geometria exata ao preparar a análise.</p>
        </> : inspectorTab === 'layer' ? <><h2>Propriedades da camada</h2><h3 className="editor-layer-title">{activeLayer.name}</h3><dl className="editor-facts"><div><dt>Execução / origem</dt><dd>{activeLayer.execution}<br />{activeLayer.origin}</dd></div><div><dt>Categoria</dt><dd>{activeLayer.category}</dd></div><div><dt>Visibilidade</dt><dd>{visibleIds.has(activeId) ? 'Visível no mapa' : 'Oculta; permanece ativa para inspeção'}</dd></div><div><dt>Marcações na camada</dt><dd>{points.length} pontos · {segments.length} trechos</dd></div><div><dt>Área de referência</dt><dd>{(rectangleArea(activeLayer.bounds) / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha · retângulo envolvente</dd></div></dl><Button appearance="secondary" onClick={() => fitLayer(activeLayer)}>Enquadrar esta camada</Button><p className="editor-help">Camadas reais vêm da API. Exemplos demonstrativos estão identificados no nome e na origem.</p></> : selected ? <><span className="editor-selection-type">{typeof selected.properties?.analise_id === 'string' ? 'Resultado do modelo' : selected.kind === 'point' ? 'Ponto de exemplo' : 'Trecho de exemplo'}</span><h2 ref={inspectorTitle} tabIndex={-1}>{selected.label}</h2><dl className="editor-facts"><div><dt>Origem</dt><dd>{typeof selected.properties?.analise_id === 'string' ? `Análise ${selected.properties.analise_id}` : 'Exemplo criado para a interface'}</dd></div>{typeof selected.properties?.modelo === 'string' && <div><dt>Modelo</dt><dd>{selected.properties.modelo}</dd></div>}{typeof selected.properties?.score === 'number' && <div><dt>Score do detector</dt><dd>{selected.properties.score.toFixed(3)}</dd></div>}{selected.kind === 'point' && <div><dt>Coordenadas · WGS84</dt><dd>{itemPosition(selected).map((value) => value.toFixed(6)).join(', ')}</dd></div>}{typeof selected.properties?.analise_id !== 'string' && <div><dt>Revisão</dt><dd>Exemplo · não revisado</dd></div>}</dl><p className="editor-help">O marcador representa o centro de uma proposta de copa; não indica a posição confirmada de um tronco.</p><Button appearance="secondary" onClick={() => setSelected(null)}>Limpar seleção</Button></> : <div className="editor-inspector-empty"><MousePointer2 size={30} /><h2>Selecione um item</h2><p>As informações do ponto ou da camada aparecem aqui.</p><Button appearance="secondary" onClick={() => switchContext('review')}>Abrir revisão</Button></div>}
      </div>
    </aside>
    {!streetMode && (sidebarVersion === 'v2' ? (!panelsCoverMap && (selectingSectors ? <TerritoryToolbar tool={territoryTool} operation={territoryOperation} count={selectedSectors.size} busy={territoryBusy} available={Boolean(territory.collection)} status={territoryStatus} onTool={(tool) => { setTerritoryTool(tool); setTerritoryStatus(tool === 'click' ? 'Clique em um setor para selecionar ou remover.' : tool === 'box' ? 'Arraste para desenhar um retângulo sobre os setores.' : 'Arraste para desenhar uma área sobre os setores.') }} onOperation={setTerritoryOperation} onFit={fitSectors} onAll={() => { if (territory.collection) { applySectorSelection(new Set(territory.collection.features.map((feature) => String(feature.id)))); setTerritoryStatus('Todos os setores urbanos foram selecionados.') } }} onInvert={() => { if (territory.collection) { applySectorSelection(new Set(territory.collection.features.filter((feature) => !selectedSectors.has(String(feature.id))).map((feature) => String(feature.id)))); setTerritoryStatus('Seleção de setores invertida.') } }} onClear={() => { applySectorSelection(new Set()); setTerritoryStatus('Seleção territorial limpa.') }} onBack={() => setSectorSelectionMode(false)} onClose={finishTerritory} /> : <PointToolbar tool={pointTool} selected={activeSelection.size} total={points.length} linked={linked} editable={editable && visibleIds.has(activeLayer.id)} busy={editingBusy} dirty={editor.draft(activeLayer).dirty} canUndo={editor.draft(activeLayer).past.length > 0} canRedo={editor.draft(activeLayer).future.length > 0} status={!visibleIds.has(activeLayer.id) ? 'Ative a visibilidade da camada para editar.' : activeLayer.segmentation ? 'Selecione uma camada de pontos para editar.' : !layers.points || view !== 'points' ? 'Exiba os pontos para editar a camada.' : pointStatus} onTool={setPointTool} onAll={() => editor.selectAll(activeLayer)} onInvert={() => editor.invert(activeLayer)} onClear={clearPoints} onDelete={() => { editor.remove(activeLayer); setSelected(null); setPointStatus('Seleção apagada nesta sessão.') }} onUndo={() => { editor.history(activeLayer, false); setSelected(null) }} onRedo={() => { editor.history(activeLayer, true); setSelected(null) }} />)) : <div className="editor-floating-toolbar ar-glass" role="group" aria-label={`Ferramentas de ${contextLabels[context].toLowerCase()}`} inert={panelsCoverMap} hidden={panelsCoverMap}>
      <span className="editor-toolbar-context">{contexts.find((item) => item.id === context)?.label}</span>
      {context === 'area' && <><button type="button" aria-pressed={!selectingSectors} onClick={() => setSectorSelectionMode(false)}><MousePointer2 size={19} /><span>Navegar</span></button><button type="button" aria-pressed={selectingSectors} onClick={() => { setSectorsEnabled(true); setSectorSelectionMode(true) }} title="Selecionar setores por clique"><MapPin size={19} /><span>Selecionar setores</span></button></>}
      {context === 'review' && <button type="button" aria-pressed="true"><MousePointer2 size={19} /><span>Selecionar item</span></button>}
      <button type="button" aria-pressed={layers.points} onClick={() => toggleLayer('points', !layers.points)}><MapPin size={19} /><span>{layers.points ? 'Ocultar pontos' : 'Mostrar pontos'}</span></button>
      <button type="button" aria-pressed={layers.segments} disabled={!hasSegmentation} title={hasSegmentation ? 'Exibir ou ocultar os polígonos de copa da análise v2' : 'A segmentação aparece após uma análise com o Modelo v2'} onClick={toggleSegmentation}><ScanLine size={19} /><span>{layers.segments ? 'Ocultar segmentação' : 'Visualizar segmentação'}</span></button>
      <button type="button" aria-pressed={view === 'density'} onClick={() => setView(view === 'density' ? 'points' : 'density')}><Layers size={19} /><span>{view === 'density' ? 'Densidade ativa' : 'Ver densidade'}</span></button>
    </div>)}
  </section>
}
