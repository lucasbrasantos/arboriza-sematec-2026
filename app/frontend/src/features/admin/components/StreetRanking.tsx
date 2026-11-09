import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StreetResult } from './StreetDiagnostic'
import type { StreetView } from '../streets/street-view'
import { intensityColor, intensityMetrics, rankStreets, segmentIntensity } from '../streets/street-intensity'

type Props = { data: StreetResult; view: StreetView; onView: (patch: Partial<StreetView>) => void; onSelect: (id: string | null) => void }
export default function StreetRanking({ data, view, onView, onSelect }: Props) {
  const selectedKeys = view.rankedKeys ?? []
  const [ascending, setAscending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const ranked = useMemo(() => rankStreets(data, view.metric, ascending), [data, view.metric, ascending])
  const maximum = useMemo(() => data.features.reduce((max, feature) => Math.max(max, segmentIntensity(feature, view.metric)), 0), [data, view.metric])
  const format = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const target = document.getElementById('street-ranking-slot')
  return target ? createPortal(<section className="street-ranking" aria-label="Ranking das ruas analisadas">
    <h3>Ranking de ruas</h3><label htmlFor="street-intensity-metric">Indicador de intensidade</label><select id="street-intensity-metric" value={view.metric} onChange={(event) => { const metric = event.target.value; if (metric === 'base-rate' || metric === 'individual-rate' || metric === 'coverage') onView({ metric }) }}>{Object.entries(intensityMetrics).filter(([key]) => data.arboriza.multicamadas || key === 'base-rate').map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select>
    <div className="street-intensity-scale" aria-label={`Escala de 0 a ${format(maximum)} ${intensityMetrics[view.metric].unit}`} /><div className="street-ranking-scale-labels"><span>0 · menor intensidade</span><span>{format(maximum)} {intensityMetrics[view.metric].unit}</span></div><p>Verde mais forte indica maior valor do indicador. Azul marca o trecho selecionado.</p>
    <div className="street-ranking-tabs" role="group" aria-label="Ordenar ranking"><button type="button" aria-pressed={!ascending} onClick={() => setAscending(false)}>Mais verdes</button><button type="button" aria-pressed={ascending} onClick={() => setAscending(true)}>Menos árvores*</button></div>
    <p role="status">{selectedKeys.length} rua(s) selecionada(s). Clique para adicionar ou remover.</p>{selectedKeys.length > 0 && <button type="button" onClick={() => { onView({ rankedKeys: [] }); onSelect(null) }}>Limpar seleção do ranking</button>}<ol className="street-ranking-list" data-expanded={expanded}>{ranked.slice(0, expanded ? ranked.length : 5).map((row, index) => <li key={row.key}><button type="button" title="Adicionar ou remover esta rua da seleção" aria-pressed={selectedKeys.includes(row.key)} onClick={() => {
      const removing = selectedKeys.includes(row.key)
      const nextKeys = removing ? selectedKeys.filter((key) => key !== row.key) : [...selectedKeys, row.key]
      onSelect(removing ? null : row.ids[0] ?? null)
      onView({ rankedKeys: nextKeys, category: 'all', search: '', ...(removing ? {} : { focus: row.ids[0] ? { id: row.ids[0], ids: rankStreets(data).filter((street) => nextKeys.includes(street.key)).flatMap((street) => street.ids), revision: performance.now() } : null }) })
    }}><span className="street-rank-position">{index + 1}</span><span><strong>{row.name}</strong><small>{format(row.length)} m analisados · {row.individuals} individuais · {row.groups} grupos{row.partial ? ' · entorno parcial' : ''}</small></span><b><i aria-hidden="true" className="street-rank-swatch" style={{ background: intensityColor(row.value, maximum) }} />{format(row.value)}<small>{intensityMetrics[view.metric].unit}</small></b></button></li>)}</ol>
    <button type="button" className="street-ranking-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Recolher para o top 5' : `Expandir ranking · ${ranked.length} ruas`}</button><p>*São propostas do modelo, não árvores confirmadas. O ranking considera somente os trechos analisados, agrupados pelo nome OSM. Vias sem nome mantêm o identificador próprio.</p><p>{view.metric === 'coverage' ? 'Cobertura: média dos percentuais dos trechos, ponderada pelo comprimento; não é a união de copas da rua inteira.' : 'Taxa calculada por 100 m para comparar comprimentos diferentes. Grupos não equivalem a uma árvore; complementos pendentes não entram no indicador.'}</p>
  </section>, target) : null
}
