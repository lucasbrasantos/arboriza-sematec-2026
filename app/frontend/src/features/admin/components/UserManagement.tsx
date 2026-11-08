import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, UsersRound } from 'lucide-react'
import Button from '../../../shared/ui/controls/Button'
import { api, ApiError } from '../../auth/services/api'
import type { User } from '../../auth/context/AuthContext'

type Account = User & { active: boolean | number }
const messageFor = (error: unknown) => error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.'

export default function UserManagement({ currentUser }: { currentUser: User }) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'operator' | 'admin'>('operator')
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    api<Account[]>('/users').then((result) => { if (!cancelled) { setUsers(result); setMessage('') } })
      .catch((error: unknown) => { if (!cancelled) setMessage(messageFor(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, attempt])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      await api('/users', { method: 'POST', body: JSON.stringify({ username: username.trim(), password, role }) })
      setUsername(''); setPassword(''); setRole('operator'); setMessage('Usuário criado com sucesso.')
      try { setUsers(await api<Account[]>('/users')) }
      catch { setMessage('Usuário criado. Não foi possível atualizar a lista; abra esta seção novamente.') }
    } catch (error) { setMessage(messageFor(error)) } finally { setBusy(false) }
  }
  async function changeState(account: Account) {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const active = !account.active
      await api(`/users/${account.id}/estado`, { method: 'PATCH', body: JSON.stringify({ active }) })
      setUsers((current) => current.map((item) => item.id === account.id ? { ...item, active } : item))
      setMessage(active ? 'Acesso reativado.' : 'Acesso desativado.')
    } catch (error) { setMessage(messageFor(error)) } finally { setBusy(false) }
  }
  async function reset(event: FormEvent<HTMLFormElement>, account: Account) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    try {
      await api(`/users/${account.id}/senha`, { method: 'POST', body: JSON.stringify({ password: resetPassword }) })
      setResetId(null); setResetPassword('')
      if (account.id === currentUser.id) {
        await api('/auth/me')
      } else setMessage('Senha atualizada. As sessões anteriores foram encerradas.')
    } catch (error) { setMessage(messageFor(error)) } finally { setBusy(false) }
  }

  return <section className="users-section" aria-labelledby="users-title">
    <button type="button" className="users-toggle" aria-expanded={open} aria-controls="users-content" onClick={() => { if (!open) setLoading(true); setOpen(!open) }}>
      <span><UsersRound size={22} /><span><strong id="users-title">Usuários da equipe</strong><small>Cadastre pessoas e gerencie o acesso.</small></span></span><ChevronDown className={open ? 'users-chevron-open' : ''} size={20} />
    </button>
    {open && <div id="users-content" className="users-content">
      <div className="users-layout">
        <div><h3>Acessos cadastrados</h3>
          {loading ? <p role="status">Carregando usuários…</p> : <ul className="users-list">{users.map((account) => <li key={account.id}>
            <div className="users-row"><div className="users-identity"><strong>{account.username}</strong><span>{account.role === 'admin' ? 'Administrador' : 'Operador'} · {account.active ? 'Ativo' : 'Desativado'}{account.id === currentUser.id ? ' · Você' : ''}</span></div>
              <div className="users-actions"><button type="button" disabled={busy} onClick={() => { setResetId(resetId === account.id ? null : account.id); setResetPassword('') }}>Alterar senha</button><button type="button" disabled={busy || account.id === currentUser.id} onClick={() => void changeState(account)}>{account.active ? 'Desativar' : 'Reativar'}</button></div></div>
            {resetId === account.id && <form className="users-reset" onSubmit={(event) => void reset(event, account)}><label>Nova senha para {account.username}<input type="password" value={resetPassword} minLength={12} maxLength={256} required autoComplete="new-password" onChange={(event) => setResetPassword(event.currentTarget.value)} /></label><div><Button type="submit" disabled={busy}>Salvar senha</Button><Button appearance="quiet" onClick={() => { setResetId(null); setResetPassword('') }}>Cancelar</Button></div><small>Mínimo de 12 caracteres. As sessões desse usuário serão encerradas.</small></form>}
          </li>)}</ul>}
          {!loading && !users.length && <Button appearance="secondary" onClick={() => { setLoading(true); setAttempt((value) => value + 1) }}>Tentar novamente</Button>}
        </div>
        <form className="users-create" onSubmit={(event) => void create(event)}><h3>Adicionar usuário</h3><label>Usuário<input value={username} onChange={(event) => setUsername(event.currentTarget.value)} maxLength={100} required autoComplete="off" /></label><label>Senha inicial<input type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} minLength={12} maxLength={256} required autoComplete="new-password" /></label><small>Mínimo de 12 caracteres.</small><label>Permissão<select value={role} onChange={(event) => setRole(event.currentTarget.value === 'admin' ? 'admin' : 'operator')}><option value="operator">Operador</option><option value="admin">Administrador</option></select></label><p>Administradores também podem gerenciar usuários.</p><Button type="submit" disabled={busy}>{busy ? 'Aguarde…' : 'Criar usuário'}</Button></form>
      </div>
      <p className="users-feedback" role="status">{message}</p>
    </div>}
  </section>
}
