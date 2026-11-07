import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link, NavLink } from 'react-router'
import { motion, MotionConfig } from 'motion/react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, FlaskConical, Leaf, MapPin, MousePointer2, Search, SlidersHorizontal, Trees } from 'lucide-react'
import '@fontsource-variable/manrope'
import { paths } from '../../shared/config/paths'
import Button from '../../shared/ui/Button'
import GlassPanel from '../../shared/ui/GlassPanel'
import MaterialSlider from '../../shared/ui/MaterialSlider'
import Toggle from '../../shared/ui/Toggle'
import usePrefersReducedMotion from '../../shared/hooks/usePrefersReducedMotion'
import RuleSection from '../../shared/components/RuleSection'
import IllustrativeMap from '../../shared/components/IllustrativeMap'
import BotanicalGraphic from '../../shared/ui/BotanicalGraphic'
import { variants, variantOrder } from './variants'
import GraphicStudy from './GraphicStudy'
import type { StyleVariant } from './variants'
import logoImage from '../../assets/samples/logo-full.svg'
import '../../shared/styles/theme.css'
import './style-lab.css'

type StyleLabPageProps = { variant: StyleVariant }
type MaterialStyle = CSSProperties & { '--ar-glass-opacity': number; '--ar-glass-blur': string }
const colors = [
	{ name: 'Floresta', hex: '#143F2B' }, { name: 'Folha', hex: '#246B45' },
	{ name: 'Broto', hex: '#B9D594' }, { name: 'Névoa', hex: '#E6EEE1' }, { name: 'Papel', hex: '#F7F9F3' },
] as const

export default function StyleLabPage({ variant }: StyleLabPageProps) {
	const config = variants[variant]
	const reduced = usePrefersReducedMotion()
	const [opacity, setOpacity] = useState(config.opacity)
	const [blur, setBlur] = useState(config.blur)
	const [motionEnabled, setMotionEnabled] = useState(true)
	const [query, setQuery] = useState('')
	const [searchMessage, setSearchMessage] = useState('')
	const [confirmed, setConfirmed] = useState(false)
	const [copiedColor, setCopiedColor] = useState('')
	const motionAllowed = motionEnabled && !reduced
	const material: MaterialStyle = { '--ar-glass-opacity': opacity / 100, '--ar-glass-blur': `${blur}px` }

	useEffect(() => { document.title = `${config.label} | Laboratório Arboriza` }, [config.label])

	function search(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setSearchMessage(query.trim() ? `Busca de teste: “${query.trim()}”. Nenhuma consulta à API foi feita.` : 'Digite o nome de uma área para testar o campo.')
	}

	async function copyColor(hex: string) {
		try {
			await navigator.clipboard.writeText(hex)
			setCopiedColor(`${hex} copiado`)
		} catch { setCopiedColor(`Cor selecionada: ${hex}`) }
	}

	return <div className="ar-theme style-lab" data-variant={variant} data-motion={motionAllowed ? 'on' : 'off'} style={material}>
		<MotionConfig reducedMotion={motionAllowed ? 'never' : 'always'}>
			<a className="skip-link lab-skip" href="#conteudo">Pular para o conteúdo</a>
			<div className="lab-toolbar">
				<Link className="lab-back" to={paths.home}><ArrowLeft size={16} /> Voltar ao app</Link>
				<nav className="lab-variants" aria-label="Amostras visuais">
					{variantOrder.map((id) => <NavLink key={id} to={`${paths.lab}/${id}`} aria-label={`Amostra ${variants[id].label}`}>
						{id === variant && <motion.span className="lab-active-variant" layoutId="variant" transition={{ duration: .25 }} />}
						<span>{variants[id].label}</span>{id === 'equilibrio' && <Leaf size={13} aria-hidden="true" />}
					</NavLink>)}
				</nav>
				<span className="lab-badge"><FlaskConical size={14} /> Laboratório visual</span>
			</div>

			<main id="conteudo" tabIndex={-1}>
				<section className="lab-preview" aria-label={`Amostra ${config.label}`}>
					<div className="lab-hero-photo" aria-hidden="true" />
					<BotanicalGraphic className="lab-support-graphic" motionEnabled={motionAllowed} />
					<header className="lab-preview-header lab-shell">
						<a href="#conteudo" className="lab-wordmark"><img src={logoImage} alt="Arboriza" /></a>
						<nav aria-label="Navegação da demonstração"><a href="#grafismos">Grafismos e cores</a><a href="#materiais">A experiência</a><a href="#regra">3-30-300</a></nav>
						<a href="#demonstracao" className="lab-header-action">Conheça o mapa <ArrowUpRight size={16} /></a>
					</header>
					<div className="lab-hero lab-shell">
						<motion.div className="lab-hero-copy" initial={{ y: motionAllowed ? 12 : 0 }} animate={{ y: 0 }} transition={{ duration: .7, ease: [.16, 1, .3, 1] }}>
							<h1>O verde faz parte da nossa cidade.</h1>
							<p>Um olhar sobre as árvores de Araçatuba. Explore, descubra e imagine caminhos mais verdes para quem vive aqui.</p>
							<div className="lab-hero-actions"><a className="ar-button ar-button--primary" href="#demonstracao">Explorar demonstração <ArrowUpRight size={18} /></a><a className="lab-hero-link" href="#regra">Por que arborizar? <ArrowRight size={17} /></a></div>
							<span className="lab-location"><MapPin size={15} /> Pensado para Araçatuba, SP</span>
						</motion.div>
						<div className="lab-hero-scene">
							<GlassPanel className="lab-hero-note" motionEnabled={motionAllowed}>
								<div className="lab-leaf-icon"><Leaf size={23} /></div><h2>Natureza por perto.</h2><p>Mais sombra no caminho.<br />Mais vida entre as ruas.</p><div className="lab-note-foot"><span>Uma cidade para todos</span><ArrowUpRight size={17} /></div>
							</GlassPanel>
							<div className="lab-hero-caption"><span className="lab-small-dot" /> Um ensaio sobre natureza e cidade</div>
						</div>
					</div>
				</section>

				<div className="lab-direction lab-shell"><div><Leaf size={19} /><strong>{config.label}</strong><span>{config.description}</span></div><span className="lab-sample-label">Amostra de design</span></div>

				<GraphicStudy motionEnabled={motionAllowed} />

				<section id="materiais" className="lab-materials lab-shell">
					<div className="lab-section-heading"><div><h2>Uma identidade que respira.</h2><p>Verdes vegetais, tipografia acolhedora e espaço para o conteúdo.</p></div><p className="lab-section-aside">Manrope<br /><span>Uma família, várias expressões.</span></p></div>
					<div className="lab-palette">{colors.map((color) => <button key={color.hex} className="lab-swatch" type="button" onClick={() => { void copyColor(color.hex) }} aria-label={`Copiar cor ${color.name}: ${color.hex}`}><span className="lab-swatch-color" style={{ backgroundColor: color.hex }} /><span><strong>{color.name}</strong><small>{color.hex}</small></span></button>)}</div>
					<p className="lab-color-status" role="status">{copiedColor || 'Clique em uma cor para copiar o código.'}</p>
				</section>

				<section className="lab-glass-section" aria-labelledby="glass-title">
					<div className="lab-shell lab-glass-grid">
						<div className="lab-glass-scene">
							<span className="lab-scene-label"><MousePointer2 size={15} /> Mova o cursor sobre o cartão</span>
							<GlassPanel className="lab-material-card" motionEnabled={motionAllowed}>
								<div className="lab-card-top"><span className="lab-card-icon"><Trees size={24} /></span><span className="lab-card-chip">Ensaio visual</span></div>
								<h3>Ver a cidade.<br />Sentir a natureza.</h3><p>Texturas do mundo real, superfícies translúcidas e pequenos detalhes que respondem a você.</p>
								<div className="lab-material-divider" /><div className="lab-card-bottom"><span><Leaf size={16} /> Naturalmente conectado</span><ArrowUpRight size={19} /></div>
							</GlassPanel>
							<span className="lab-photo-credit">Fotografia de referência · Unsplash</span>
						</div>
						<div className="lab-material-controls">
							<span className="lab-control-symbol"><SlidersHorizontal size={24} /></span>
							<h2 id="glass-title">O vidro,<br />do seu jeito.</h2><p>Ajuste o material e veja como luz, transparência e profundidade mudam a experiência.</p>
							<MaterialSlider label="Opacidade do vidro" value={opacity} min={45} max={95} unit="%" onChange={setOpacity} />
							<MaterialSlider label="Desfoque do fundo" value={blur} min={0} max={40} unit=" px" onChange={setBlur} />
							<Toggle label="Reflexo e movimento" checked={motionAllowed} onChange={setMotionEnabled} disabled={reduced} />
							{reduced && <p className="lab-helper">Sua preferência por movimento reduzido está sendo respeitada.</p>}
							<Button appearance="quiet" onClick={() => { setOpacity(config.opacity); setBlur(config.blur); setMotionEnabled(true) }}>Restaurar esta amostra <ArrowRight /></Button>
							<p className="lab-helper">Vidro fosco com brilho reativo. Não simula refração física do fundo.</p>
						</div>
					</div>
				</section>

				<section id="demonstracao" className="lab-demo-section lab-shell">
					<div className="lab-section-heading"><div><h2>Bonito de ver.<br />Simples de explorar.</h2><p>Um pequeno ensaio dos componentes que podem dar vida ao Arboriza.</p></div><span className="lab-demo-pill"><FlaskConical size={15} /> Pontos fictícios</span></div>
					<div className="lab-demo-grid">
						<IllustrativeMap />
						<div className="lab-component-demo">
							<h3>Detalhes que fazem diferença.</h3><p>Campos, botões e respostas claros, com uma linguagem visual compartilhada.</p>
							<form onSubmit={search}><label htmlFor="lab-search">Teste o campo de busca</label><div className="lab-search-field"><Search size={18} /><input id="lab-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome de uma área" maxLength={80} /><button type="submit" aria-label="Testar busca"><ArrowRight size={19} /></button></div><p className="lab-field-feedback" role="status">{searchMessage || 'Demonstração de campo. Sem consulta a dados.'}</p></form>
							<div className="lab-button-examples"><Button onClick={() => setConfirmed(!confirmed)}>{confirmed ? <Check /> : <Leaf />}{confirmed ? 'Interação confirmada' : 'Testar interação'}</Button><Button appearance="secondary" disabled>Indisponível</Button></div>
							<p className="lab-action-status" role="status">{confirmed ? 'O botão respondeu à sua ação. Nenhum dado foi salvo.' : 'Experimente o estado ativo e o desabilitado.'}</p>
							<div className="lab-inline-note"><CheckCircle2 size={19} /><span>Teclado, foco visível e movimento reduzido fazem parte da experiência.</span></div>
						</div>
					</div>
				</section>

				<RuleSection motionEnabled={motionAllowed} />
			</main>
			<footer className="lab-footer lab-shell"><div><strong>Arboriza</strong><p>Um futuro mais verde começa com um olhar.</p></div><div><p>Laboratório visual · Proposta em avaliação</p><Link to={paths.home}>Voltar para a estrutura do app <ArrowUpRight size={14} /></Link></div><details><summary>Fontes visuais</summary><p><a href="https://images.unsplash.com/photo-1441974231531-c6227db76b6e">Fotografia de floresta, via Unsplash</a> — referência estética, não representa Araçatuba. Ortofoto: IGC / DataGEO, reaproveitada do protótipo. Pontos fictícios. Marca: arquivo existente do projeto.</p></details></footer>
		</MotionConfig>
	</div>
}
