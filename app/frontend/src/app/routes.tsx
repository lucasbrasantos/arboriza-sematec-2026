import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import HomePage from '../features/home/HomePage'
import AdminPage from '../features/admin/AdminPage'
import LoginPage from '../features/auth/LoginPage'
import AppLayout from '../shared/components/AppLayout'
import { paths } from '../shared/config/paths'
import NotFoundPage from './NotFoundPage'

const StyleLabPage = lazy(() => import('../features/style-lab/StyleLabPage'))
const MapPage = lazy(() => import('../features/map/MapPage'))

export default function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.lab} element={<Navigate to={`${paths.lab}/equilibrio`} replace />} />
      {(['natural', 'profundo', 'equilibrio'] as const).map((variant) => (
        <Route key={variant} path={`${paths.lab}/${variant}`} element={
          <Suspense fallback={<p role="status">Abrindo o laboratório visual…</p>}>
            <StyleLabPage key={variant} variant={variant} />
          </Suspense>
        } />
      ))}
      <Route element={<AppLayout mode="map" />}>
        <Route path={paths.map} element={<Suspense fallback={<p className="map-route-loading" role="status">Preparando o mapa de Araçatuba…</p>}><MapPage /></Suspense>} />
      </Route>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path={paths.admin} element={<AdminPage />} />
        <Route path={paths.login} element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
