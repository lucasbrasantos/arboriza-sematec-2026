import { BrowserRouter } from 'react-router'
import AppRoutes from './routes'
import RouteViewport from './RouteViewport'
import AuthProvider from '../features/auth/context/AuthProvider'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <RouteViewport />
      <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
