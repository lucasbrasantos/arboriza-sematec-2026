import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Home, LayoutDashboard, LogIn, Menu, X } from 'lucide-react'
import { paths } from '../../shared/config/paths'

export default function MapSiteNavigation({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <span ref={root} className="map-site-navigation" onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }}>
    <button ref={trigger} type="button" className="map-site-menu-toggle" aria-label={open ? 'Fechar navegação do site' : 'Abrir navegação do site'} title="Menu do site" aria-expanded={open} aria-controls="map-site-links" onClick={() => { if (!open) onOpen(); setOpen(!open) }}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    {open && <nav id="map-site-links" className="map-site-links" aria-label="Navegação do site"><strong>Para onde vamos?</strong><Link to={paths.home}><Home size={18} /> Voltar ao Início</Link><Link to={paths.admin}><LayoutDashboard size={18} /> Administração</Link><Link to={paths.login}><LogIn size={18} /> Login da equipe</Link></nav>}
  </span>
}
