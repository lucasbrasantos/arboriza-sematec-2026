import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Crosshair, FolderOpen, MapPin, Route, ScanLine, X } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import AnalysisConfig from './AnalysisConfig'
import type { AnalysisPreferences } from './AnalysisConfig'
import type { ResultLayer } from '../data/result-layers'
import type { SectorCollection } from '../data/territory-data'
import type { AnalysisStart } from '../hooks/useAnalysisRunner'
import '../styles/admin-sidebar-v2.css'

type Section = 'analysis' | 'streets' | 'files'
type Props = {
	files: ReactNode; streets: ReactNode; streetMode: boolean
	open: boolean; onClose: () => void
	selected: ReadonlySet<string>; collection: SectorCollection | null; territoryError: string; onRetryTerritory: () => void
	selecting: boolean; onToggleTerritory: () => void; onFitTerritory: () => void
	preferences: AnalysisPreferences; onPreferences: (value: AnalysisPreferences) => void
	activeLayer: ResultLayer; onCompleted: (job: { id: string; state: string; request: { perfil: string } }) => void
	onStartAnalysis: (request: AnalysisStart) => void; analysisActive: boolean; analysisBlocked: boolean
}
const sections = [
	{ id: 'analysis', label: 'Área e análise', icon: ScanLine },
	{ id: 'streets', label: 'Ruas', icon: Route },
	{ id: 'files', label: 'Arquivos', icon: FolderOpen },
] as const

function MissingTerritoryDialog({ onClose, onSelect }: { onClose: () => void; onSelect: () => void }) {
	const dialog = useRef<HTMLDialogElement>(null)
	useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
	return createPortal(<dialog ref={dialog} className="analysis-demo-dialog ar-theme" aria-labelledby="v2-missing-area-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
		<div className="analysis-dialog-head"><span className="analysis-demo-badge">Área de análise</span><button type="button" className="editor-icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
		<div className="analysis-dialog-symbol"><MapPin size={32} /></div><h2 id="v2-missing-area-title">Escolha onde analisar</h2>
		<p>Selecione pelo menos um setor no mapa para preparar a análise.</p>
		<div className="analysis-dialog-actions"><Button appearance="quiet" onClick={onClose}>Agora não</Button><Button onClick={() => { onClose(); onSelect() }}>Selecionar setores <Crosshair size={16} /></Button></div>
	</dialog>, document.body)
}

export default function AdminSidebarV2({ open, onClose, selected, collection, territoryError, onRetryTerritory, selecting, onToggleTerritory, onFitTerritory, preferences, onPreferences, onCompleted, onStartAnalysis, analysisActive, analysisBlocked, streets, streetMode, files }: Props) {
	const [mode] = useState<'continuous' | 'tabs'>('tabs')
	const [tab, setTab] = useState<Section>('analysis')
	const [expanded, setExpanded] = useState<Record<Section, boolean>>({ analysis: true, streets: false, files: false })
	const [missingArea, setMissingArea] = useState(false)
	const km2 = collection?.features.reduce((total, feature) => selected.has(String(feature.id)) ? total + feature.properties.AREA_KM2 : total, 0) ?? 0
	const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
	const toggleSection = (id: Section) => setExpanded((current) => ({ ...current, [id]: !current[id] }))
	return <>
		<aside id="editor-context-panel-v2" className="editor-context-panel ar-glass admin-sidebar-v2" hidden={!open} aria-label="Ferramentas de análise" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
			<header>
				<div>
					<span className="v2-eyebrow">ESPAÇO DE TRABALHO</span>
					<strong>Ferramentas</strong>
				</div>
				<button className="editor-icon-button" type="button" onClick={onClose} aria-label="Recolher ferramentas"><X size={18} />
				</button>
			</header>

			{/* <div className="v2-sidebar-modes" role="group" aria-label="Organização das ferramentas">
				<button type="button" aria-pressed={mode === 'continuous'} onClick={() => setMode('continuous')}>Contínuo</button>
				<button type="button" aria-pressed={mode === 'tabs'} onClick={() => setMode('tabs')}>Abas</button>
			</div> */}

			{mode === 'tabs' && <div className="v2-sidebar-tabs" role="group" aria-label="Seções das ferramentas">{sections.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setExpanded((current) => ({ ...current, [id]: true })) }}><Icon size={16} /><span>{label}</span></button>)}</div>}
			<div className="editor-panel-body v2-sidebar-body">
				<section className="v2-section" hidden={streetMode || mode === 'tabs' && tab !== 'analysis'}>
					<button type="button" className="v2-section-heading" aria-expanded={expanded.analysis} onClick={() => toggleSection('analysis')}><span className="v2-section-icon"><ScanLine size={17} /></span><span><strong>Área e análise</strong><small>Selecione setores e execute o modelo</small></span><ChevronDown size={17} className={expanded.analysis ? 'is-open' : ''} /></button>
					<div className="v2-section-content" hidden={!expanded.analysis}>
						<div className="v2-territory-card"><div><span>ÁREA SELECIONADA</span><strong>{selected.size.toLocaleString('pt-BR')} <small>{selected.size === 1 ? 'setor' : 'setores'}</small></strong></div><div><span>ÁREA IBGE</span><strong>{number.format(km2 * 100)} <small>ha</small></strong></div></div>
						<button type="button" className="v2-select-territory" aria-pressed={selecting} onClick={onToggleTerritory}><Crosshair size={17} />Selecionar setores no mapa</button>
						{selected.size > 0 && <button type="button" className="v2-text-action" onClick={onFitTerritory}>Enquadrar área selecionada</button>}
						{territoryError && <p role="alert">{territoryError} <button type="button" onClick={onRetryTerritory}>Tentar novamente</button></p>}
						<div className="v2-analysis-heading"><h2>Perfil de análise</h2><p>Escolha como identificar possíveis copas.</p></div>
						<AnalysisConfig compact selected={selected} collection={collection} preferences={preferences} onPreferences={onPreferences} onCompleted={onCompleted} onMissingArea={() => setMissingArea(true)} onStart={onStartAnalysis} active={analysisActive} blocked={analysisBlocked} />
					</div>
				</section>
				<section className="v2-section" hidden={!streetMode && mode === 'tabs' && tab !== 'streets'}>
					<button type="button" className="v2-section-heading" aria-expanded={expanded.streets} onClick={() => toggleSection('streets')}><span className="v2-section-icon"><Route size={17} /></span><span><strong>Diagnóstico de ruas</strong><small>Relacionar pontos e vias</small></span><ChevronDown size={17} className={expanded.streets ? 'is-open' : ''} /></button>
					<div className="v2-section-content" hidden={!streetMode && !expanded.streets}>{streets}</div>
				</section>
				<section className="v2-section" hidden={streetMode || mode === 'tabs' && tab !== 'files'}>
					<button type="button" className="v2-section-heading" aria-expanded={expanded.files} onClick={() => toggleSection('files')}><span className="v2-section-icon"><FolderOpen size={17} /></span><span><strong>Arquivos e camada</strong><small>Dados, importação e exportação</small></span><ChevronDown size={17} className={expanded.files ? 'is-open' : ''} /></button>
					<div className="v2-section-content" hidden={!expanded.files}>{files}</div>
				</section>
			</div>
			<footer>Arboriza · mapa administrativo</footer>
		</aside>
		{missingArea && <MissingTerritoryDialog onClose={() => setMissingArea(false)} onSelect={() => { if (!selecting) onToggleTerritory() }} />}
	</>
}
