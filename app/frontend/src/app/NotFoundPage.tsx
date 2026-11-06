import { Link } from 'react-router'
import PlaceholderPage from '../shared/components/PlaceholderPage'
import { paths } from '../shared/config/paths'

export default function NotFoundPage() {
  return (
    <PlaceholderPage title="Página não encontrada">
      <Link to={paths.home}>Voltar ao início</Link>
    </PlaceholderPage>
  )
}
