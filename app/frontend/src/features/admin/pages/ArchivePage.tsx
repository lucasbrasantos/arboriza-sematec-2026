import Button from '../../../shared/ui/controls/Button'
import ArchivePreview from '../components/ArchivePreview'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, ArrowUpRight, ChevronRight, MapPin, Search } from 'lucide-react'
import GlassPanel from '../../../shared/ui/surfaces/GlassPanel'
import { api } from '../../auth/services/api'
import { useAuth } from '../../auth/context/AuthContext'
import type { WorkspaceSnapshot } from '../data/workspace-files'
import { downloadJson, workspaceGeoJSON } from '../data/workspace-files'
import '../styles/admin.css'

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
  const shown = packages.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="admin-page" aria-labelledby="archive-title">
    <Link className="admin-back" to="/admin"><ArrowLeft size={16} /> Administração</Link>
    <header className="admin-page-heading"><div>{detail && <button type="button" className="admin-back" onClick={() => setDetail(null)}><ArrowLeft size={16} /> Todos os registros</button>}<h1 id="archive-title">{detail?.name ?? 'Análises e importações'}</h1><p>{detail ? 'Acompanhe o caminho dos resultados, da revisão à publicação.' : 'Consulte os resultados salvos e prepare o material para publicação.'}</p></div><Link className="admin-map-link" to="/mapa">Abrir mapa público <ArrowUpRight size={18} /></Link></header>
    {error && <p role="alert">{error} <button onClick={() => { setLoading(true); setAttempt(attempt + 1) }}>Tentar novamente</button></p>}
    {loading && <p role="status">Carregando acervo…</p>}
    {detail?.snapshot ? <div className="admin-workspace"><div className="admin-workflow"><div className="admin-section-heading"><h2>Etapas desta área</h2><span>{labels[detail.state]}</span></div><p className="admin-section-intro">{detail.territory_key ? 'Pontos contidos nos setores declarados, conforme conferência da API.' : 'Território pendente de conferência. A aprovação está bloqueada.'}</p><ol className="admin-steps"><li><span className="admin-step-number">1</span><div><h3>Conferir resultados</h3><ul>{detail.snapshot.layers.map((layer) => <li key={layer.id}>{layer.name} · {layer.segmentation ? `${layer.segmentation.features.length} copas originais` : `${layer.items.length} pontos`} · {layer.territory?.ids.length ?? 0} setores · {detail.snapshot?.visible_ids.includes(layer.id) ? 'Visível ao público quando publicado' : 'Oculta ao público'}</li>)}</ul><Link className="ar-button ar-button--secondary archive-action" to={`/admin/acervo/${detail.id}/revisar`}>Abrir pacote no mapa para revisar</Link></div></li><li><span className="admin-step-number">2</span><div><h3>Revisar e aprovar</h3>{user?.role === 'admin' && detail.state === 'nao_revisado' ? <><label><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> Conferi os pontos, as copas e a origem territorial deste pacote.</label><Button disabled={busy || !reviewed || !detail.territory_key} onClick={() => void action('aprovar')}>Aprovar revisão</Button></> : <p>{labels[detail.state]}</p>}</div></li><li><span className="admin-step-number">3</span><div><h3>Publicação</h3>{user?.role === 'admin' && detail.state === 'aprovado' && <Button disabled={busy} onClick={() => void action('publicar')}>Publicar pacote</Button>}{user?.role === 'admin' && detail.state === 'publicado' && <Button appearance="secondary" disabled={busy} onClick={() => void action('despublicar')}>Retirar da publicação</Button>}<p>Somente as camadas marcadas como visíveis no envio estarão no mapa público.</p></div></li></ol></div><aside className="admin-area-summary"><GlassPanel interactive={false} className="admin-summary-panel"><h2>Resumo do pacote</h2><ArchivePreview key={detail.id} snapshot={detail.snapshot} /><p>{detail.name}</p><p>{labels[detail.state]}</p><Button appearance="secondary" onClick={() => { if (detail.snapshot) downloadJson(workspaceGeoJSON(detail.snapshot), 'arboriza-pacote.geojson') }}>Exportar pacote</Button></GlassPanel></aside></div> : <GlassPanel interactive={false} className="admin-area-library"><div className="admin-library-heading"><h2>Resultados salvos</h2><span>{packages.length} registros</span></div><div className="admin-list-controls"><div className="admin-search"><Search size={19} /><input aria-label="Buscar registros" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" /></div></div><p className="admin-results-status" role="status">{shown.length} registros encontrados</p>{shown.length ? <ul className="admin-area-list">{shown.map((item) => <li key={item.id}><button type="button" className="admin-area-row" disabled={busy} onClick={() => void open(item.id)}><span className="admin-area-thumbnail"><MapPin size={25} /></span><span className="admin-area-name"><strong>{item.name}</strong><small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></span><span className="admin-area-status admin-area-status--review">{labels[item.state]}</span><span className="admin-area-open">Abrir registro <ChevronRight size={19} /></span></button></li>)}</ul> : !loading && <p>Nenhum pacote encontrado.</p>}</GlassPanel>}
  </section>
}
