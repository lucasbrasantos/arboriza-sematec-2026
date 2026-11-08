import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, FolderOpen, Info, Map } from 'lucide-react'
import { paths } from '../../shared/config/paths'
import aerial from '../../assets/samples/centro.jpg'
import './admin.css'

export default function AdminPage() {
  useEffect(() => { document.title = 'Administração | Arboriza' }, [])
  return <section className="admin-page" aria-labelledby="admin-title">
    <div className="admin-demo-notice"><Info size={17} /><p><strong>Ambiente demonstrativo.</strong> Acesso da equipe em preparação. Sem autenticação ou salvamento nesta amostra.</p></div>
    <header className="admin-page-heading"><div><h1 id="admin-title">Seu espaço de trabalho</h1><p>Produza os resultados no mapa. Organize e prepare a publicação pelo acervo.</p></div></header>
    <div className="admin-entry-grid">
      <Link className="admin-entry admin-entry--map" to={paths.adminMap}><img src={aerial} alt="" /><div className="admin-entry-content"><Map size={30} /><h2>Mapa administrativo</h2><p>Área de trabalho para delimitar, analisar imagens e revisar as marcações.</p><span>Abrir espaço do mapa <ArrowUpRight size={20} /></span></div></Link>
      <Link className="admin-entry admin-entry--archive" to={paths.adminArchive}><div className="admin-entry-content"><FolderOpen size={30} /><h2>Análises e importações</h2><p>Consulte os resultados por registro, sua abrangência e as informações para publicação.</p><span>Abrir acervo <ArrowUpRight size={20} /></span></div></Link>
    </div>
    <p className="admin-hub-note">O mapa público apresenta o material publicado pela equipe. As ferramentas de processamento ficam neste espaço administrativo.</p>
  </section>
}
