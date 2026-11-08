import { useEffect, useState } from 'react'
import type { PointerEvent } from 'react'
import { Link } from 'react-router'
import { motion, useSpring } from 'motion/react'
import { ArrowRight, ArrowUpRight, Eye, Leaf, MapPin, RotateCcw, ScanLine, Trees } from 'lucide-react'
import GlassPanel from '../../shared/ui/GlassPanel'
import Reveal from '../../shared/ui/Reveal'
import LivingGraphic from '../../shared/ui/LivingGraphic'
import BotanicalCutout from '../../shared/ui/BotanicalCutout'
import RuleSection from '../../shared/components/RuleSection'
import IllustrativeMap from '../../shared/components/IllustrativeMap'
import usePrefersReducedMotion from '../../shared/hooks/usePrefersReducedMotion'
import { paths } from '../../shared/config/paths'
import './home.css'

const steps = [
	{ Icon: Eye, title: 'Observar o território', text: 'Imagens aéreas ajudam a conhecer os espaços e a vegetação da cidade.' },
	{ Icon: ScanLine, title: 'Identificar possibilidades', text: 'A análise das imagens sugere onde podem existir árvores.' },
	{ Icon: Trees, title: 'Revisar com atenção', text: 'As marcações precisam de revisão para apoiar o estudo da arborização.' },
] as const

export default function HomePage() {
	const reduced = usePrefersReducedMotion()
	const [replay, setReplay] = useState(0)
	const photoX = useSpring(0, { stiffness: 70, damping: 25 })
	const photoY = useSpring(0, { stiffness: 70, damping: 25 })
	useEffect(() => { document.title = 'Arboriza — Um olhar para as árvores da cidade' }, [])

	function movePhoto(event: PointerEvent<HTMLElement>) {
		if (reduced || event.pointerType !== 'mouse') return
		const rect = event.currentTarget.getBoundingClientRect()
		photoX.set(((event.clientX - rect.left) / rect.width - .5) * 12)
		photoY.set(((event.clientY - rect.top) / rect.height - .5) * 8)
	}

	return <div className="home-page">
		<section className="home-hero" onPointerMove={movePhoto} onPointerLeave={() => { photoX.set(0); photoY.set(0) }}>
			<motion.div className="home-forest" aria-hidden="true" style={{ x: reduced ? 0 : photoX, y: reduced ? 0 : photoY }} />
			<div className="home-shell home-hero-grid">
				<div className="home-hero-copy"><h1>O verde faz parte da nossa cidade.</h1><p>Um olhar sobre as árvores de Araçatuba. Explore, descubra e imagine caminhos mais verdes para quem vive aqui.</p><div className="home-actions"><a href="#previa" className="ar-button ar-button--primary">Explorar a prévia <ArrowUpRight size={18} /></a><a href="#sobre" className="home-text-link">Conheça o Arboriza <ArrowRight size={17} /></a></div><span className="home-location"><MapPin size={16} /> Pensado para Araçatuba, SP</span></div>
				<div className="home-hero-scene">
					<LivingGraphic kind="canopy" className="home-hero-canopy" replay={replay} />
					<BotanicalCutout className="home-hero-cutout" replay={replay} eager />
					<LivingGraphic kind="branch" className="home-hero-sprig" replay={replay} />
					<GlassPanel className="home-hero-note"><span className="home-leaf-badge"><Leaf size={25} /></span><h2>Natureza por perto.</h2><p>Mais sombra no caminho.<br />Mais vida entre as ruas.</p><div><span>Uma cidade para todos</span><ArrowUpRight size={19} /></div></GlassPanel>
					<div className="home-art-controls"><button type="button" onClick={() => setReplay((value) => value + 1)} disabled={reduced}><RotateCcw size={14} /> Animar folhas</button>{reduced && <span>Movimento reduzido ativo</span>}</div>
					<span className="home-photo-label">Natureza como inspiração</span>
				</div>
			</div>
		</section>

		<section id="sobre" className="home-about home-shell">
			<Reveal className="home-about-intro"><h2>Enxergar as árvores.<br />Pensar a cidade.</h2><LivingGraphic kind="canopy" className="home-canopy-graphic" /></Reveal>
			<Reveal delay={.08}><p>As árvores fazem parte dos nossos caminhos. Conhecer sua distribuição é um passo para entender onde a natureza está presente no cotidiano.</p><p>O Arboriza é um projeto de apoio ao estudo da arborização urbana, com foco inicial em Araçatuba. Mapas, imagens aéreas e revisão humana fazem parte dessa proposta.</p><span className="home-project-note"><Leaf size={15} /> Projeto em desenvolvimento</span></Reveal>
		</section>

		<section className="home-process home-shell" aria-labelledby="process-title">
			<div className="home-section-heading"><h2 id="process-title">Das imagens<br />a um novo olhar.</h2><div className="home-process-intro"><p>Tecnologia e atenção ao território, em um processo que começa com a observação.</p><LivingGraphic kind="leaf" className="home-process-graphic" /></div></div>
			<div className="home-steps">{steps.map(({ Icon, title, text }, index) => <Reveal key={title} delay={index * .07}><article><div className="home-step-top"><Icon size={26} /><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article></Reveal>)}</div>
		</section>

		<section className="home-photo-essay home-shell" aria-labelledby="essay-title">
			<div className="home-essay-photo" aria-hidden="true" />
			<LivingGraphic kind="canopy" className="home-essay-canopy" />
			<BotanicalCutout className="home-essay-cutout" />
			<Reveal className="home-essay-card"><GlassPanel className="home-deep-glass"><Leaf size={26} /><h2 id="essay-title">Cidade e natureza podem caminhar juntas.</h2><p>Um convite para olhar com mais cuidado para as árvores e os espaços que compartilhamos.</p><a href="#regra">Conheça a regra 3-30-300 <ArrowRight size={16} /></a></GlassPanel></Reveal>
			<span className="home-essay-credit">Fotografia de referência · Unsplash</span>
		</section>

		<section id="previa" className="home-map-section home-shell" aria-labelledby="preview-title">
			<Reveal className="home-map-copy"><span className="home-preview-label"><MapPin size={16} /> Prévia ilustrativa</span><h2 id="preview-title">Um novo jeito de olhar para Araçatuba.</h2><p>Uma imagem pode ser o começo de muitas descobertas. Selecione os pontos e experimente a camada desta prévia.</p><p className="home-demo-note">As marcações são fictícias e demonstram a navegação. Ainda não são um diagnóstico da cidade.</p><div className="home-map-actions"><Link className="ar-button ar-button--secondary" to={paths.map}>Conhecer a área do mapa <ArrowUpRight size={18} /></Link><LivingGraphic kind="leaf" className="home-map-graphic" /></div></Reveal>
			<IllustrativeMap className="home-map-preview" />
		</section>

		<RuleSection illustrated />

		<section className="home-closing home-shell"><LivingGraphic kind="canopy" className="home-closing-graphic" /><div><h2>Conhecer é o primeiro passo para cuidar.</h2><p>Vamos olhar para a cidade com mais atenção?</p></div><a href="#previa" className="ar-button ar-button--primary">Explorar a prévia <ArrowUpRight size={18} /></a></section>
		<footer className="home-footer home-shell">
			<div>
				<strong>Arboriza</strong>
				<p>Mobilidade urbana e sustentabilidade.<br />Projeto acadêmico · SEMATEC 2026</p>
			</div>
			<nav aria-label="Referências e informações">
				<a href="https://www.aracatuba.sp.gov.br/arborizacao">Arborização de Araçatuba</a>
				{/* <Link to={paths.lab}>Laboratório visual</Link> */}
				<a href="#conteudo">Voltar ao topo</a></nav>
			<details>
				<summary>Fontes visuais</summary>
				<p>A fotografia de floresta é uma referência estética via <a href="https://images.unsplash.com/photo-1441974231531-c6227db76b6e">Unsplash</a> e não representa Araçatuba. Os ramos recortados são imagens sintéticas geradas com IA, sem identificação de espécie ou localização. Ortofoto: IGC / DataGEO, reaproveitada do protótipo, com pontos fictícios. Grafismos vetoriais de apoio criados para o Arboriza.</p>
			</details>
		</footer>
	</div>
}
