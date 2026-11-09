import { useState } from 'react'
import { Layers, MapPin, X } from 'lucide-react'
import MapResultGroup from '../../map/components/MapResultGroup'
import type { ResultGroupView } from '../../map/components/MapResultGroup'
import type { MapItem } from '../../map/data/map-data'
import ResultLayerManager from './ResultLayerManager'
import type { ResultLayer } from '../data/result-layers'

type Props = {
  open: boolean; onClose: () => void; layers: readonly ResultLayer[]; activeLayer: ResultLayer
  visibleIds: ReadonlySet<string>; autoFit: boolean; onAutoFit: (value: boolean) => void
  onActivate: (id: string) => void; onVisible: (id: string, visible: boolean) => void
  onFit: (layer: ResultLayer) => void; onFitVisible: () => void; selected: MapItem | null; onSelect: (item: MapItem) => void
  tab: 'layers' | 'points'; onTab: (tab: 'layers' | 'points') => void
  onRemove: (ids: string[]) => void
  loadError: string; onRetryLoad: () => void
}
export default function ResultsPanelV2({ open, onClose, layers, activeLayer, visibleIds, autoFit, onAutoFit, onActivate, onVisible, onFit, onFitVisible, selected, onSelect, tab, onTab, loadError, onRetryLoad, onRemove }: Props) {
  const [group, setGroup] = useState<ResultGroupView>({ scope: '', open: true, page: 1 })
  const points = activeLayer.items.filter((item) => item.kind === 'point')
  return <aside id="editor-results-panel-v2" className="editor-inspector ar-glass v2-results-panel" hidden={!open} aria-label="Camadas e pontos" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><div><span className="v2-eyebrow">EXPLORAR RESULTADOS</span><strong>Camadas e pontos</strong></div><button type="button" className="editor-icon-button" onClick={onClose} aria-label="Recolher camadas e pontos"><X size={18} /></button></header>
    <div className="v2-results-tabs" role="group" aria-label="Explorar resultados"><button type="button" aria-pressed={tab === 'layers'} onClick={() => onTab('layers')}><Layers size={16} /> Camadas <span>{layers.length}</span></button><button type="button" aria-pressed={tab === 'points'} onClick={() => onTab('points')}><MapPin size={16} /> Pontos <span>{points.length}</span></button></div>
    <div className="editor-panel-body v2-results-body">
      {loadError && <div className="editor-note" role="alert"><p>Não foi possível carregar o resultado: {loadError} <button type="button" onClick={onRetryLoad}>Tentar novamente</button></p></div>}
      <div hidden={tab !== 'layers'}><ResultLayerManager layers={layers} activeId={activeLayer.id} visibleIds={visibleIds} autoFit={autoFit} onAutoFit={onAutoFit} onActivate={onActivate} onVisible={onVisible} onFit={onFit} onFitVisible={onFitVisible} onRemove={onRemove} /></div>
      <div hidden={tab !== 'points'}><p className="v2-layer-label">CAMADA ATIVA</p><strong className="v2-layer-name">{activeLayer.name}</strong><p>Selecione um ponto na lista ou no mapa.</p>{points.length ? <MapResultGroup kind="point" realData={!activeLayer.origin.includes('demonstrativa')} items={points} view={group} onToggle={() => setGroup((current) => ({ ...current, open: !current.open }))} onPage={(page) => setGroup((current) => ({ ...current, page }))} onSelect={onSelect} /> : <p className="editor-note">Esta camada não possui pontos.</p>}{selected?.kind === 'point' && activeLayer.items.some((item) => item.id === selected.id) && <div className="v2-point-detail"><span className="v2-layer-label">PONTO SELECIONADO</span><strong>{selected.label}</strong><small>{selected.position.map((coordinate) => coordinate.toFixed(6)).join(', ')}</small></div>}</div>
    </div>
  </aside>
}
