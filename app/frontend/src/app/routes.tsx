import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import HomePage from '../features/home/pages/HomePage'
import AdminPage from '../features/admin/pages/AdminPage'
import ArchivePage from '../features/admin/pages/ArchivePage'
import LoginPage from '../features/auth/pages/LoginPage'
import AboutPage from '../features/about/pages/AboutPage'
import AppLayout from '../shared/components/layout/AppLayout'
import { paths } from '../shared/config/paths'
import NotFoundPage from './NotFoundPage'
import RequireAuth from '../features/auth/components/RequireAuth'

const StyleLabPage = lazy(() => import('../features/style-lab/pages/StyleLabPage'))
const AdminMapPage = lazy(() => import('../features/admin/pages/AdminMapPage'))
const ArchiveReviewPage = lazy(() => import('../features/admin/pages/ArchiveReviewPage'))
const MapPage = lazy(() => import('../features/map/pages/PublishedMapPage'))
const SectorComparison = lazy(() => import('../features/map/pages/SectorComparison'))

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
				<Route path="/mapa/comparar" element={<Suspense fallback={<p className="map-route-loading" role="status">Preparando comparação…</p>}><SectorComparison /></Suspense>} />
				<Route element={<RequireAuth />}><Route path="/admin/acervo/:id/revisar" element={<Suspense fallback={<p className="map-route-loading" role="status">Abrindo revisão…</p>}><ArchiveReviewPage /></Suspense>} /></Route>
				<Route element={<RequireAuth />}><Route path={paths.adminMap} element={<Suspense fallback={<p className="map-route-loading" role="status">Abrindo o mapa administrativo…</p>}><AdminMapPage /></Suspense>} /></Route>
				<Route path={paths.map} element={<Suspense fallback={<p className="map-route-loading" role="status">Preparando o mapa de Araçatuba…</p>}><MapPage /></Suspense>} />
			</Route>
			<Route element={<AppLayout />}>
				<Route index element={<HomePage />} />
				<Route element={<RequireAuth />}><Route path={paths.admin} element={<AdminPage />} /><Route path={paths.adminArchive} element={<ArchivePage />} /></Route>
				<Route path={paths.login} element={<LoginPage />} />
				<Route path={paths.about} element={<AboutPage />} />
				<Route path="*" element={<NotFoundPage />} />
			</Route>
		</Routes>
	)
}
