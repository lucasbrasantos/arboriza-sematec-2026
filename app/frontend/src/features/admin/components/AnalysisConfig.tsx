import { useEffect, useId, useMemo, useState } from 'react'
import { Info, ScanLine } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import { api } from '../../auth/services/api'
import type { SectorCollection } from '../data/territory-data'
import AnalysisDialog from './AnalysisDialog'
import type { AnalysisStart } from '../hooks/useAnalysisRunner'

type Catalog = { modelos: { id: string; nome: string; perfis: string[] }[]; perfis: { id: string; nome: string; descricao: string }[]; score_padrao: number; score_minimo: number }
type Summary = { setores: number; area_m2: number }
export type AnalysisPreferences = { model: string; profile: string; score: string }

export default function AnalysisConfig({ selected, collection, onCompleted, preferences, onPreferences, compact = false, onMissingArea, onStart, active = false, blocked = false }: { selected: ReadonlySet<string>; collection: SectorCollection | null; onCompleted: (job: { id: string; state: string; request: { perfil: string } }) => void; preferences: AnalysisPreferences; onPreferences: (value: AnalysisPreferences) => void; compact?: boolean; onMissingArea?: () => void; onStart?: (request: AnalysisStart) => void; active?: boolean; blocked?: boolean }) {
  const uid = useId()
  const ids = useMemo(() => [...selected].sort(), [selected])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const { model, profile, score } = preferences
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryKey, setSummaryKey] = useState('')
  const [error, setError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const key = ids.join(',')
  useEffect(() => {
    const controller = new AbortController()
    api<Catalog>('/analises/perfis', { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) { setCatalog(value); setError('') } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os modelos.') })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (!ids.length || !collection) return
    const controller = new AbortController()
    api<Summary>('/territorio/resumo', { method: 'POST', body: JSON.stringify({ ids }), signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) { setSummary(value); setSummaryKey(key); setSummaryError('') } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) { setSummaryKey(key); setSummary(null); setSummaryError(reason instanceof Error ? reason.message : 'Não foi possível calcular o resumo.') } })
    return () => controller.abort()
  }, [ids, key, collection, attempt])
  const selectedModel = catalog?.modelos.find((item) => item.id === model)
  const availableProfiles = catalog?.perfis.filter((item) => selectedModel?.perfis.includes(item.id)) ?? []
  const validScore = Number.isFinite(Number(score)) && Number(score) >= (catalog?.score_minimo ?? .05) && Number(score) <= 1 && score.trim() !== ''
  const ready = Boolean(catalog && collection && ids.length && summary && summaryKey === key && validScore && availableProfiles.some((item) => item.id === profile))
  return <>
    {!compact && <><h2>Configurar análise</h2><p>Selecione setores inteiros e escolha como analisar as imagens.</p></>}
    {error && <div className="editor-note" role="alert"><Info size={17} /><p>{error} <button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></p></div>}
    {!catalog && !error && <p role="status">Carregando modelos…</p>}
    {catalog && <><label className="editor-field-label" htmlFor={`${uid}-model`}>Modelo</label><select id={`${uid}-model`} value={model} onChange={(event) => { const value = event.currentTarget.value; onPreferences({ ...preferences, model: value, profile: value === 'fusao' ? 'fusao' : 'controle' }) }}>{catalog.modelos.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>
      {availableProfiles.length > 1 && <><label className="editor-field-label" htmlFor={`${uid}-profile`}>Fonte e perfil</label><select id={`${uid}-profile`} value={profile} onChange={(event) => onPreferences({ ...preferences, profile: event.currentTarget.value })}>{availableProfiles.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></>}
      {compact ? <details className="v2-profile-info"><summary>Sobre este perfil</summary><p className="editor-help">{availableProfiles.find((item) => item.id === profile)?.descricao}</p></details> : <p className="editor-help">{availableProfiles.find((item) => item.id === profile)?.descricao}</p>}
      <label className="editor-field-label" htmlFor={`${uid}-score`}>Corte de score</label><input id={`${uid}-score`} type="number" min={catalog.score_minimo} max="1" step="0.01" value={score} onChange={(event) => onPreferences({ ...preferences, score: event.currentTarget.value })} aria-invalid={!validScore} /><p className="editor-help">Entre {catalog.score_minimo} e 1. Score não equivale à probabilidade de acerto.</p></>}
    {!ids.length ? <p className="editor-note">Selecione ao menos um setor no contexto Área.</p> : summaryKey !== key ? <p role="status">Calculando área selecionada…</p> : summaryError ? <div role="alert"><p>{summaryError}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div> : summary && <div className="editor-note"><Info size={17} /><p>{summary.setores} {summary.setores === 1 ? 'setor selecionado' : 'setores selecionados'} · {(summary.area_m2 / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha de área territorial calculada pela API.</p></div>}
    <Button disabled={compact ? active || blocked || Boolean(ids.length && !ready) : !ready} onClick={() => { if (!compact) setOpen(true); else if (!ids.length) onMissingArea?.(); else if (collection && ready) onStart?.({ ids, fonte_malha: collection.arboriza.sha256_fonte, perfil: profile, score: Number(score) }) }}>{compact ? blocked ? 'Confira o aviso no mapa' : active ? 'Análise em andamento' : 'Iniciar análise' : 'Conferir análise'} <ScanLine size={17} /></Button>
    {!compact && <Button appearance="secondary" onClick={() => setOpen(true)}>Acompanhar análises</Button>}
    {!compact && open && <AnalysisDialog ids={ids} mesh={collection?.arboriza.sha256_fonte ?? ''} profile={profile} score={Number(score)} ready={ready} area={summaryKey === key ? summary?.area_m2 ?? null : null} onClose={() => setOpen(false)} onCompleted={onCompleted} />}
  </>
}
