import { Leaf } from 'lucide-react'
import AnimatedNumber from '../../ui/motion/AnimatedNumber'
import BotanicalGraphic from '../../ui/graphics/BotanicalGraphic'
import LivingGraphic from '../../ui/graphics/LivingGraphic'
import './rule-section.css'

type RuleSectionProps = { motionEnabled?: boolean; illustrated?: boolean }
const rules = [
  { value: 3, suffix: '', title: 'Árvores à vista', text: 'Ver ao menos três árvores bem desenvolvidas de casa, da escola ou do trabalho.' },
  { value: 30, suffix: '%', title: 'Copas nos bairros', text: 'Buscar pelo menos 30% de cobertura de copas em cada bairro.' },
  { value: 300, suffix: 'm', title: 'Verde por perto', text: 'Ter uma área verde pública acessível a até 300 metros de casa.' },
] as const

export default function RuleSection({ motionEnabled = true, illustrated = false }: RuleSectionProps) {
  return <section id="regra" className="ar-rule" aria-labelledby="rule-title">
    {!illustrated && <BotanicalGraphic className="ar-rule-graphic" motionEnabled={motionEnabled} />}
    <div className="ar-rule-shell">
      <div className={`ar-rule-intro${illustrated ? ' ar-rule-intro--illustrated' : ''}`}>{illustrated ? <LivingGraphic kind="branch" className="ar-rule-living" motionEnabled={motionEnabled} /> : <Leaf size={25} />}<h2 id="rule-title">Mais natureza<br />no nosso dia a dia.</h2><p>A regra 3-30-300 é uma referência para pensar na presença das árvores e no acesso a espaços verdes.</p></div>
      <div className="ar-rule-grid">{rules.map((rule, index) => <article key={rule.value}>
        <strong><AnimatedNumber value={rule.value} suffix={rule.suffix} motionEnabled={motionEnabled} delay={index * .09} /></strong>
        <h3>{rule.title}</h3><p>{rule.text}</p>
      </article>)}</div>
      <div className="ar-rule-foot"><p>Uma referência educativa. O Arboriza ainda não calcula o atendimento à regra.</p><a href="https://doi.org/10.1007/s11676-022-01523-z">Conheça o estudo de Konijnendijk</a></div>
    </div>
  </section>
}
