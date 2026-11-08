import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, LoaderCircle, ScanLine, X } from 'lucide-react'
import Button from '../../shared/ui/Button'

type Stage = 'confirm' | 'preparing' | 'analyzing' | 'organizing' | 'done' | 'error'
type Props = { areaLabel: string; points: number; segments: number; failure: boolean; onClose: () => void; onReview: () => void }
const stageLabels: Record<Stage, string> = {
  confirm: 'Conferir demonstração', preparing: 'Preparando a área', analyzing: 'Analisando as imagens',
  organizing: 'Organizando os resultados', done: 'Demonstração concluída', error: 'Falha simulada na análise',
}

export default function AnalysisDemoDialog({ areaLabel, points, segments, failure, onClose, onReview }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const [stage, setStage] = useState<Stage>('confirm')
  const [elapsed, setElapsed] = useState(0)
  const [retrySuccess, setRetrySuccess] = useState(false)
  const started = useRef(0)
  const busy = stage === 'preparing' || stage === 'analyzing' || stage === 'organizing'
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  useEffect(() => { title.current?.focus() }, [stage])
  useEffect(() => {
    if (!busy) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busy])
  useEffect(() => {
    if (stage !== 'preparing' && stage !== 'analyzing' && stage !== 'organizing') return
    const delay = stage === 'analyzing' ? 6000 : 2000
    const timer = window.setTimeout(() => setStage(stage === 'preparing' ? 'analyzing' : stage === 'organizing' ? 'done' : failure && !retrySuccess ? 'error' : 'organizing'), delay)
    return () => window.clearTimeout(timer)
  }, [stage, failure, retrySuccess])
  function start() { started.current = Date.now(); setElapsed(0); setStage('preparing') }

  return <dialog ref={dialog} className="analysis-demo-dialog ar-theme" aria-labelledby="analysis-dialog-title" aria-describedby="analysis-dialog-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="analysis-dialog-head"><span className="analysis-demo-badge">Demonstração · sem IA conectada</span>{!busy && <button type="button" className="editor-icon-button" onClick={onClose} aria-label="Fechar acompanhamento"><X size={19} /></button>}</div>
    <div className={`analysis-dialog-symbol ${busy ? 'is-busy' : ''}`}>{busy ? <LoaderCircle size={34} /> : stage === 'error' ? <AlertTriangle size={34} /> : stage === 'done' ? <Check size={34} /> : <ScanLine size={34} />}</div>
    <h2 ref={title} tabIndex={-1} id="analysis-dialog-title" aria-live="polite">{stageLabels[stage]}</h2>
    <p id="analysis-dialog-description">{stage === 'confirm' ? 'Confira a área e experimente o acompanhamento. Nenhuma imagem será enviada para processamento.' : busy ? 'Etapas simuladas para avaliar a interface. O espaço de trabalho está bloqueado durante esta demonstração.' : stage === 'error' ? 'Este erro foi provocado pelo cenário escolhido. O mapa e os exemplos anteriores foram preservados.' : 'Você pode seguir para a revisão dos exemplos já disponíveis. Nenhuma nova detecção foi produzida.'}</p>
    <dl className="analysis-dialog-summary"><div><dt>Área</dt><dd>{areaLabel}</dd></div><div><dt>Perfil</dt><dd>Demonstração de detecção</dd></div>{stage !== 'confirm' && <div><dt>Tempo decorrido</dt><dd>{elapsed}s</dd></div>}</dl>
    {busy && <ol className="analysis-progress-steps" aria-label="Etapas da demonstração">{(['preparing', 'analyzing', 'organizing'] as const).map((step, index) => <li key={step} aria-current={step === stage ? 'step' : undefined}><span>{index + 1}</span>{stageLabels[step]}</li>)}</ol>}
    {stage === 'done' && <p className="analysis-demo-result">Exemplos para revisão: {points} pontos e {segments} {segments === 1 ? 'trecho' : 'trechos'} fictícios.</p>}
    <div className="analysis-dialog-actions">{stage === 'confirm' ? <><Button appearance="quiet" onClick={onClose}>Voltar às configurações</Button><Button onClick={start}>Iniciar demonstração</Button></> : busy ? <Button appearance="quiet" onClick={onClose}>Interromper demonstração</Button> : stage === 'error' ? <><Button appearance="secondary" onClick={onClose}>Voltar ao mapa</Button><Button onClick={() => { setRetrySuccess(true); start() }}>Repetir demo com sucesso</Button></> : <Button onClick={onReview}>Revisar exemplos</Button>}</div>
  </dialog>
}
