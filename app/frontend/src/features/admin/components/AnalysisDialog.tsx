import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, LoaderCircle, ScanLine, X } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import { api } from '../../auth/services/api'

type Job = { id: string; state: 'pendente' | 'processando' | 'concluida' | 'erro'; step: string; error: string | null; created_at: string; request: { perfil: string } }
type Props = { ids: string[]; mesh: string; profile: string; score: number; ready: boolean; area: number | null; onClose: () => void; onCompleted: (job: Pick<Job, 'id' | 'state' | 'request'>) => void }
const KEY = 'arboriza.analysis.active'
const WARNING_KEY = 'arboriza.analysis.uncertain'
const profileName = (value: string) => ({ 'controle': 'Controle · 200 m', 'controle-local': 'Controle · Acervo local', 'controle-datageo': 'Controle · DataGEO direto', 'fusao': 'Modelo v2 · Restor + Cambridge' } as Record<string, string>)[value] ?? value

export default function AnalysisDialog({ ids, mesh, profile, score, ready, area, onClose, onCompleted }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [submissionWarning, setSubmissionWarning] = useState(() => sessionStorage.getItem(WARNING_KEY) ?? '')
  const [attempt, setAttempt] = useState(0)
  const [recent, setRecent] = useState<Job[]>([])
  const notified = useRef(new Set<string>())
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useEffect(() => {
    let cancelled = false
    let timer = 0
    async function refresh() {
      try {
        const saved = sessionStorage.getItem(KEY)
        const list = await api<Job[]>('/analises')
        const current = list.find((item) => item.state === 'pendente' || item.state === 'processando') ?? list.find((item) => item.id === saved)
        if (cancelled) return
        setRecent(list.slice(0, 5)); setJob(current ?? null); setError(''); setLoading(false)
        if (current) sessionStorage.setItem(KEY, current.id)
        if (current?.state === 'pendente' || current?.state === 'processando') timer = window.setTimeout(refresh, 2000)
      } catch (reason) {
        if (!cancelled) { setError(reason instanceof Error ? reason.message : 'Não foi possível acompanhar a análise.'); setLoading(false) }
      }
    }
    void refresh()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [attempt])
  useEffect(() => {
    if (job?.state === 'concluida' && !notified.current.has(job.id)) {
      notified.current.add(job.id)
      onCompleted(job)
    }
  }, [job, onCompleted])
  async function start() {
    if (!ready || starting) return
    setStarting(true); setError('')
    try {
      const result = await api<{ analysis_id: string }>('/analises/setores', { method: 'POST', body: JSON.stringify({ ids, fonte_malha: mesh, perfil: profile, score }) })
      sessionStorage.setItem(KEY, result.analysis_id)
      window.dispatchEvent(new CustomEvent('arboriza:analysis-started', { detail: result.analysis_id }))
      setLoading(true); setAttempt((value) => value + 1)
    } catch (reason) {
      const warning = `${reason instanceof Error ? reason.message : 'Não foi possível iniciar.'} Confira as análises recentes antes de tentar novamente; a solicitação pode ter sido recebida.`
      sessionStorage.setItem(WARNING_KEY, warning); setSubmissionWarning(warning)
      setLoading(true); setAttempt((value) => value + 1)
    } finally { setStarting(false) }
  }
  const busy = job?.state === 'pendente' || job?.state === 'processando'
  const title = loading ? 'Consultando análises' : job?.state === 'concluida' ? 'Análise concluída' : job?.state === 'erro' ? 'Análise interrompida' : busy ? 'Análise em andamento' : 'Conferir análise'
  function forget() { sessionStorage.removeItem(KEY); setJob(null); setError('') }
  return createPortal(<dialog ref={dialog} className="analysis-demo-dialog ar-theme" aria-labelledby="analysis-dialog-title" onCancel={(event) => { event.preventDefault(); if (!starting) onClose() }}>
    <div className="analysis-dialog-head"><span className="analysis-demo-badge">Análise real</span><button type="button" className="editor-icon-button" onClick={onClose} disabled={starting} aria-label="Fechar acompanhamento"><X size={19} /></button></div>
    <div className={`analysis-dialog-symbol ${loading || starting || busy ? 'is-busy' : ''}`}>{loading || starting || busy ? <LoaderCircle size={34} /> : job?.state === 'erro' || error ? <AlertTriangle size={34} /> : job?.state === 'concluida' ? <Check size={34} /> : <ScanLine size={34} />}</div>
    <h2 id="analysis-dialog-title" tabIndex={-1} aria-live="polite">{title}</h2>
    {error && <p role="alert">{error}</p>}
    {submissionWarning && <p role="alert">{submissionWarning}</p>}
    {job ? <><dl className="analysis-dialog-summary"><div><dt>Execução</dt><dd>{job.id}</dd></div><div><dt>Perfil</dt><dd>{profileName(job.request.perfil)}</dd></div><div><dt>Etapa</dt><dd>{job.step}</dd></div></dl>{job.error && <p role="alert">{job.error}</p>}{busy && <p>Você pode fechar este acompanhamento. A análise continuará no servidor.</p>}{job.state === 'concluida' && <p>{job.request.perfil === 'fusao' ? 'Os pontos e a segmentação reais foram adicionados ao mapa. Use os controles Pontos e Visualizar segmentação.' : 'Os pontos reais foram adicionados ao mapa. Este perfil de controle não gera polígonos de segmentação.'}</p>}</> : <><p>{ready ? 'Confira a área antes de iniciar o processamento.' : 'Selecione os setores e configure a análise para iniciar.'}</p><dl className="analysis-dialog-summary"><div><dt>Área</dt><dd>{ids.length} {ids.length === 1 ? 'setor' : 'setores'}{area !== null ? ` · ${(area / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha` : ''}</dd></div><div><dt>Perfil</dt><dd>{profileName(profile)}</dd></div><div><dt>Score</dt><dd>{score}</dd></div></dl></>}
    {!job && recent.length > 0 && <details><summary>Análises recentes</summary><ul>{recent.map((item) => <li key={item.id}><button type="button" onClick={() => { sessionStorage.setItem(KEY, item.id); setLoading(true); setAttempt((value) => value + 1) }}>{item.id} · {item.state}</button></li>)}</ul></details>}
    <div className="analysis-dialog-actions">{error && <Button appearance="secondary" onClick={() => { setLoading(true); setAttempt((value) => value + 1) }}>Verificar novamente</Button>}{submissionWarning && !job && !error && !loading && <Button appearance="secondary" onClick={() => { sessionStorage.removeItem(WARNING_KEY); setSubmissionWarning('') }}>Conferi as análises recentes</Button>}{job && !busy && <Button appearance="secondary" onClick={() => { forget(); sessionStorage.removeItem(WARNING_KEY); setSubmissionWarning('') }}>Nova análise</Button>}<Button appearance="quiet" onClick={onClose} disabled={starting}>Fechar</Button>{!job && <Button onClick={() => void start()} disabled={!ready || loading || starting || Boolean(error) || Boolean(submissionWarning)}>{starting ? 'Enviando…' : 'Iniciar análise'}</Button>}</div>
  </dialog>, document.body)
}
