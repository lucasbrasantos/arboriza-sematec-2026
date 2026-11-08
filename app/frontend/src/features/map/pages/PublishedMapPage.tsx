import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { GeoJSON } from 'react-leaflet'
import type { FeatureCollection, Geometry } from 'geojson'
import { Layers, PanelLeft, X } from 'lucide-react'
import { api } from '../../auth/services/api'
import MapCanvas from '../components/MapCanvas'
import MapSiteNavigation from '../components/MapSiteNavigation'
import MapResultGroup from '../components/MapResultGroup'
import type { ResultGroupView } from '../components/MapResultGroup'
import { areas, heatPalettes, normalizeSearch } from '../data/map-data'
import type { BaseMap, MapArea, MapItem, MapView, PointItem } from '../data/map-data'
import '../styles/map.css'
import '../styles/published-map.css'

type PublishedPackage = { id: string; name: string; published_at: string; bounds: MapArea['bounds'][]; data: FeatureCollection<Geometry, Record<string, unknown>> }
export default function PublishedMapPage() {
  const [packages, setPackages] = useState<PublishedPackage[]>([])
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [base, setBase] = useState<BaseMap>('aerial')
  const [view, setView] = useState<MapView>('points')
  const [pointsVisible, setPointsVisible] = useState(true)
  const [crownsVisible, setCrownsVisible] = useState(true)
  const [selected, setSelected] = useState<MapItem | null>(null)
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<ResultGroupView>({ scope: '', open: false, page: 1 })
  useEffect(() => { document.title = 'Mapa público | Arboriza'; const media = window.matchMedia('(max-width: 899px)'); const resize = () => setCompact(media.matches); media.addEventListener('change', resize); return () => media.removeEventListener('change', resize) }, [])
  useEffect(() => {
    const controller = new AbortController()
    api<PublishedPackage[]>('/publico/pacotes', { signal: controller.signal }, false).then((value) => { if (!controller.signal.aborted) { setPackages(value); setVisible(new Set(value.map((item) => item.id))); setError('') } }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])
  const displayed = useMemo(() => packages.filter((item) => visible.has(item.id)), [packages, visible])
  const points = useMemo<PointItem[]>(() => displayed.flatMap((item) => item.data.features.flatMap((feature) => feature.geometry.type === 'Point' ? [{ id: String(feature.id), kind: 'point' as const, area: 'cidade' as const, label: String(feature.properties.label ?? 'Possível árvore'), position: [feature.geometry.coordinates[1] ?? 0, feature.geometry.coordinates[0] ?? 0] as [number, number], properties: { ...feature.properties, publicado: true, pacote: item.name } }] : [])), [displayed])
  const colors = useMemo(() => Object.fromEntries(points.map((point) => [point.id, String(point.properties?.color ?? '#176b49')])), [points])
  const area = useMemo<MapArea>(() => {
    const bounds = displayed.flatMap((item) => item.bounds)
    return { ...areas.cidade, hasExamples: false, label: 'Resultados publicados', ...(bounds.length ? { bounds: [[Math.min(...bounds.map((value) => value[0][0])), Math.min(...bounds.map((value) => value[0][1]))], [Math.max(...bounds.map((value) => value[1][0])), Math.max(...bounds.map((value) => value[1][1]))]] as MapArea['bounds'] } : {}) }
  }, [displayed])
  const results = points.filter((point) => normalizeSearch(`${point.label} ${point.properties?.pacote} ${point.properties?.categoria}`).includes(normalizeSearch(query)))
  return <section className="public-map-page published-map" aria-labelledby="public-map-title"><header className="map-floating-nav"><MapSiteNavigation onOpen={() => {}} /><Link to="/">Arboriza</Link><div><h1 id="public-map-title">Araçatuba</h1><p>Resultados revisados e publicados</p></div><button type="button" className="map-panel-toggle" aria-expanded={open} aria-controls="published-sidebar" onClick={() => setOpen(!open)}><PanelLeft size={20} />{open ? 'Recolher' : 'Explorar'}</button></header><div className="map-workspace" data-panel-open={open}>
    <aside id="published-sidebar" className="map-sidebar ar-glass" hidden={!open}><div className="map-sidebar-heading"><strong><Layers size={17} /> Acervo público</strong><button type="button" className="map-icon-button" aria-label="Recolher painel" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="map-sidebar-body">{loading && <p role="status">Carregando resultados publicados…</p>}{error && <p role="alert">{error}<button onClick={() => { setLoading(true); setAttempt(attempt + 1) }}>Tentar novamente</button></p>}{!loading && !error && !packages.length && <p>Nenhum resultado foi publicado pela equipe ainda. Você pode navegar pela base cartográfica.</p>}{packages.map((item) => <label className="published-package" key={item.id}><input type="checkbox" checked={visible.has(item.id)} onChange={(event) => { setVisible((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next }); setSelected(null) }} /><span><strong>{item.name}</strong><small>Publicado em {new Date(item.published_at).toLocaleString('pt-BR')}</small></span></label>)}<fieldset><legend>Visualização</legend><label><input type="checkbox" checked={pointsVisible} onChange={(event) => setPointsVisible(event.target.checked)} />Pontos</label><label><input type="checkbox" checked={crownsVisible} onChange={(event) => setCrownsVisible(event.target.checked)} />Copas</label><label><input type="checkbox" checked={view === 'density'} onChange={(event) => setView(event.target.checked ? 'density' : 'points')} />Densidade de posições únicas</label><label>Base<select value={base} onChange={(event) => setBase(event.target.value === 'streets' ? 'streets' : 'aerial')}><option value="aerial">Imagem aérea · IGC / DataGEO</option><option value="streets">Ruas · OpenStreetMap</option></select></label></fieldset><label className="map-field-label">Buscar pontos<input value={query} onChange={(event) => { setQuery(event.target.value); setGroup({ scope: '', open: true, page: 1 }) }} /></label><p>{points.length.toLocaleString('pt-BR')} marcações publicadas nas camadas exibidas.</p>{results.length > 0 && <MapResultGroup kind="point" realData items={results} view={group} onToggle={() => setGroup((current) => ({ ...current, open: !current.open }))} onPage={(page) => setGroup((current) => ({ ...current, page }))} onSelect={(point) => { setSelected(point); if (compact) setOpen(false) }} />}{selected?.kind === 'point' && <section><h2>{selected.label}</h2><p>Pacote: {String(selected.properties?.pacote)}</p><p>{selected.position.map((value) => value.toFixed(6)).join(', ')}</p><button onClick={() => setSelected(null)}>Limpar seleção</button></section>}<details><summary>Legenda e limites</summary><p>Copas verdes: individuais. Laranja: grupos. Azul: complementos pendentes, que não são árvores confirmadas.</p><p>Pontos representam propostas do modelo revisadas pela equipe. Densidade mostra concentração de posições e não cobertura de copas, temperatura ou a regra 3-30-300.</p></details></div></aside>
    <div className="map-canvas-wrap" role="region" aria-label="Mapa de resultados publicados" inert={compact && open}><MapCanvas prototypeDensity area={area} base={base} layers={{ points: pointsVisible, segments: crownsVisible, boundary: false }} items={points} pointColors={colors} selected={selected} view={view} heatColors={heatPalettes.forest.colors} leftInset={open && !compact ? 368 : 0} onSelect={setSelected} onClear={() => setSelected(null)}>{crownsVisible && displayed.map((item) => <GeoJSON key={item.id} data={{ ...item.data, features: item.data.features.filter((feature) => feature.geometry.type !== 'Point') } as FeatureCollection<Geometry, Record<string, unknown>>} interactive={false} style={(feature) => ({ color: String(feature?.properties?.color ?? '#25b882'), weight: 2, fillOpacity: .18 })} />)}</MapCanvas><div className="map-view-caption">Camadas aprovadas pela equipe · consulta pública</div></div>
  </div></section>
}
