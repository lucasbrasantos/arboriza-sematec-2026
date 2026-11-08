import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScanLine, X } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import { api } from '../../auth/services/api'
import type { AnalysisStart } from '../hooks/useAnalysisRunner'
import type { AnalysisPreferences } from './AnalysisConfig'

type Props = { ids: string[]; mesh: string; preferences: AnalysisPreferences; blocked: boolean; onClose: () => void; onStart: (request: AnalysisStart) => void }
type Summary = { setores: number; area_m2: number }
const profileNames: Record<string, string> = { controle: 'Controle · 200 m', 'controle-local': 'Controle · acervo local', 'controle-datageo': 'Controle · DataGEO direto', fusao: 'Modelo v2 · Restor + Cambridge' }

export default function AnalysisConfirmV2({ ids, mesh, preferences, blocked, onClose, onStart }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const score = Number(preferences.score)
  const scoreValid = preferences.score.trim() !== '' && Number.isFinite(score) && score >= .05 && score <= 1
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  useEffect(() => {
    const controller = new AbortController()
    api<Summary>('/territorio/resumo', { method: 'POST', body: JSON.stringify({ ids }), signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { setSummary(value); setError('') } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível calcular a área.') })
    return () => controller.abort()
  }, [ids, attempt])
  return createPortal(<dialog ref={dialog} className="analysis-demo-dialog ar-theme" aria-labelledby="v2-confirm-analysis-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="analysis-dialog-head"><span className="analysis-demo-badge">Área definida</span><button type="button" className="editor-icon-button" onClick={onClose} aria-label="Fechar confirmação"><X size={19} /></button></div>
    <div className="analysis-dialog-symbol"><ScanLine size={28} /></div>
    <h2 id="v2-confirm-analysis-title">Confirmar análise</h2><p>Confira a área e o perfil antes de iniciar.</p>
    {error ? <p role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>Tentar novamente</button></p> : !summary && <p role="status">Calculando a área selecionada…</p>}
    <dl className="analysis-dialog-summary"><div><dt>Setores</dt><dd>{ids.length.toLocaleString('pt-BR')}</dd></div><div><dt>Área territorial</dt><dd>{summary ? `${(summary.area_m2 / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha` : 'Calculando…'}</dd></div><div><dt>Perfil</dt><dd>{profileNames[preferences.profile] ?? preferences.profile}</dd></div><div><dt>Corte de score</dt><dd>{preferences.score}</dd></div></dl>
    {!scoreValid && <p role="alert">Ajuste o corte de score entre 0,05 e 1 antes de iniciar.</p>}{blocked && <p role="status">Há uma análise em andamento ou uma solicitação aguardando verificação.</p>}
    <div className="analysis-dialog-actions"><Button appearance="quiet" onClick={onClose}>Voltar</Button><Button disabled={!summary || !mesh || !scoreValid || blocked} onClick={() => onStart({ ids, fonte_malha: mesh, perfil: preferences.profile, score })}>Iniciar análise</Button></div>
  </dialog>, document.body)
}
