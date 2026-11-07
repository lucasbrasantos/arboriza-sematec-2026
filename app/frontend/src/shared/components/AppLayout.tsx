import { Outlet } from 'react-router'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/manrope'
import SiteHeader from './SiteHeader'
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion'
import '../styles/theme.css'

export default function AppLayout() {
  const reduced = usePrefersReducedMotion()
  return (
    <div className="ar-theme app-layout" data-motion={reduced ? 'off' : 'on'}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
      </MotionConfig>
    </div>
  )
}
