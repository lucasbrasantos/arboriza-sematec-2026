import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Info, PanelLeft } from 'lucide-react'
import MapCanvas from '../components/MapCanvas'
import MapSidebar from '../components/MapSidebar'
import MapDisplayControls from '../components/MapDisplayControls'
import MapSiteNavigation from '../components/MapSiteNavigation'
import type { DisplayPanel } from '../components/MapDisplayControls'
import { areas, demoItems, heatPalettes } from '../data/map-data'
import type { AreaId, BaseMap, HeatColors, HeatPalette, LayerVisibility, MapItem, MapView } from '../data/map-data'
import { paths } from '../../../shared/config/paths'
import logo from '../../../assets/brand/logo-vertical.svg'
import '../styles/map.css'

export default function MapPage() {
  const [areaId, setAreaId] = useState<AreaId>('centro')
  const [base, setBase] = useState<BaseMap>('aerial')
  const [layers, setLayers] = useState<LayerVisibility>({ points: true, segments: true, boundary: true })
  const [selected, setSelected] = useState<MapItem | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<MapView>('points')
  const [palette, setPalette] = useState<HeatPalette>('sun')
  const [customColors, setCustomColors] = useState<HeatColors>({ low: '#bce0dc', high: '#214c74' })
  const [displayPanel, setDisplayPanel] = useState<DisplayPanel>(null)
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  const [panelOpen, setPanelOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  const panelToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => { document.title = 'Mapa público | Arboriza' }, [])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)')
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const area = areas[areaId]
  const items = useMemo(() => demoItems.filter((item) => item.area === areaId), [areaId])
  const heatColors = palette === 'custom' ? customColors : heatPalettes[palette].colors

  function changeArea(id: AreaId) { setAreaId(id); setSelected(null); setQuery(''); setDisplayPanel(null) }
  function select(item: MapItem) { setSelected(item); setPanelOpen(true); setDisplayPanel(null) }
  function closePanel() { setPanelOpen(false); panelToggle.current?.focus() }
  function changeLayer(layer: keyof LayerVisibility, visible: boolean) {
    setLayers((current) => ({ ...current, [layer]: visible }))
    if (!visible && selected && ((layer === 'points' && selected.kind === 'point') || (layer === 'segments' && selected.kind === 'segment'))) setSelected(null)
  }

  return <section className="public-map-page" aria-labelledby="public-map-title">
    <header className="map-floating-nav">
      <MapSiteNavigation onOpen={() => setDisplayPanel(null)} />
      <Link to={paths.home} className="map-home-link" aria-label="Voltar ao site Arboriza" title="Voltar ao site"><img src={logo} alt="" /></Link>
      <div><h1 id="public-map-title">Araçatuba</h1><p>Arboriza · demonstração</p></div>
      <button ref={panelToggle} type="button" className="map-panel-toggle" aria-controls="map-sidebar" aria-expanded={panelOpen} aria-label={panelOpen ? 'Recolher painel' : 'Explorar mapa'} title={panelOpen ? 'Recolher painel' : 'Explorar mapa'} onClick={() => { setDisplayPanel(null); if (panelOpen) closePanel(); else setPanelOpen(true) }}><PanelLeft size={20} /><span>{panelOpen ? 'Recolher' : 'Explorar'}</span></button>
    </header>
    <div className="map-workspace" data-panel-open={panelOpen}>
      <MapSidebar open={panelOpen} areaId={areaId} layers={layers} items={items} selected={selected} query={query} onQuery={setQuery} onArea={changeArea} onLayer={changeLayer} onSelect={select} onBack={() => setSelected(null)} onClose={closePanel} />
      <div className="map-canvas-wrap" role="region" aria-label="Mapa interativo de Araçatuba" inert={compact && panelOpen}>
        <MapCanvas area={area} base={base} layers={layers} items={items} selected={selected} view={view} heatColors={heatColors} leftInset={panelOpen && !compact ? 368 : 0} onSelect={select} onClear={() => setSelected(null)} />
        <div className="map-view-caption"><Info size={14} /><span>{area.hasExamples ? `${area.label} · ${view === 'density' ? 'densidade ilustrativa' : 'marcações fictícias'}` : 'Vista da cidade · sem resultados publicados'}</span></div>
      </div>
      <div className="map-display-overlay" inert={compact && panelOpen}><MapDisplayControls base={base} view={view} palette={palette} customColors={customColors} active={displayPanel} onBase={setBase} onView={setView} onPalette={setPalette} onCustomColors={setCustomColors} onPanel={setDisplayPanel} /></div>
    </div>
  </section>
}
