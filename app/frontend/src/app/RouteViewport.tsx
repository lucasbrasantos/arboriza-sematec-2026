import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { paths } from '../shared/config/paths'

export default function RouteViewport() {
  const { pathname, hash } = useLocation()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const comparingSamples = previousPath.current?.startsWith(`${paths.lab}/`) && pathname.startsWith(`${paths.lab}/`)
    let observer: MutationObserver | undefined
    let frame: number | undefined
    if (hash) {
      const scrollToAnchor = () => {
        const target = document.getElementById(hash.slice(1))
        if (!target) return false
        frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
        return true
      }
      // A seção pode chegar depois do fallback de uma rota carregada sob demanda.
      if (!scrollToAnchor()) {
        observer = new MutationObserver(() => { if (scrollToAnchor()) observer?.disconnect() })
        observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
      }
    } else if (!comparingSamples) {
      window.scrollTo(0, 0)
    }
    previousPath.current = pathname
    return () => {
      observer?.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [pathname, hash])

  return null
}
