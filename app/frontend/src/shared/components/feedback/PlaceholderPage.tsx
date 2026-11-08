import { useEffect } from 'react'
import type { ReactNode } from 'react'

type PlaceholderPageProps = {
  title: string
  children?: ReactNode
}

export default function PlaceholderPage({ title, children }: PlaceholderPageProps) {
  useEffect(() => {
    document.title = `${title} | Arboriza`
  }, [title])

  return (
    <section className="placeholder-page" aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      {children}
    </section>
  )
}
