import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowRight, Check, MousePointer2, RotateCcw } from 'lucide-react'
import GlassPanel from '../../shared/ui/GlassPanel'
import LivingGraphic from '../../shared/ui/LivingGraphic'
import Toggle from '../../shared/ui/Toggle'
import usePrefersReducedMotion from '../../shared/hooks/usePrefersReducedMotion'
import branchImage from '../../assets/graphics/botanical-branch.png'
import './graphic-study.css'

const accents = [
  { id: 'mel', label: 'Mel', hex: '#E9B949', surface: '#FBF0CD', text: 'Quente e solar. Minha recomendação inicial.' },
  { id: 'coral', label: 'Coral', hex: '#EE9C82', surface: '#FCE5DC', text: 'Mais expressivo, próximo dos tons de frutos.' },
  { id: 'ceu', label: 'Azul-céu', hex: '#91BFE0', surface: '#E1F0FA', text: 'Mais fresco, com contraste de céu e água.' },
] as const
type AccentId = (typeof accents)[number]['id']
const compositions = [
  { id: 'mista', label: 'Mistura', description: 'Recorte botânico com vetores marcantes.' },
  { id: 'botanica', label: 'Botânica', description: 'Ramos e folhas como protagonistas.' },
  { id: 'geometrica', label: 'Geométrica', description: 'Copas e formas com mais presença.' },
] as const
type CompositionId = (typeof compositions)[number]['id']
type StudyStyle = CSSProperties & { '--ar-highlight': string; '--study-highlight-surface': string }

export default function GraphicStudy({ motionEnabled = true }: { motionEnabled?: boolean }) {
  const [accentId, setAccentId] = useState<AccentId>('mel')
  const [composition, setComposition] = useState<CompositionId>('mista')
  const [movement, setMovement] = useState(true)
  const [replay, setReplay] = useState(0)
  const reduced = usePrefersReducedMotion()
  const enabled = motionEnabled && movement && !reduced
  const accent = accents.find((item) => item.id === accentId) ?? accents[0]
  const style: StudyStyle = { '--ar-highlight': accent.hex, '--study-highlight-surface': accent.surface }
  const scene = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: scene, offset: ['start end', 'end start'] })
  const scrollY = useTransform(scrollYProgress, [0, 1], [16, -16])
  const photoTurn = useSpring(0, { stiffness: 95, damping: 23 })

  function movePhoto(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    photoTurn.set(((event.clientX - rect.left) / rect.width - .5) * 9)
  }

  return <section id="grafismos" className="graphic-study lab-shell" aria-labelledby="graphic-study-title" style={style}>
    <div className="study-heading"><div><h2 id="graphic-study-title">Mais natureza.<br />Mais presença.</h2><p>A mistura com destaque Mel foi aprovada para a página Início. Aqui você ainda pode comparar as composições e as outras cores.</p></div><a href="#study-preview">Ir para a amostra <ArrowRight size={17} /></a></div>

    <fieldset className="study-accent-options"><legend>Compare a cor de destaque</legend><div>{accents.map((item) => <button type="button" key={item.id} aria-pressed={accentId === item.id} onClick={() => setAccentId(item.id)} className="study-accent-option">
      <span className="study-accent-color" style={{ backgroundColor: item.hex }}>{accentId === item.id && <Check size={21} />}</span><span><strong>{item.label} <small>{item.hex}</small></strong><span>{item.text}</span></span>
    </button>)}</div></fieldset>

    <div className="study-preview-toolbar"><fieldset><legend>Composição dos elementos</legend><div className="study-compositions">{compositions.map((item) => <button type="button" key={item.id} aria-pressed={composition === item.id} onClick={() => setComposition(item.id)}>{item.label}</button>)}</div></fieldset><Toggle label="Animar grafismos" checked={enabled} onChange={setMovement} disabled={reduced || !motionEnabled} /></div>

    <div id="study-preview" ref={scene} className="study-scene" data-composition={composition} data-motion={enabled ? 'on' : 'off'} onPointerMove={movePhoto} onPointerLeave={() => photoTurn.set(0)}>
      <div className="study-scene-copy"><h3>O verde ganha<br />novas formas.</h3><p>Folhas, copas e texturas presentes na composição — com espaço para a informação respirar.</p><button className="study-replay" type="button" disabled={!enabled} onClick={() => setReplay((value) => value + 1)}><RotateCcw size={17} /> Animar novamente</button><span className="study-gesture"><MousePointer2 size={15} /> Explore as folhas com o ponteiro ou use o botão.</span></div>
      <motion.div className="study-canopy" style={{ y: enabled ? scrollY : 0 }}><LivingGraphic kind="canopy" motionEnabled={enabled} replay={replay} /></motion.div>
      <motion.div className="study-photo-branch" style={{ rotate: enabled ? photoTurn : 0, y: enabled ? scrollY : 0 }} aria-hidden="true"><motion.img key={replay} src={branchImage} alt="" width={1536} height={1024} loading="lazy" initial={false} whileInView={{ rotate: enabled ? [0, -5, 2, 0] : 0 }} viewport={{ once: true }} transition={{ duration: .85 }} /></motion.div>
      <div className="study-vector-branch"><LivingGraphic kind="branch" motionEnabled={enabled} replay={replay} /></div>
      <div className="study-scene-leaf"><LivingGraphic kind="leaf" motionEnabled={enabled} replay={replay} /></div>
      <GlassPanel className="study-glass-note" motionEnabled={enabled}><span className="study-highlight-mark" /><strong>Natureza em primeiro plano.</strong><p>O vidro continua. Os elementos de apoio ganham escala, cor e lugar na página.</p></GlassPanel>
    </div>
    <p className="study-current" role="status">Cor: {accent.label}. {compositions.find((item) => item.id === composition)?.description} {reduced ? 'Movimento reduzido do sistema respeitado.' : enabled ? 'Ponteiro, entrada na tela e rolagem ativos.' : 'Grafismos estáticos.'} Ramo gerado com IA.</p>

    <div className="study-distribution"><div><h3>Uma linguagem para cada área.</h3><p>Elementos visíveis e inteiros nos pontos de destaque, com variações de escala ao longo da página.</p></div><dl><div><dt>Início</dt><dd>Ramos junto da abertura, copas entre seções e folhas acompanhando o conteúdo educativo.</dd></div><div><dt>Mapa público</dt><dd>Grafismos na introdução e nos estados sem dados. Área de leitura do mapa preservada.</dd></div><div><dt>Administração</dt><dd>Apoio na entrada e nas orientações. Formulários e ferramentas mantêm clareza.</dd></div></dl></div>
    <details className="study-sources"><summary>Sobre a imagem e a cor</summary><p>O ramo é uma imagem sintética criada com IA para esta comparação, com fundo transparente. Não representa uma espécie identificada nem uma árvore de Araçatuba. Os vetores são próprios. A cor de destaque desta amostra é decorativa e não altera ações, avisos ou classes do mapa. Nenhuma escolha é salva.</p><p>Referências de linguagem: <a href="https://www.aracatuba.sp.gov.br/arborizacao">Arborização de Araçatuba</a> e <a href="https://communitygreening.org/">Community Greening</a>. Alternativas para uma futura curadoria: <a href="https://www.rawpixel.com/search/botanical%20png">coleção de elementos botânicos</a>; a licença de cada item deve ser conferida antes da adoção.</p></details>
  </section>
}
