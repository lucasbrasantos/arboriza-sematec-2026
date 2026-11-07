import { useEffect, useId, useRef } from 'react'
import { Blend, Check, ChevronUp, Info, Leaf, Map as MapIcon, Route, X } from 'lucide-react'
import aerialPreview from '../../assets/samples/centro.jpg'
import { heatPalettes, priorityLabels } from './map-data'
import type { BaseMap, HeatColors, HeatPalette, MapView, Priority } from './map-data'
import './map-display-controls.css'

export type DisplayPanel = 'base' | 'view' | 'legend' | null
type MapDisplayControlsProps = {
  base: BaseMap
  view: MapView
  palette: HeatPalette
  customColors: HeatColors
  active: DisplayPanel
  onBase: (base: BaseMap) => void
  onView: (view: MapView) => void
  onPalette: (palette: HeatPalette) => void
  onCustomColors: (colors: HeatColors) => void
  onPanel: (panel: DisplayPanel) => void
}
const paletteOptions = [
  { id: 'forest', label: 'Vegetal' }, { id: 'sun', label: 'Solar' },
  { id: 'blue', label: 'Azul' }, { id: 'custom', label: 'Personalizada' },
] as const

function BasePreview({ base }: { base: BaseMap }) {
  return <span className={`map-base-preview map-base-preview--${base}`} aria-hidden="true">{base === 'aerial' ? <img src={aerialPreview} alt="" /> : <MapIcon size={36} strokeWidth={1.3} />}</span>
}

function DensityScale({ colors }: { colors: HeatColors }) {
  return <div className="map-density-scale"><div style={{ background: `linear-gradient(90deg, ${colors.low}, ${colors.high})` }} /><p><span>Menor concentração</span><span>Maior concentração</span></p></div>
}

export default function MapDisplayControls({ base, view, palette, customColors, active, onBase, onView, onPalette, onCustomColors, onPanel }: MapDisplayControlsProps) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const baseButton = useRef<HTMLButtonElement>(null)
  const viewButton = useRef<HTMLButtonElement>(null)
  const legendButton = useRef<HTMLButtonElement>(null)
  const colors = palette === 'custom' ? customColors : heatPalettes[palette].colors

  useEffect(() => {
    if (!active) return
    heading.current?.focus()
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) onPanel(null)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [active, onPanel])

  function close() {
    const target = active === 'base' ? baseButton : active === 'view' ? viewButton : legendButton
    onPanel(null)
    target.current?.focus()
  }

  return <div className="map-display-controls" ref={root} onKeyDown={(event) => { if (event.key === 'Escape' && active) { event.stopPropagation(); close() } }}>
    <button ref={baseButton} type="button" className="map-base-trigger" aria-label="Escolher mapa de fundo" aria-expanded={active === 'base'} aria-controls={id} onClick={() => onPanel(active === 'base' ? null : 'base')}><BasePreview base={base} /><span>Mapa base <ChevronUp size={12} /></span></button>
    <div className="map-display-shortcuts"><button ref={viewButton} type="button" aria-label="Escolher tipo de visualização" aria-expanded={active === 'view'} aria-controls={id} onClick={() => onPanel(active === 'view' ? null : 'view')}><Blend size={17} /><span>Visualização</span><small>{view === 'points' ? 'Pontos' : 'Densidade'}</small></button><button ref={legendButton} type="button" aria-expanded={active === 'legend'} aria-controls={id} onClick={() => onPanel(active === 'legend' ? null : 'legend')}><Info size={17} /><span>Entenda o mapa</span></button></div>
    {active && <section id={id} className="map-display-popover" aria-labelledby={`${id}-title`}>
      <header><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{active === 'base' ? 'Mapa de fundo' : active === 'view' ? 'Como observar os dados' : 'Entenda o mapa'}</h2><button type="button" onClick={close} aria-label="Fechar opções do mapa"><X size={18} /></button></header>
      {active === 'base' && <><p>Escolha a imagem sob os dados.</p><div className="map-base-cards">{(['aerial', 'streets'] as const).map((option) => <button key={option} type="button" aria-pressed={base === option} onClick={() => onBase(option)}><BasePreview base={option} /><span>{option === 'aerial' ? 'Imagem aérea' : 'Ruas'}{base === option && <Check size={15} />}</span><small>{option === 'aerial' ? 'IGC / DataGEO' : 'OpenStreetMap'}</small></button>)}</div></>}
      {active === 'view' && <><p>A base cartográfica continua a mesma.</p><div className="map-view-options"><button type="button" aria-pressed={view === 'points'} onClick={() => onView('points')}><Leaf size={20} /><span><strong>Pontos individuais</strong><small>Consultar cada marcação</small></span>{view === 'points' && <Check size={16} />}</button><button type="button" aria-pressed={view === 'density'} onClick={() => onView('density')}><Blend size={20} /><span><strong>Densidade de pontos</strong><small>Observar a concentração relativa</small></span>{view === 'density' && <Check size={16} />}</button></div>
        {view === 'density' && <div className="map-palette-controls"><label htmlFor={`${id}-palette`}>Paleta da densidade</label><select id={`${id}-palette`} value={palette} onChange={(event) => { const option = paletteOptions.find((item) => item.id === event.target.value); if (option) onPalette(option.id) }}>{paletteOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
          {palette === 'custom' && <div className="map-custom-colors"><label>Menor concentração<input type="color" value={customColors.low} onInput={(event) => onCustomColors({ ...customColors, low: event.currentTarget.value })} /></label><label>Maior concentração<input type="color" value={customColors.high} onInput={(event) => onCustomColors({ ...customColors, high: event.currentTarget.value })} /></label></div>}
          <DensityScale colors={colors} />
        </div>}
        <p className="map-visualization-note">Dados fictícios. A densidade não mede temperatura nem cobertura de copas; sua aparência varia com o zoom.</p>
      </>}
      {active === 'legend' && <div className="map-legend-content">{view === 'density' ? <><p><Blend size={17} /><span>Densidade relativa dos pontos ilustrativos</span></p><DensityScale colors={colors} /></> : <p><Leaf size={17} /><span>Ponto: possível árvore, neste exemplo</span></p>}<p><Route size={17} /><span>Trecho: prioridade ilustrativa</span></p>{(['high', 'medium', 'low'] satisfies Priority[]).map((priority) => <p key={priority}><span className={`map-legend-line map-priority--${priority}`} /><span>{priorityLabels[priority]}</span></p>)}<p><span className="map-legend-boundary" /><span>Recorte de demonstração</span></p><small>Prioridades fictícias. Contagem de pontos não mede cobertura de copas.</small></div>}
    </section>}
  </div>
}
