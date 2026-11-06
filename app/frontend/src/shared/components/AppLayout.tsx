import { Outlet } from 'react-router'
import SiteHeader from './SiteHeader'

export default function AppLayout() {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
