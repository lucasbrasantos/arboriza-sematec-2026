import { Link, NavLink } from 'react-router'
import { paths } from '../config/paths'
import type { AppPath } from '../config/paths'

type NavigationItem = { to: AppPath; label: string }

const links = [
  { to: paths.home, label: 'Início' },
  { to: paths.map, label: 'Mapa público' },
  { to: paths.admin, label: 'Administração' },
  { to: paths.login, label: 'Login' },
  { to: paths.lab, label: 'Laboratório visual' },
] satisfies readonly NavigationItem[]

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" to={paths.home} aria-label="Arboriza, início">Arboriza</Link>
      <nav aria-label="Navegação principal">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => isActive ? 'nav-link is-active' : 'nav-link'}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
