import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, LoaderCircle, X } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import type { AnalysisJob } from '../hooks/useAnalysisRunner'

type Props = { job: AnalysisJob | null; sending: boolean; issue: string; uncertain: boolean; recent: AnalysisJob[]; checkedRecent: boolean; indicator: boolean; modalOpen: boolean; onOpen: () => void; onClose: () => void; onCheck: () => void; onClearUncertain: () => void; onDismiss: () => void }

function ProgressDialog({ job, sending, issue, uncertain, recent, checkedRecent, onClose, onCheck, onClearUncertain }: Pick<Props, 'job' | 'sending' | 'issue' | 'uncertain' | 'recent' | 'checkedRecent' | 'onClose' | 'onCheck' | 'onClearUncertain'>) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  const busy = sending || job?.state === 'pendente' || job?.state === 'processando'
  const title = sending ? 'Iniciando análise' : job?.state === 'concluida' ? 'Análise concluída' : job?.state === 'erro' ? 'Análise interrompida' : issue && !job ? 'Não foi possível iniciar' : 'Análise em andamento'
  return createPortal(<dialog ref={dialog} className="analysis-demo-dialog ar-theme" aria-labelledby="v2-analysis-progress-title" onCancel={(event) => { event.preventDefault(); if (!sending) onClose() }}>
    <div className="analysis-dialog-head"><span className="analysis-demo-badge">Análise real</span><button type="button" className="editor-icon-button" onClick={onClose} disabled={sending} aria-label="Fechar acompanhamento"><X size={19} /></button></div>
    <div className={`analysis-dialog-symbol ${busy ? 'is-busy' : ''}`}>{busy ? <LoaderCircle size={34} /> : job?.state === 'concluida' ? <Check size={34} /> : <AlertTriangle size={34} />}</div>
    <h2 id="v2-analysis-progress-title" aria-live="polite">{title}</h2>
    {job && <dl className="analysis-dialog-summary"><div><dt>Execução</dt><dd>{job.id}</dd></div><div><dt>Etapa</dt><dd>{job.step}</dd></div></dl>}
    {issue && <p role="alert">{issue}</p>}{job?.error && <p role="alert">{job.error}</p>}
    {uncertain && recent.length > 0 && <details className="v2-recent-jobs" open><summary>Análises recentes</summary><ul>{recent.map((item) => <li key={item.id}>{item.id} · {item.state}</li>)}</ul></details>}
    {busy && <p>Você pode fechar esta janela e acompanhar o andamento pelo indicador no mapa.</p>}
    {job?.state === 'concluida' && <p>O servidor concluiu o processamento. As camadas estão sendo preparadas para o mapa.</p>}
    <div className="analysis-dialog-actions">{issue && <Button appearance="secondary" onClick={onCheck}>Verificar novamente</Button>}{uncertain && checkedRecent && <Button appearance="secondary" onClick={onClearUncertain}>Conferi os resultados</Button>}<Button onClick={onClose} disabled={sending}>Fechar</Button></div>
  </dialog>, document.body)
}

export default function AnalysisProgressV2(props: Props) {
  const busy = props.sending || props.job?.state === 'pendente' || props.job?.state === 'processando'
  const failed = Boolean(props.issue || props.job?.state === 'erro')
  return <>
    {props.indicator && !props.modalOpen && <div className={`v2-analysis-indicator ${failed ? 'has-error' : ''}`} role="status"><button type="button" onClick={props.onOpen}>{busy ? <LoaderCircle className="v2-spinner" size={18} /> : failed ? <AlertTriangle size={18} /> : <Check size={18} />}<span><strong>{failed ? 'Análise precisa de atenção' : busy ? 'Análise em andamento' : 'Análise concluída'}</strong><small>{props.issue || props.job?.step || 'Preparando solicitação…'}</small></span></button>{failed && !props.uncertain && <button type="button" className="v2-indicator-close" onClick={props.onDismiss} aria-label="Dispensar aviso"><X size={15} /></button>}</div>}
    {props.modalOpen && <ProgressDialog job={props.job} sending={props.sending} issue={props.issue} uncertain={props.uncertain} recent={props.recent} checkedRecent={props.checkedRecent} onClose={props.onClose} onCheck={props.onCheck} onClearUncertain={props.onClearUncertain} />}
  </>
}
