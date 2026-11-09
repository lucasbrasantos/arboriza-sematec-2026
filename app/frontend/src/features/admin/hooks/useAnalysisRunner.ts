import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../../auth/services/api'

export type AnalysisJob = { id: string; state: 'pendente' | 'processando' | 'concluida' | 'erro'; step: string; error: string | null; created_at?: string; request: { perfil: string } }
export type AnalysisStart = { ids: string[]; fonte_malha: string; perfil: string; score: number }
const KEY = 'arboriza.analysis.active'
const WARNING_KEY = 'arboriza.analysis.uncertain'

export function useAnalysisRunner(onCompleted: (job: AnalysisJob, foreground: boolean) => void) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [trackedId, setTrackedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [indicator, setIndicator] = useState(() => Boolean(sessionStorage.getItem(WARNING_KEY)))
  const [sending, setSending] = useState(false)
  const [issue, setIssue] = useState(() => sessionStorage.getItem(WARNING_KEY) ?? '')
  const [uncertain, setUncertain] = useState(() => Boolean(sessionStorage.getItem(WARNING_KEY)))
  const [recent, setRecent] = useState<AnalysisJob[]>([])
  const [checkedRecent, setCheckedRecent] = useState(false)
  const [retry, setRetry] = useState(0)
  const sendingRef = useRef(false)
  const notified = useRef(new Set<string>())
  const completedRef = useRef(onCompleted)
  const modalOpenRef = useRef(modalOpen)
  useEffect(() => { completedRef.current = onCompleted }, [onCompleted])
  useEffect(() => { modalOpenRef.current = modalOpen }, [modalOpen])

  useEffect(() => {
    let cancelled = false
    api<AnalysisJob[]>('/analises').then((list) => {
      const running = list.find((item) => item.state === 'pendente' || item.state === 'processando')
      if (!cancelled && sessionStorage.getItem(WARNING_KEY)) { setRecent(list.slice(0, 5)); setCheckedRecent(true) }
      if (!cancelled && running) { setJob(running); setTrackedId(running.id); setIndicator(true); setUncertain(false); setIssue(''); sessionStorage.removeItem(WARNING_KEY); sessionStorage.setItem(KEY, running.id) }
    }).catch(() => { /* O formulário apresenta as falhas de conexão. */ })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    function legacyStarted(event: Event) {
      const id = (event as CustomEvent<unknown>).detail
      if (typeof id === 'string' && id) { setTrackedId(id); setIndicator(true); setIssue(''); setUncertain(false); sessionStorage.removeItem(WARNING_KEY) }
    }
    window.addEventListener('arboriza:analysis-started', legacyStarted)
    return () => window.removeEventListener('arboriza:analysis-started', legacyStarted)
  }, [])

  useEffect(() => {
    if (!trackedId) return
    let cancelled = false
    let timer = 0
    async function poll() {
      try {
        const next = await api<AnalysisJob>(`/analises/${encodeURIComponent(trackedId as string)}`)
        if (cancelled) return
        setJob(next); setIssue(''); setUncertain(false)
        if (next.state === 'pendente' || next.state === 'processando') timer = window.setTimeout(poll, 2000)
        else {
          setTrackedId(null)
          if (next.state === 'concluida' && !notified.current.has(next.id)) { notified.current.add(next.id); completedRef.current(next, modalOpenRef.current) }
        }
      } catch (error) {
        if (cancelled) return
        setIssue(error instanceof Error ? error.message : 'Não foi possível acompanhar a análise.')
        timer = window.setTimeout(poll, 4000)
      }
    }
    void poll()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [trackedId, retry])

  useEffect(() => {
    if (job?.state !== 'concluida' || !indicator) return
    const timer = window.setTimeout(() => setIndicator(false), 10000)
    return () => window.clearTimeout(timer)
  }, [job?.id, job?.state, indicator])

  const start = useCallback(async (request: AnalysisStart) => {
    if (sendingRef.current || trackedId || uncertain) return
    sendingRef.current = true; setSending(true); setIssue(''); setRecent([]); setCheckedRecent(false); setJob(null); setIndicator(true); setModalOpen(true)
    try {
      const result = await api<{ analysis_id: string }>('/analises/setores', { method: 'POST', body: JSON.stringify(request) })
      sessionStorage.setItem(KEY, result.analysis_id); setTrackedId(result.analysis_id)
    } catch (error) {
      const ambiguous = !(error instanceof ApiError) || error.status === 0 || error.status >= 500
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar a análise.'
      const warning = ambiguous ? `${message} A solicitação pode ter sido recebida; verifique o servidor antes de tentar novamente.` : message
      setIssue(warning)
      setUncertain(ambiguous)
      if (ambiguous) sessionStorage.setItem(WARNING_KEY, warning)
      if (ambiguous || error instanceof ApiError && error.status === 409) {
        try {
          const list = await api<AnalysisJob[]>('/analises')
          setRecent(list.slice(0, 5)); setCheckedRecent(true)
          const running = list.find((item) => item.state === 'pendente' || item.state === 'processando')
          if (running) { sessionStorage.setItem(KEY, running.id); sessionStorage.removeItem(WARNING_KEY); setJob(running); setTrackedId(running.id); setIssue(''); setUncertain(false) }
        } catch { /* Mantém a mensagem para evitar envio duplicado. */ }
      }
    } finally { sendingRef.current = false; setSending(false) }
  }, [trackedId, uncertain])
  const checkAgain = useCallback(async () => {
    try {
      const list = await api<AnalysisJob[]>('/analises')
      setRecent(list.slice(0, 5)); setCheckedRecent(true)
      const running = list.find((item) => item.state === 'pendente' || item.state === 'processando')
      if (running) { sessionStorage.setItem(KEY, running.id); sessionStorage.removeItem(WARNING_KEY); setJob(running); setTrackedId(running.id); setIssue(''); setUncertain(false) }
      else if (uncertain) setIssue('Nenhuma análise em andamento foi encontrada. Confira os resultados recentes antes de iniciar novamente.')
      else setRetry((current) => current + 1)
    } catch (error) { setIssue(error instanceof Error ? error.message : 'Não foi possível consultar a análise.') }
  }, [uncertain])
  const dismiss = () => { setModalOpen(false); if (!trackedId && !sending && !uncertain) setIndicator(false) }
  return { job, sending, issue, uncertain, recent, checkedRecent, active: Boolean(trackedId || sending), indicator, modalOpen, start, checkAgain, dismiss,
    openModal: () => setModalOpen(true), closeModal: () => setModalOpen(false), clearUncertain: () => { sessionStorage.removeItem(WARNING_KEY); setUncertain(false); setIssue(''); setIndicator(false); setModalOpen(false) } }
}
