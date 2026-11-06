import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/base.css'
import App from './app/App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('O elemento raiz da aplicação não foi encontrado.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
