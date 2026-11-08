import { Link, NavLink } from 'react-router'
import { useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { paths } from '../../config/paths'
import type { AppPath } from '../../config/paths'
import logo from '../../../assets/brand/logo-horizontal.svg'
import './site-header.css'

type NavigationItem = { to: AppPath; label: string }

const links = [
	{ to: paths.home, label: 'Início' },
	{ to: paths.map, label: 'Mapa público' },
	{ to: paths.admin, label: 'Administração' },
	{ to: paths.login, label: 'Login' },
	//   { to: paths.lab, label: 'Laboratório visual' },
] satisfies readonly NavigationItem[]

export default function SiteHeader() {
	const [open, setOpen] = useState(false)
	const menuButton = useRef<HTMLButtonElement>(null)
	return (
		<header className="app-header" onKeyDown={(event) => {
			if (event.key === 'Escape' && open) { setOpen(false); menuButton.current?.focus() }
		}}>
			<div className="app-header-inner">
				<Link className="app-brand" to={paths.home} onClick={() => setOpen(false)} aria-label="Arboriza, início"><img src={logo} alt="Arboriza" /></Link>
				<button ref={menuButton} className="app-menu-toggle" type="button" aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}<span>Menu</span></button>
				<nav id="app-navigation" className="app-navigation" data-open={open} aria-label="Navegação principal">
					{links.map(({ to, label }) => (
						<NavLink
							key={to}
							to={to}
							end={to !== paths.admin}
							onClick={() => setOpen(false)}
							className={({ isActive }) => isActive ? 'app-nav-link is-active' : 'app-nav-link'}
						>
							{label}
						</NavLink>
					))}
				</nav>
			</div>
		</header>
	)
}
