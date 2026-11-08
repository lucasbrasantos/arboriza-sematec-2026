import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../auth/services/api'
import { useAuth } from '../../auth/context/AuthContext'
import type { WorkspaceSnapshot } from '../data/workspace-files'
import { downloadJson, workspaceGeoJSON } from '../data/workspace-files'
import '../styles/admin.css'
import '../styles/archive-live.css'

type Package = { id: string; name: string; state: 'nao_revisado' | 'aprovado' | 'publicado'; territory_key: string | null; created_at: string; snapshot?: WorkspaceSnapshot }
const labels = { nao_revisado: 'Não revisado', aprovado: 'Aprovado', publicado: 'Publicado' }
export default function ArchivePage() {
  const { user } = useAuth()
  const [packages, setPackages] = useState<Package[]>([])
  const [detail, setDetail] = useState<Package | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewed, setReviewed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { const controller = new AbortController(); api<Package[]>('/acervo', { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) { setPackages(value); setError('') } }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [attempt])
  async function open(id: string) { setBusy(true); setError(''); try { setDetail(await api<Package>(`/acervo/${id}`)); setReviewed(false) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o pacote.') } finally { setBusy(false) } }
  async function action(value: 'aprovar' | 'publicar' | 'despublicar') {
    if (!detail) return
    if (value === 'publicar' && !window.confirm('Publicar este pacote? O pacote publicado anteriormente para os mesmos setores sairá da publicação e permanecerá no acervo.')) return
    setBusy(true); setError('')
    try { await api(`/acervo/${detail.id}/${value}`, { method: 'POST' }); await open(detail.id); setAttempt((current) => current + 1) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível concluir.') } finally { setBusy(false) }
  }
  return <main className="admin-page archive-live"><Link to="/admin">Voltar à administração</Link><h1>Acervo de análises e importações</h1><p>Os pacotes enviados ficam não revisados até a conferência e aprovação. A publicação exige aprovação.</p>{error && <p role="alert">{error} <button onClick={() => { setLoading(true); setAttempt(attempt + 1) }}>Tentar novamente</button></p>}{loading && <p role="status">Carregando acervo…</p>}<label>Buscar pacote<input value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="archive-live-layout"><section aria-label="Pacotes do acervo">{packages.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((item) => <button type="button" disabled={busy} key={item.id} onClick={() => void open(item.id)}><strong>{item.name}</strong><span>{labels[item.state]}</span><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></button>)}{!loading && !packages.length && <p>Nenhum pacote enviado ao acervo.</p>}</section>{detail?.snapshot && <aside aria-label="Revisão do pacote"><h2>{detail.name}</h2><p>{labels[detail.state]}</p><p>{detail.territory_key ? 'Pontos contidos nos setores declarados, conforme conferência da API.' : 'Território pendente de conferência. A aprovação está bloqueada.'}</p><ul>{detail.snapshot.layers.map((layer) => <li key={layer.id}>{layer.name} · {layer.segmentation ? `${layer.segmentation.features.length} copas originais` : `${layer.items.length} pontos`} · {layer.territory?.ids.length ?? 0} setores · {detail.snapshot?.visible_ids.includes(layer.id) ? 'Visível ao público quando publicado' : 'Oculta ao público'}</li>)}</ul><Link to={`/admin/mapa?pacote=${detail.id}`}>Abrir pacote no mapa para revisar</Link><button type="button" onClick={() => { if (detail.snapshot) downloadJson(workspaceGeoJSON(detail.snapshot), 'arboriza-pacote.geojson') }}>Exportar pacote</button>{user?.role === 'admin' && <div className="archive-live-actions">{detail.state === 'nao_revisado' && <><label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />Conferi os pontos, as copas e a origem territorial deste pacote.</label><button disabled={busy || !reviewed || !detail.territory_key} onClick={() => void action('aprovar')}>Aprovar revisão</button></>}{detail.state === 'aprovado' && <button disabled={busy} onClick={() => void action('publicar')}>Publicar pacote</button>}{detail.state === 'publicado' && <button disabled={busy} onClick={() => void action('despublicar')}>Retirar da publicação</button>}</div>}<p>Para corrigir um pacote, abra-o no mapa, faça os ajustes e envie um novo pacote ao acervo.</p></aside>}</div></main>
}
