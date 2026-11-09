import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '../../auth/services/api'
import { useAuth } from '../../auth/context/AuthContext'
import MapCanvas from '../../map/components/MapCanvas'
import { areas, heatPalettes } from '../../map/data/map-data'
import type { BaseMap, MapArea, MapItem } from '../../map/data/map-data'
import WorkspaceOverlays from '../components/WorkspaceOverlays'
import { combineBounds } from '../data/result-layers'
import type { WorkspaceSnapshot } from '../data/workspace-files'
import '../../map/styles/map.css'
import '../styles/archive-review.css'

type ArchivePackage = { id: string; name: string; state: 'nao_revisado' | 'aprovado' | 'publicado'; territory_key: string | null; snapshot: WorkspaceSnapshot }
const stateLabels = { nao_revisado: 'Aguardando revisão', aprovado: 'Revisão aprovada', publicado: 'Publicado' }

export default function ArchiveReviewPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [record, setRecord] = useState<ArchivePackage | null>(null)
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<MapItem | null>(null)
  const [base, setBase] = useState<BaseMap>('aerial')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    if (id) api<ArchivePackage>(`/acervo/${encodeURIComponent(id)}`, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) { setRecord(value); setVisible(new Set(value.snapshot.visible_ids)) }
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o pacote.') })
    return () => controller.abort()
  }, [id])
  const layers = useMemo(() => record?.snapshot.layers ?? [], [record])
  const displayed = useMemo(() => layers.filter((layer) => visible.has(layer.id)), [layers, visible])
  const points = useMemo(() => displayed.flatMap((layer) => layer.items), [displayed])
  const colors = useMemo(() => Object.fromEntries(displayed.flatMap((layer) => layer.items.map((item) => [item.id, layer.color]))), [displayed])
  const bounds = useMemo(() => combineBounds(layers), [layers])
  const area = useMemo<MapArea>(() => ({ ...areas.cidade, hasExamples: false, label: record?.name ?? 'Pacote', ...(bounds ? { bounds } : {}) }), [record?.name, bounds])
  async function approve() {
    if (!record || !checked) return
    setBusy(true); setError('')
    try {
      await api(`/acervo/${encodeURIComponent(record.id)}/aprovar`, { method: 'POST' })
      setRecord((current) => current ? { ...current, state: 'aprovado' } : current)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível aprovar o pacote.') }
    finally { setBusy(false) }
  }
  return <section className="archive-review" aria-label="Revisão do pacote">
    <div className="archive-review-map"><MapCanvas area={area} base={base} layers={{ points: true, segments: true, boundary: false }} items={points} selected={selected} view="points" heatColors={heatPalettes.forest.colors} leftInset={0} onSelect={setSelected} onClear={() => setSelected(null)} pointColors={colors}>
      <WorkspaceOverlays layers={displayed} allLayers={layers} visibleIds={visible} selectedIds={new Set(selected ? [selected.id] : [])} activeId="" showBounds={false} showSegmentation sectors={null} selectedSectors={new Set()} onSector={() => {}} selectSectors={false} crownsInteractive={false} onCrownSelect={() => {}} />
    </MapCanvas></div>
    <aside className="archive-review-panel"><Link className="archive-review-back" to="/admin/acervo"><ArrowLeft size={16} /> Voltar ao acervo</Link>
      {!record ? <p role={error ? 'alert' : 'status'}>{error || 'Carregando pacote para revisão…'}</p> : <>
        <header><p>Revisão do acervo</p><h1>{record.name}</h1><span>{stateLabels[record.state]}</span></header>
        <div className="archive-review-content"><h2>Confira o resultado no mapa</h2><p>Esta tela mostra somente as camadas deste pacote. Ative ou oculte camadas para examiná-las; essa escolha não altera o que será publicado.</p>
          <div className="archive-review-layers">{layers.map((layer) => <label key={layer.id}><input type="checkbox" checked={visible.has(layer.id)} onChange={(event) => setVisible((current) => { const next = new Set(current); if (event.target.checked) next.add(layer.id); else next.delete(layer.id); return next })} /><span className="archive-review-color" style={{ background: layer.color }} /><span><strong>{layer.name}</strong><small>{layer.segmentation ? `${layer.segmentation.features.length.toLocaleString('pt-BR')} copas` : `${layer.items.length.toLocaleString('pt-BR')} pontos`} · {layer.territory?.ids.length ?? 0} setores · {record.snapshot.visible_ids.includes(layer.id) ? 'Será publicada' : 'Não será publicada'}</small></span></label>)}</div>
          <button type="button" className="archive-review-base" onClick={() => setBase(base === 'aerial' ? 'streets' : 'aerial')}>{base === 'aerial' ? 'Ver mapa de ruas' : 'Ver imagem aérea'}</button>
          {record.state === 'nao_revisado' && <p>Precisa corrigir algum ponto? <Link to={`/admin/mapa?pacote=${encodeURIComponent(record.id)}`}>Abra o pacote no editor</Link>, faça os ajustes e envie um novo pacote ao acervo.</p>}
          {selected && <p className="archive-review-selected"><strong>Ponto selecionado:</strong> {selected.label}</p>}
          {!record.territory_key && <p className="archive-review-error">Há camadas sem território conferido. Associe os setores no mapa administrativo e envie um novo pacote.</p>}
          {error && <p className="archive-review-error" role="alert">{error}</p>}
        </div>
        <footer>{record.state === 'nao_revisado' ? user?.role === 'admin' ? <><label><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /> Conferi os pontos, as copas e a origem territorial.</label><button type="button" disabled={!checked || !record.territory_key || busy} onClick={() => void approve()}>{busy ? 'Aprovando…' : 'Aprovar revisão'}</button><small>A aprovação não publica o pacote.</small></> : <p>Somente administradores podem aprovar este pacote.</p> : <><p className="archive-review-success"><CheckCircle2 size={18} /> {stateLabels[record.state]}</p><p>{record.state === 'aprovado' ? 'A revisão foi aprovada. A publicação é feita no acervo.' : 'Este pacote está disponível no mapa público.'}</p></>}</footer>
      </>}
    </aside>
  </section>
}
