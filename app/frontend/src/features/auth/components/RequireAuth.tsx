import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { paths } from '../../../shared/config/paths'
import Button from '../../../shared/ui/controls/Button'

export default function RequireAuth() {
  const { state, retry } = useAuth()
  const location = useLocation()
  if (state === 'loading') return <p className="auth-route-state" role="status">Conferindo sua sessão…</p>
  if (state === 'offline') return <div className="auth-route-state" role="alert"><p>Não foi possível conferir sua sessão. Verifique se o backend está em execução.</p><Button onClick={retry}>Tentar novamente</Button></div>
  if (state === 'anonymous') return <Navigate to={paths.login} state={{ from: location.pathname + location.search }} replace />
  return <Outlet />
}
