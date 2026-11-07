import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleDashed, ClipboardCheck, Eye, FolderOpen, Info, Layers, MapPin, Search, Sprout, X } from 'lucide-react'
import Button from '../../shared/ui/Button'
import GlassPanel from '../../shared/ui/GlassPanel'
import { paths } from '../../shared/config/paths'
import { areaStateLabels, normalizeAreaSearch, workAreas } from './admin-data'
import type { WorkArea } from './admin-data'
import './admin.css'

type AreaFilter = 'all' | WorkArea['state']
function AreaStatus({ area }: { area: WorkArea }) {
  return <span className={`admin-area-status admin-area-status--${area.state}`}>{area.state === 'review' ? <ClipboardCheck size={15} /> : <CircleDashed size={15} />}{areaStateLabels[area.state]}</span>
}

function AreaWorkspace({ area }: { area: WorkArea }) {
  return <div className="admin-workspace">
    <div className="admin-workflow">
      <div className="admin-section-heading"><h2>Etapas desta área</h2><span>Fluxo proposto</span></div>
      <p className="admin-section-intro">Os resultados pertencem à área. A revisão vem antes da publicação.</p>
      <ol className="admin-steps">
        <li><span className="admin-step-number">1</span><div><h3>Obter resultados</h3><p>Executar uma análise de imagem ou importar resultados já processados.</p><div className="admin-methods"><span><Sprout size={16} /> Análise pelo site</span><span><Layers size={16} /> Importação</span></div><Button disabled appearance="secondary">Configurar análise ou importação</Button><small>Formulários na próxima rodada de validação.</small></div></li>
        <li><span className="admin-step-number">2</span><div><h3>Revisar marcações e trechos</h3><p>Conferir possíveis árvores e avaliar as prioridades sugeridas para os trechos.</p><span className="admin-step-context">{area.state === 'review' ? `${area.points} pontos e ${area.segments} ${area.segments === 1 ? 'trecho fictício' : 'trechos fictícios'} neste cenário.` : 'Este cenário ainda não possui resultados para revisar.'}</span><small>Ferramentas de revisão serão construídas após a validação da estrutura.</small></div></li>
        <li><span className="admin-step-number">3</span><div><h3>Preparar publicação</h3><p>Conferir origem, revisão e prévia do que ficará disponível no mapa público.</p><span className="admin-step-context"><Eye size={16} /> Nenhum resultado publicado por esta demonstração.</span><small>Publicação e exportação serão detalhadas nas próximas etapas.</small></div></li>
      </ol>
    </div>
    <aside className="admin-area-summary" aria-label="Resumo da área">
      <GlassPanel interactive={false} className="admin-summary-panel"><h2>Resumo da área</h2>
        {area.preview ? <figure><img src={area.preview} alt={`Prévia aérea do recorte ${area.name}`} /><figcaption>Imagem de referência do protótipo. Não define o limite final da área piloto.</figcaption></figure> : <div className="admin-no-preview"><MapPin size={32} /><p>Limite ainda não definido neste exemplo.</p></div>}
        <dl><div><dt>Situação ilustrativa</dt><dd><AreaStatus area={area} /></dd></div><div><dt>Marcações de exemplo</dt><dd>{area.state === 'review' ? `${area.points} possíveis árvores · ${area.segments} ${area.segments === 1 ? 'trecho' : 'trechos'}` : 'Aguardando resultados'}</dd></div><div><dt>Origem dos resultados</dt><dd>{area.state === 'review' ? 'Dados fictícios para avaliar a interface' : 'Nenhum resultado disponível'}</dd></div><div><dt>Salvamento</dt><dd>Exemplo local, sem persistência</dd></div></dl>
      </GlassPanel><p className="admin-summary-note"><Info size={17} /><span>Contagem de pontos não confirma árvores nem mede cobertura de copas. A regra 3-30-300 permanece educativa.</span></p>
    </aside>
  </div>
}

export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const areaId = params.get('area')
  const area = workAreas.find((item) => item.id === areaId)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AreaFilter>('all')
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const previousArea = useRef<string | null>(null)
  const term = normalizeAreaSearch(query)
  const results = workAreas.filter((item) => (filter === 'all' || item.state === filter) && normalizeAreaSearch(`${item.name} ${item.description}`).includes(term))
  useEffect(() => { document.title = area ? `${area.name} · Administração | Arboriza` : 'Administração | Arboriza' }, [area])
  useEffect(() => {
    if (areaId) heading.current?.focus()
    else if (previousArea.current) {
      const trigger = document.getElementById(`admin-open-${previousArea.current}`)
      if (trigger) trigger.focus(); else heading.current?.focus()
    }
    previousArea.current = areaId
  }, [areaId])
  function backToAreas() { setParams({}) }
  return <section className="admin-page" aria-labelledby="admin-title">
    <div className="admin-demo-notice"><Info size={17} /><p><strong>Ambiente demonstrativo.</strong> Áreas e situações fictícias, sem autenticação ou conexão com a API.</p></div>
    <header className="admin-page-heading"><div>{areaId && <button type="button" className="admin-back" onClick={backToAreas}><ArrowLeft size={16} /> Todas as áreas</button>}<h1 ref={heading} tabIndex={-1} id="admin-title">{area ? area.name : areaId ? 'Área não encontrada' : 'Áreas de trabalho'}</h1><p>{area ? 'Acompanhe o caminho dos resultados, da análise à publicação.' : areaId ? 'Este endereço não corresponde a uma área da demonstração.' : 'Organize a análise e a revisão da arborização, uma área por vez.'}</p></div><Link className="admin-map-link" to={paths.map}>Abrir mapa público <ArrowUpRight size={18} /></Link></header>
    {area ? <AreaWorkspace area={area} /> : areaId ? <div className="admin-empty"><FolderOpen size={30} /><h2>Vamos voltar às áreas?</h2><p>Escolha um dos exemplos disponíveis para continuar.</p><Button onClick={backToAreas}>Ver áreas de trabalho</Button></div> : <>
      <GlassPanel interactive={false} className="admin-area-library">
        <div className="admin-library-heading"><h2>Suas áreas de exemplo</h2><span>{workAreas.length} áreas nesta demonstração</span></div>
        <div className="admin-list-controls"><div className="admin-search"><Search size={19} /><input ref={search} aria-label="Buscar áreas" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar pelo nome da área" maxLength={100} />{query && <button type="button" aria-label="Limpar busca de áreas" onClick={() => { setQuery(''); search.current?.focus() }}><X size={17} /></button>}</div><label className="admin-filter">Situação<select value={filter} onChange={(event) => { const value = event.currentTarget.value; if (value === 'all' || value === 'review' || value === 'empty') setFilter(value) }}><option value="all">Todas as situações</option><option value="review">Revisão pendente</option><option value="empty">Sem resultados</option></select></label></div>
        <p className="admin-results-status" role="status">{results.length} {results.length === 1 ? 'área encontrada' : 'áreas encontradas'}</p>
        {results.length > 0 ? <ul className="admin-area-list">{results.map((item) => <li key={item.id}><button id={`admin-open-${item.id}`} className="admin-area-row" type="button" onClick={() => setParams({ area: item.id })} aria-label={`Abrir área ${item.name}`}><span className="admin-area-thumbnail">{item.preview ? <img src={item.preview} alt="" /> : <MapPin size={25} />}</span><span className="admin-area-name"><strong>{item.name}</strong><small>{item.description}</small></span><AreaStatus area={item} /><span className="admin-area-open">Abrir área <ChevronRight size={19} /></span></button></li>)}</ul> : <div className="admin-empty"><Search size={28} /><h3>Nenhuma área encontrada</h3><p>Tente outro nome ou ajuste o filtro de situação.</p><Button appearance="secondary" onClick={() => { setQuery(''); setFilter('all'); search.current?.focus() }}>Limpar busca e filtro</Button></div>}
      </GlassPanel>
      <div className="admin-next-note"><Check size={20} /><div><h2>Primeiro, uma estrutura clara.</h2><p>Esta amostra permite escolher uma área e entender suas etapas. Análise, importação, revisão e publicação serão construídas por partes, após sua validação.</p></div></div>
    </>}
  </section>
}
