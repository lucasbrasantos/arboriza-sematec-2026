import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Button from '../../../shared/ui/controls/Button'
import { api } from '../../auth/services/api'
import type { ResultLayer } from '../data/result-layers'
import { areas } from '../../map/data/map-data'

import { downloadJson, workspaceGeoJSON } from '../data/workspace-files'
import type { WorkspaceSnapshot } from '../data/workspace-files'
export default function WorkspaceFiles({ active, snapshot, revision, ready, issue, dirty, onSave, onImport, onTerritory }: { active: ResultLayer; snapshot: WorkspaceSnapshot; revision: number; ready: boolean; issue: string; dirty: boolean; onSave: () => Promise<void>; onImport: (layers: ResultLayer[]) => void; onTerritory: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  async function run(action: () => Promise<void>) { setBusy(true); setMessage(''); try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir.') } finally { setBusy(false) } }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    await run(async () => {
      if (file.size > 30_000_000) throw new Error('Use arquivos de até 30 MB.')
      const data = JSON.parse(await file.text())
      let imported: ResultLayer[]
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Use um GeoJSON FeatureCollection WGS84.')
      if (data.crs && !['EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:EPSG::4326'].includes(data.crs.properties?.name)) throw new Error('O arquivo precisa usar WGS84.')
      if (data.arboriza?.workspace) imported = data.arboriza.workspace.layers
      else {
        if (data.features.length > 50000 || data.features.some((feature: { geometry?: { type?: string } }) => feature.geometry?.type !== 'Point')) throw new Error('GeoJSON externo deve conter até 50.000 pontos. Para copas, use um pacote exportado pelo Arboriza.')
        const id = `import:${crypto.randomUUID()}`
        const items = data.features.map((feature: { properties?: Record<string, unknown>; geometry: { coordinates: number[] } }, index: number) => ({ id: `${id}:${index}`, kind: 'point', area: 'cidade', label: `Ponto importado ${index + 1}`, position: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]], properties: feature.properties ?? {} }))
        const lat = items.map((item: { position: number[] }) => item.position[0]), lon = items.map((item: { position: number[] }) => item.position[1])
        imported = [{ id, name: file.name.slice(0, 150), executionId: id, execution: 'Importação externa', origin: 'GeoJSON externo · território não conferido', category: 'Pontos importados', color: '#2b6685', createdAt: new Date().toISOString(), bounds: items.length ? [[Math.min(...lat), Math.min(...lon)], [Math.max(...lat), Math.max(...lon)]] : areas.cidade.bounds, items }]
      }
      const checked = await api<{ snapshot: WorkspaceSnapshot }>('/workspace/validar', { method: 'POST', body: JSON.stringify({ layers: imported, visible_ids: imported.map((layer) => layer.id), active_id: imported[0]?.id ?? '' }) })
      onImport(checked.snapshot.layers); setMessage('Arquivo importado. Salve o espaço de trabalho para preservá-lo.')
    })
  }
  function exportLayer() {
    const members = active.linkedCrowns ? snapshot.layers.filter((layer) => layer.executionId === active.executionId) : [active]
    downloadJson(workspaceGeoJSON({ layers: members, visible_ids: members.filter((layer) => snapshot.visible_ids.includes(layer.id)).map((layer) => layer.id), active_id: active.id }), 'arboriza-camada.geojson')
  }
  return <div className="workspace-files"><p className="v2-layer-label">CAMADA ATIVA</p><strong>{active.name}</strong><p>{active.items.filter((item) => item.kind === 'point').length} pontos · {active.territory ? `${active.territory.ids.length} setores associados` : 'Origem territorial ainda não conferida'}</p><p>Revisão salva: {revision} · {dirty ? 'Há alterações pendentes' : 'Sem alterações pendentes'}</p>{issue && <p role="alert">{issue}</p>}<input ref={input} type="file" accept=".json,.geojson,application/geo+json" hidden onChange={(event) => void importFile(event)} /><div className="v2-file-actions"><Button appearance="secondary" disabled={busy || !ready} onClick={() => input.current?.click()}>Importar GeoJSON</Button><Button appearance="secondary" disabled={busy || active.id === 'workspace-empty' || active.executionId.startsWith('demo-')} onClick={exportLayer}>Exportar camada</Button><Button disabled={busy || !ready} onClick={() => void run(async () => { await onSave(); setMessage('Espaço de trabalho salvo.') })}>Salvar espaço de trabalho</Button><Button appearance="secondary" disabled={busy || !ready || active.id === 'workspace-empty'} onClick={() => void run(async () => { await onTerritory(); setMessage('Setores conferidos pela API e associados à camada.') })}>Conferir camada com os setores selecionados</Button></div><label className="editor-field-label">Nome do pacote<input maxLength={150} value={name} onChange={(event) => setName(event.target.value)} /></label><Button disabled={busy || !name.trim() || !snapshot.layers.length} onClick={() => void run(async () => { await api('/acervo', { method: 'POST', body: JSON.stringify({ name: name.trim(), snapshot }) }); setMessage('Pacote enviado ao acervo como não revisado.') })}>Enviar conjunto ao acervo</Button><p className="editor-help">O pacote inclui as camadas reais e importadas deste espaço de trabalho. Exemplos não são gravados. Aprovação e publicação são feitas no acervo.</p>{message && <p role="status">{message}</p>}</div>
}
