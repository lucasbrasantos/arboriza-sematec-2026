import { useState } from 'react'
import { Layers, Leaf, MapPin } from 'lucide-react'
import GlassPanel from '../../ui/surfaces/GlassPanel'
import aerialImage from '../../../assets/samples/aracatuba.jpg'
import './illustrative-map.css'

const points = [{ id: 'a', x: 28, y: 30 }, { id: 'b', x: 53, y: 46 }, { id: 'c', x: 73, y: 24 }] as const
type PointId = (typeof points)[number]['id']
type IllustrativeMapProps = { className?: string }

export default function IllustrativeMap({ className = '' }: IllustrativeMapProps) {
  const [visible, setVisible] = useState(true)
  const [selected, setSelected] = useState<PointId>('b')
  return <div className={`ar-map-preview ${className}`} aria-label="Demonstração de mapa com pontos fictícios">
    <img src={aerialImage} alt="Ortofoto de uma região de Araçatuba, IGC e DataGEO" loading="lazy" />
    <div className="ar-map-tint" />
    <button className="ar-map-layer" type="button" aria-pressed={visible} onClick={() => setVisible(!visible)}><Layers size={16} />{visible ? 'Ocultar pontos' : 'Mostrar pontos'}</button>
    {visible && points.map((point) => <button key={point.id} type="button" className={`ar-map-point ${selected === point.id ? 'is-selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`Selecionar ponto ilustrativo ${point.id.toUpperCase()}`} aria-pressed={selected === point.id} onClick={() => setSelected(point.id)}><Leaf size={16} /></button>)}
    <GlassPanel className="ar-map-detail" interactive={false}>
      <span className="ar-map-detail-icon"><MapPin size={20} /></span>
      <div><strong>{visible ? `Ponto ilustrativo ${selected.toUpperCase()}` : 'Camada de pontos oculta'}</strong><p>{visible ? 'Clique nas marcações para experimentar.' : 'Ative a camada para ver as marcações.'}</p></div>
    </GlassPanel>
    <span className="ar-map-source">IGC / DataGEO · Pontos fictícios, sem diagnóstico</span>
  </div>
}
