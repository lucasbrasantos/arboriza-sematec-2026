import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Geometry } from 'geojson'
import { Layers, MapPin, PanelLeft, ScanLine, TreePine, Waves, Map as MapIcon, X } from 'lucide-react'
import { api } from '../../auth/services/api'
import MapCanvas from '../components/MapCanvas'
import MapSiteNavigation from '../components/MapSiteNavigation'
import { areas, heatPalettes } from '../data/map-data'
import type { BaseMap, MapArea, MapView, PointItem } from '../data/map-data'
import { readSectors } from '../../admin/data/territory-data'
import type { SectorCollection } from '../../admin/data/territory-data'
import StreetWorkspace from '../../admin/components/StreetWorkspace'
import { StreetMap } from '../../admin/components/StreetDiagnostic'
import type { StreetResult } from '../../admin/components/StreetDiagnostic'
import { initialStreetView } from '../../admin/streets/street-view'
import type { StreetView } from '../../admin/streets/street-view'
import logo from '../../../assets/brand/logo-vertical.svg'
import '../styles/map.css'
import '../styles/published-map.css'
import '../../admin/styles/admin-editor.css'

type PublicLayer = { id: string; name: string; category: string; color: string; points: number; segmentation: boolean; diagnostic_available: boolean }
type PublishedPackage = { id: string; name: string; published_at: string; sector_ids: string[]; layers: PublicLayer[]; bounds: MapArea['bounds'][]; data: FeatureCollection<Geometry, Record<string, unknown>> }
export default function PublishedMapPage() {
  const [packages, setPackages] = useState<PublishedPackage[]>([])
  const [packageId, setPackageId] = useState('')
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState('')
  const [sectorsVisible, setSectorsVisible] = useState(false)
  const [sectors, setSectors] = useState<SectorCollection | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [base, setBase] = useState<BaseMap>('aerial')
  const [view, setView] = useState<MapView>('points')
  const [pointsVisible, setPointsVisible] = useState(true)
  const [crownsVisible, setCrownsVisible] = useState(true)
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  const streetRequest = useRef<AbortController | null>(null)
  useEffect(() => () => streetRequest.current?.abort(), [])
  const [streetMode, setStreetMode] = useState(false)
  const [streetBusy, setStreetBusy] = useState(false)
  const [streetError, setStreetError] = useState('')
  const [streetResult, setStreetResult] = useState<StreetResult | null>(null)
  const [streetSelected, setStreetSelected] = useState<string | null>(null)
  const [streetView, setStreetView] = useState<StreetView>(initialStreetView)
  const [distance, setDistance] = useState('25')
  useEffect(() => { document.title = 'Mapa público | Arboriza'; const media = window.matchMedia('(max-width: 899px)'); const update = () => setCompact(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update) }, [])
  useEffect(() => { const controller = new AbortController(); api<PublishedPackage[]>('/publico/pacotes', { signal: controller.signal }, false).then((value) => { if (controller.signal.aborted) return; setPackages(value); const first = value[0]; setPackageId(first?.id ?? ''); setVisible(new Set((first?.layers ?? []).map((layer) => layer.id))); setActiveId(first?.layers?.find((layer) => !layer.segmentation)?.id ?? ''); setError('') }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [attempt])
  useEffect(() => { if (!sectorsVisible || sectors) return; const controller = new AbortController(); fetch('/data/setores-urbanos-aracatuba-ibge-2022.geojson', { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('Não foi possível carregar os setores.'); return response.json() }).then(readSectors).then((value) => { if (!controller.signal.aborted) setSectors(value) }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message) }); return () => controller.abort() }, [sectorsVisible, sectors])
  const selectedPackage = packages.find((item) => item.id === packageId)
  const features = useMemo(() => selectedPackage?.data.features.filter((feature) => visible.has(String(feature.properties.camada_id))) ?? [], [selectedPackage, visible])
  const points = useMemo<PointItem[]>(() => features.flatMap((feature) => feature.geometry.type === 'Point' ? [{ id: String(feature.id), kind: 'point' as const, area: 'cidade' as const, label: String(feature.properties.label ?? 'Possível árvore'), position: [feature.geometry.coordinates[1] ?? 0, feature.geometry.coordinates[0] ?? 0] as [number, number], properties: { ...feature.properties, publicado: true } }] : []), [features])
  const visibleCrowns = useMemo(() => new Set(points.flatMap((point) => typeof point.properties?.copa_id === 'string' ? [point.properties.copa_id] : [])), [points])
  const diagnosticPoints = useMemo(() => points.filter((point) => point.properties?.camada_id === activeId).map((point) => [point.position[1], point.position[0]]), [points, activeId])
  const colors = useMemo(() => Object.fromEntries(points.map((point) => [point.id, String(point.properties?.color ?? '#176b49')])), [points])
  const area = useMemo<MapArea>(() => { const bounds = selectedPackage?.bounds ?? []; return { ...areas.cidade, hasExamples: false, label: selectedPackage?.name ?? 'Araçatuba', ...(bounds.length ? { bounds: [[Math.min(...bounds.map((value) => value[0][0])), Math.min(...bounds.map((value) => value[0][1]))], [Math.max(...bounds.map((value) => value[1][0])), Math.max(...bounds.map((value) => value[1][1]))]] as MapArea['bounds'] } : {}) } }, [selectedPackage])
  const active = selectedPackage?.layers?.find((layer) => layer.id === activeId)
  const canRun = Boolean(selectedPackage && active?.diagnostic_available && active.points > 0 && visible.has(active.id) && Number(distance) >= 5 && Number(distance) <= 100)
  function choose(item: PublishedPackage) { setPackageId(item.id); setVisible(new Set((item.layers ?? []).map((layer) => layer.id))); setActiveId(item.layers?.find((layer) => !layer.segmentation)?.id ?? '') }
  async function runStreet() {
    if (!canRun || !selectedPackage || !active) return
    const controller = new AbortController(); streetRequest.current?.abort(); streetRequest.current = controller
    setStreetMode(true); setStreetBusy(true); setStreetError(''); setStreetResult(null); setStreetSelected(null); setStreetView(initialStreetView)
    try { const result = await api<StreetResult>(`/publico/pacotes/${encodeURIComponent(selectedPackage.id)}/ruas`, { method: 'POST', body: JSON.stringify({ layer_id: active.id, layer_ids: [...visible], distancia_m: Number(distance) }), signal: controller.signal }, false); if (!controller.signal.aborted) setStreetResult(result) }
    catch (reason) { if (!controller.signal.aborted) setStreetError(reason instanceof Error ? reason.message : 'Não foi possível consultar as ruas.') }
    finally { if (streetRequest.current === controller) { streetRequest.current = null; setStreetBusy(false) } }
  }
  return <section className="admin-editor public-map-page published-map" data-street-mode={streetMode} data-street-background={streetView.background} aria-labelledby="public-map-title"><header className="map-floating-nav"><MapSiteNavigation onOpen={() => {}} /><Link to="/" className="map-home-link" aria-label="Voltar ao site Arboriza"><img src={logo} alt="" /></Link><div><h1 id="public-map-title">Araçatuba</h1><p>Resultados revisados e publicados</p></div><button type="button" className="map-panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><PanelLeft size={20} />{open ? 'Recolher' : 'Explorar'}</button></header>
    <div id="street-workspace-slot" />{streetMode && <StreetWorkspace data={streetResult} name={selectedPackage?.name ?? 'Análise publicada'} busy={streetBusy} error={streetError} selected={streetSelected} view={streetView} autoFit onView={(patch) => setStreetView((current) => ({ ...current, ...patch }))} onSelect={setStreetSelected} onBack={() => { streetRequest.current?.abort(); streetRequest.current = null; setStreetBusy(false); setStreetMode(false); setStreetResult(null); setStreetSelected(null) }} onRetry={() => void runStreet()} />}
    <aside className="map-sidebar ar-glass public-tools-sidebar" hidden={!open || streetMode} aria-label="Explorar o mapa"><div className="map-sidebar-heading"><strong><Layers size={17} /> Explorar o mapa</strong><button type="button" className="map-icon-button" aria-label="Recolher painel" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="map-sidebar-body">{loading && <p role="status">Carregando resultados publicados…</p>}{error && <p role="alert">{error} <button onClick={() => { setLoading(true); setAttempt(attempt + 1) }}>Tentar novamente</button></p>}<details open><summary>Camadas publicadas</summary><p>Setores verdes pertencem à análise selecionada; a malha clara mostra os demais setores urbanos.</p>{packages.length === 0 && !loading && <p>Ainda não há resultados publicados.</p>}{packages.map((item) => <label className="published-package" key={item.id}><input type="radio" name="published-analysis" checked={packageId === item.id} onChange={() => choose(item)} /><span><strong>{item.name}</strong><small>Publicado em {new Date(item.published_at).toLocaleString('pt-BR')}</small></span></label>)}{selectedPackage && <div className="public-layer-list">{(selectedPackage.layers ?? []).map((layer) => <div key={layer.id} className="public-layer-row"><input type="checkbox" checked={visible.has(layer.id)} aria-label={`Exibir ${layer.name}`} onChange={(event) => setVisible((current) => { const next = new Set(current); if (event.target.checked) next.add(layer.id); else next.delete(layer.id); return next })} /><button type="button" aria-pressed={activeId === layer.id} onClick={() => setActiveId(layer.id)}><span style={{ background: layer.color }} /><strong>{layer.name}</strong><small>{layer.segmentation ? 'Copas' : `${layer.points} pontos`}{activeId === layer.id ? ' · Selecionada' : ''}</small></button></div>)}</div>}</details><details><summary>Diagnóstico de ruas</summary><p>Explore os trechos próximos à camada selecionada.</p><label>Distância de comparação (m)<input type="number" min="5" max="100" value={distance} onChange={(event) => setDistance(event.target.value)} /></label><button type="button" disabled={!canRun} onClick={() => void runStreet()}>Abrir diagnóstico de ruas</button><p>O v2 considera as camadas visíveis da mesma análise. Grupos não são árvores individuais; complementos pendentes ficam fora da cobertura.</p>{!active?.diagnostic_available && <p>Selecione uma camada publicada de análise territorial.</p>}</details></div></aside>
    <div className="editor-map map-canvas-wrap" role="region" aria-label="Mapa de resultados publicados" inert={!streetMode && compact && open}><MapCanvas prototypeDensity area={area} base={base} layers={{ points: pointsVisible, segments: crownsVisible, boundary: false }} items={streetMode ? [] : points} pointColors={colors} itemsInteractive={false} selected={null} view={streetMode ? 'points' : view} heatColors={heatPalettes.forest.colors} leftInset={open && !compact ? 368 : 0} onSelect={() => {}} onClear={() => {}}>{!streetMode && sectorsVisible && sectors && <GeoJSON key={`sectors:${packageId}`} data={sectors} interactive={false} style={(feature) => selectedPackage?.sector_ids?.includes(String(feature?.id)) ? { color: '#398260', weight: 1, fillColor: '#58a875', fillOpacity: .45 } : { color: '#8eac91', weight: .65, fillColor: '#dce9c8', fillOpacity: .35 }} />}{!streetMode && crownsVisible && selectedPackage && <GeoJSON key={`${packageId}:${[...visible].join(',')}`} data={{ ...selectedPackage.data, features: features.filter((feature) => feature.geometry.type !== 'Point' && visibleCrowns.has(String(feature.properties.copa_id))) } as FeatureCollection<Geometry, Record<string, unknown>>} interactive={false} style={(feature) => ({ color: String(feature?.properties?.color ?? '#25b882'), weight: 2, fillOpacity: .18 })} />}{streetResult && <StreetMap data={streetResult} selected={streetSelected} view={streetView} points={diagnosticPoints} onSelect={setStreetSelected} onClear={() => { setStreetSelected(null); setStreetView((current) => ({ ...current, rankedKeys: [] })) }} />}</MapCanvas></div>
    {!streetMode && <div className="public-view-toolbar" role="group" aria-label="Visualização do mapa"><button type="button" aria-pressed={pointsVisible} onClick={() => setPointsVisible(!pointsVisible)}><TreePine size={17} />Pontos</button><button type="button" aria-pressed={sectorsVisible} onClick={() => setSectorsVisible(!sectorsVisible)}><MapPin size={17} />Setores</button><button type="button" aria-pressed={crownsVisible} onClick={() => setCrownsVisible(!crownsVisible)}><ScanLine size={17} />Copas</button><button type="button" aria-pressed={view === 'density'} onClick={() => setView(view === 'density' ? 'points' : 'density')}><Waves size={17} />Densidade</button><button type="button" onClick={() => setBase(base === 'aerial' ? 'streets' : 'aerial')}><MapIcon size={17} />{base === 'aerial' ? 'Ruas' : 'Imagem aérea'}</button></div>}
  </section>
}
