import { BrowserRouter } from 'react-router'
import AppRoutes from './routes'
import RouteViewport from './RouteViewport'

export default function App() {
  return (
    <BrowserRouter>
      <RouteViewport />
      <AppRoutes />
    </BrowserRouter>
  )
}
