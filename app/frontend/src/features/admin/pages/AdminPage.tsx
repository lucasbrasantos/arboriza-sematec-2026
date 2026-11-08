import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, FolderOpen, Info, LogOut, Map } from 'lucide-react'
import { paths } from '../../../shared/config/paths'
import aerial from '../../../assets/samples/centro.jpg'
import '../styles/admin.css'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/context/AuthContext'
import UserManagement from '../components/UserManagement'

export default function AdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  async function exit() {
    setLoggingOut(true); setLogoutError('')
    try { await logout(); await navigate(paths.login, { replace: true }) }
    catch { setLogoutError('Não foi possível encerrar a sessão. Confira a conexão e tente novamente.') }
    finally { setLoggingOut(false) }
  }
  useEffect(() => { document.title = 'Administração | Arboriza' }, [])
  return <section className="admin-page" aria-labelledby="admin-title">
    <div className="admin-session"><span>Conectado como <strong>{user?.username}</strong> · {user?.role === 'admin' ? 'Administrador' : 'Operador'}</span><button type="button" onClick={() => void exit()} disabled={loggingOut}><LogOut size={17} />{loggingOut ? 'Saindo…' : 'Sair'}</button></div>
    {logoutError && <p role="alert" className="admin-session-error">{logoutError}</p>}
    <div className="admin-demo-notice"><Info size={17} /><p><strong>Mapa e acervo em demonstração.</strong> Os resultados ainda são exemplos e não são salvos.</p></div>
    <header className="admin-page-heading"><div><h1 id="admin-title">Seu espaço de trabalho</h1><p>Produza os resultados no mapa. Organize e prepare a publicação pelo acervo.</p></div></header>
    <div className="admin-entry-grid">
      <Link className="admin-entry admin-entry--map" to={paths.adminMap}><img src={aerial} alt="" /><div className="admin-entry-content"><Map size={30} /><h2>Mapa administrativo</h2><p>Área de trabalho para delimitar, analisar imagens e revisar as marcações.</p><span>Abrir espaço do mapa <ArrowUpRight size={20} /></span></div></Link>
      <Link className="admin-entry admin-entry--archive" to={paths.adminArchive}><div className="admin-entry-content"><FolderOpen size={30} /><h2>Análises e importações</h2><p>Consulte os resultados por registro, sua abrangência e as informações para publicação.</p><span>Abrir acervo <ArrowUpRight size={20} /></span></div></Link>
    </div>
    {user?.role === 'admin' && <UserManagement currentUser={user} />}
    <p className="admin-hub-note">O mapa público apresenta o material publicado pela equipe. As ferramentas de processamento ficam neste espaço administrativo.</p>
  </section>
}
