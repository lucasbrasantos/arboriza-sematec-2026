import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { GeoJSON, Marker, useMap, useMapEvents } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { FeatureCollection, Polygon } from 'geojson'
import { ArrowLeft, Check, ChevronDown, Download, Layers, RefreshCw, TreePine } from 'lucide-react'
import MapCanvas from '../components/MapCanvas'
import { areas, heatPalettes } from '../data/map-data'
import type { MapArea } from '../data/map-data'
import { api } from '../../auth/services/api'
import logo from '../../../assets/brand/logo-horizontal.svg'
import '../styles/map.css'
import '../styles/sector-comparison.css'

type Metric = 'individuos' | 'densidade' | 'cobertura'
type Label = 'none' | 'individuos' | 'cobertura'
type Stats = { id: string; status?: string; individuos?: number; grupos?: number; pendentes?: number; area_m2?: number; copas_m2?: number; densidade?: number; cobertura?: number; label?: [number,number] }
type Base = { id: string; modelo: string; completed_at: string; classes: Record<Metric,number[]> }
type Data = FeatureCollection<Polygon,Stats> & { base: Base | null }
const metrics: Record<Metric,{label:string;unit:string}> = { individuos:{label:'Indivíduos detectados',unit:'indivíduos'}, densidade:{label:'Indivíduos por hectare',unit:'ind./ha'}, cobertura:{label:'Cobertura de copas',unit:'%'} }
const palette = ['#dc8065','#e7bd6c','#b5ce8a','#70ab78','#29734c']
const format = (n:number,digits=0) => n.toLocaleString('pt-BR',{maximumFractionDigits:digits})
function color(value:number | undefined, breaks:number[]) {
  if (value === undefined) return '#dce1d9'
  const index = breaks.findIndex((limit) => value<=limit)
  return palette[Math.min(4,index<0?breaks.length:index)] ?? palette[0]
}

function Numbers({features,mode}:{features:Data['features'];mode:Label}) {
  const map = useMap()
  const [revision,setRevision] = useState(0)
  useMapEvents({zoomend:()=>setRevision(v=>v+1),moveend:()=>setRevision(v=>v+1)})
  const labels = useMemo(() => {
    void revision // A projeção precisa ser refeita quando o mapa se move.
    if(mode==='none') return []
    const occupied: {x:number;y:number}[]=[]
    return features.flatMap(feature => {
      const p=feature.properties
      if(!p.label || p[mode]===undefined || !map.getBounds().contains(p.label)) return []
      const pixel=map.latLngToContainerPoint(p.label)
      if(occupied.some(pos=>Math.abs(pos.x-pixel.x)<66 && Math.abs(pos.y-pixel.y)<27)) return []
      occupied.push(pixel)
      const value=format(p[mode] ?? 0,mode==='cobertura'?1:0)+(mode==='cobertura'?'%':'')
      return [{id:String(feature.id),position:p.label,icon:divIcon({className:'sector-number',html:`<span>${value}</span>`,iconSize:[66,26],iconAnchor:[33,13]})}]
    })
  },[features,mode,map,revision])
  return labels.map(label=><Marker key={label.id} position={label.position} icon={label.icon} interactive={false} keyboard={false} />)
}

export default function SectorComparison({initialIds,onClose}:{initialIds?:string[];onClose?:()=>void}) {
  const navigate = useNavigate()
  const [data,setData]=useState<Data|null>(null)
  const [selected,setSelected]=useState<Set<string>>(()=>new Set(initialIds ?? []))
  const [metric,setMetric]=useState<Metric>('individuos')
  const [labels,setLabels]=useState<Label>('none')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(true)
  const [panel,setPanel]=useState(()=>window.matchMedia('(min-width: 900px)').matches)
  const [query,setQuery]=useState('')
  const [attempt,setAttempt]=useState(0)
  const [initialSelection]=useState(initialIds??[])
  useEffect(()=>{document.title='Comparar setores | Arboriza'},[])
  useEffect(()=>{
    const controller=new AbortController()
    api<Data>('/base-urbana/publicada',{signal:controller.signal},false).catch(async originalError=>{
      const saved=await fetch('/data/base-urbana-aracatuba.geojson',{signal:controller.signal})
      if(!saved.ok) throw originalError
      return saved.json() as Promise<Data>
    }).then(async result=>{
      if(!result.features.length) {
        const response=await fetch('/data/setores-urbanos-aracatuba-ibge-2022.geojson',{signal:controller.signal})
        if(!response.ok) throw new Error('Não foi possível carregar os limites dos setores.')
        const original=await response.json() as FeatureCollection<Polygon>
        result={type:'FeatureCollection',base:null,features:original.features.map(f=>({...f,properties:{id:String(f.id)}}))}
      }
      if(controller.signal.aborted) return
      setData(result); setError('')
      setSelected(current=>current.size?current:new Set(result.features.map(f=>String(f.id))))
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Não foi possível carregar a base.')})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false)})
    return ()=>controller.abort()
  },[attempt])
  const toggle=useCallback((id:string)=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next}),[])
  const chosen=useMemo(()=>data?.features.filter(f=>selected.has(String(f.id))) ?? [],[data,selected])
  const stats=useMemo(()=>chosen.reduce((sum,f)=>({n:sum.n+(f.properties.individuos??0),area:sum.area+(f.properties.area_m2??0),canopy:sum.canopy+(f.properties.copas_m2??0),complete:sum.complete+Number(f.properties.status==='concluido')}),{n:0,area:0,canopy:0,complete:0}),[chosen])
  const area=useMemo<MapArea>(()=>{
    const initial=data?.features.filter(f=>initialSelection.includes(String(f.id))) ?? []
    const features=initial.length?initial:data?.features ?? []
    const coordinates=features.flatMap(f=>f.geometry.coordinates.flat())
    if(!coordinates.length)return {...areas.cidade,hasExamples:false}
    return {...areas.cidade,hasExamples:false,bounds:[[Math.min(...coordinates.map(p=>p[1]??0)),Math.min(...coordinates.map(p=>p[0]??0))],[Math.max(...coordinates.map(p=>p[1]??0)),Math.max(...coordinates.map(p=>p[0]??0))]]}
  },[data,initialSelection]) // A seleção não reposiciona o mapa a cada clique.
  const breaks=data?.base?.classes[metric]??[]
  const options=data?.features.filter(f=>String(f.id).includes(query.trim())) ?? []
  const legend=[...breaks,Infinity]
  return <section className="sector-comparison public-map-page" aria-label="Comparação dos setores urbanos">
    <div className="sector-map"><MapCanvas area={area} base="streets" layers={{points:false,segments:false,boundary:false}} items={[]} selected={null} view="points" heatColors={heatPalettes.forest.colors} leftInset={panel?320:0} onSelect={()=>{}} onClear={()=>{}}>
      {data && <GeoJSON data={data} key={data.base?.id??'empty'} style={feature=>{const id=String(feature?.id);const active=selected.has(id);return {color:active?'#557a54':'#aebca4',weight:active?1:.65,fillColor:active?color(feature?.properties?.[metric] as number|undefined,breaks):'#e8eadf',fillOpacity:active?.83:.22}}} onEachFeature={(feature,layer)=>{
        layer.on('click',()=>toggle(String(feature.id)))
        const p=feature.properties as Stats
        const text=p.status==='concluido'?`${p.id} · ${format(p.individuos??0)} indivíduos · ${format(p.cobertura??0,1)}% de copas`:`${p.id} · Sem resultado publicado`
        layer.bindTooltip(text,{sticky:true})
      }} />}
      <Numbers features={chosen} mode={labels} />
    </MapCanvas></div>
    <header className="sector-header"><button type="button" onClick={()=>onClose?onClose():void navigate('/mapa')} aria-label="Voltar ao mapa"><ArrowLeft size={18}/></button><img src={logo} alt="Arboriza"/><span>Comparar setores</span><button type="button" aria-label="Selecionar setores" aria-expanded={panel} aria-controls="sector-panel" onClick={()=>setPanel(!panel)}><Layers size={17}/><span>Seleção</span></button></header>
    <aside className="sector-panel" id="sector-panel" hidden={!panel}>
      <div className="sector-panel-title"><h2>Seu recorte</h2><button type="button" onClick={()=>setPanel(false)} aria-label="Recolher seleção"><ChevronDown size={18}/></button></div>
      <p>Clique nos setores do mapa para incluir ou remover.</p>
      <div className="sector-selection-count"><strong>{format(selected.size)}</strong><span>de {data?.features.length??499} setores urbanos selecionados</span></div>
      <div className="sector-selection-actions"><button type="button" onClick={()=>setSelected(new Set(data?.features.map(f=>String(f.id))))}>Selecionar todos</button><button type="button" onClick={()=>setSelected(new Set())}>Limpar</button></div>
      <label htmlFor="sector-search">Buscar código do setor</label><input id="sector-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Código IBGE"/>
      <div className="sector-list">{options.map(f=><button type="button" key={String(f.id)} aria-pressed={selected.has(String(f.id))} onClick={()=>toggle(String(f.id))}><span className="sector-check">{selected.has(String(f.id))&&<Check size={13}/>}</span><span>{String(f.id)}</span><small>{f.properties.individuos===undefined?'—':format(f.properties.individuos)}</small></button>)}</div>
      {data?.base && <a href="/api/base-urbana/exportar/geopackage"><Download size={15}/>Baixar base completa</a>}
    </aside>
    <div className={`sector-legend ${panel?'has-panel':''}`}>
      <div className="sector-legend-heading"><span><TreePine size={16}/> Arborização urbana</span><button type="button" onClick={()=>{setBusy(true);setAttempt(v=>v+1)}} disabled={busy} aria-label="Atualizar base do mapa"><RefreshCw size={15}/></button></div>
      <label className="sector-metric"><select aria-label="Indicador das cores" value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{Object.entries(metrics).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select><ChevronDown size={16}/></label>
      {data?.base?<><div className="sector-color-scale" aria-label="Faixas de valores">{legend.map((limit,i)=><div key={i}><i style={{background:palette[Math.min(4,i)]}}/><span>{i===0?`Até ${format(limit,metric==='individuos'?0:1)}`:Number.isFinite(limit)?`${format(breaks[i-1]??0,1)}–${format(limit,1)}`:`Acima de ${format(breaks[i-1]??0,1)}`}</span></div>)}</div><div className="sector-scale-unit">{metrics[metric].unit} · faixas fixas da base urbana</div></>:<p className="sector-empty">{busy?'Carregando base…':'A primeira base urbana está em preparação. Setores cinza ainda não têm resultados publicados.'}</p>}
      <div className="sector-statistics"><div><strong>{stats.complete?format(stats.n):'—'}</strong><span>indivíduos detectados</span></div><div><strong>{stats.area?format(100*stats.canopy/stats.area,1)+'%':'—'}</strong><span>cobertura do recorte</span></div><div><strong>{stats.complete}/{selected.size}</strong><span>setores com resultado</span></div></div>
      <div className="sector-label-controls"><label htmlFor="sector-label-mode">Rótulos no mapa</label><select id="sector-label-mode" value={labels} onChange={e=>setLabels(e.target.value as Label)}><option value="none">Desativados</option><option value="individuos">Quantidade</option><option value="cobertura">Cobertura (%)</option></select></div>
      {selected.size<2&&<p className="sector-hint">Selecione pelo menos dois setores para comparar.</p>}
      {error&&<p role="alert">{error} <button type="button" onClick={()=>setAttempt(v=>v+1)}>Tentar novamente</button></p>}
    </div>
    <footer className="sector-source">{data?.base?<>Estimativa automática · V2 · {new Date(data.base.completed_at).toLocaleDateString('pt-BR')}<span>Grupos entram na cobertura, não na contagem de indivíduos. Pendentes excluídos.</span></>:<>Malha urbana IBGE 2022 · Araçatuba</>}</footer>
  </section>
}
