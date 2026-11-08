import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Eye, EyeOff, Info, LockKeyhole, UserRound } from 'lucide-react'
import GlassPanel from '../../shared/ui/GlassPanel'
import Button from '../../shared/ui/Button'
import { paths } from '../../shared/config/paths'
import forest from '../../assets/samples/forest.jpg'
import './login.css'

type FieldErrors = { username?: string; password?: string }

export default function LoginPage() {
  const username = useRef<HTMLInputElement>(null)
  const password = useRef<HTMLInputElement>(null)
  const [visible, setVisible] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  useEffect(() => { document.title = 'Acesso da equipe | Arboriza' }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const next: FieldErrors = {}
    if (!username.current?.value.trim()) next.username = 'Informe seu usuário.'
    if (!password.current?.value) next.password = 'Informe sua senha.'
    setErrors(next)
    if (next.username) { username.current?.focus(); return }
    if (next.password) { password.current?.focus(); return }
    // Apenas interface: nenhuma credencial é enviada, salva ou validada.
    if (password.current) password.current.value = ''
    setVisible(false)
    setMessage('Demonstração concluída. A autenticação ainda não está conectada: nenhuma sessão foi aberta. A senha digitada foi limpa.')
  }

  return <section className="login-page" aria-labelledby="login-title">
    <div className="login-composition">
      <aside className="login-landscape" aria-label="Sobre o acesso da equipe">
        <img src={forest} alt="" />
        <div className="login-landscape-copy"><LockKeyhole size={28} /><h2>Cuidar da cidade começa com um olhar atento.</h2><p>Um espaço para a equipe analisar, revisar e preparar os resultados da arborização.</p><span>Imagem de floresta de referência</span></div>
      </aside>
      <GlassPanel interactive={false} className="login-panel">
        <header><h1 id="login-title">Acesso da equipe</h1><p>Entre com o usuário fornecido pela equipe do Arboriza.</p></header>
        <div className="login-demo-note" id="login-demo-note"><Info size={17} /><p><strong>Prévia do formulário.</strong> Use dados fictícios. O login real estará disponível após a integração.</p></div>
        <form onSubmit={submit} noValidate aria-describedby="login-demo-note">
          <div className="login-field"><label htmlFor="login-username">Usuário</label><div className="login-input-wrap" data-invalid={Boolean(errors.username)}><UserRound size={18} /><input ref={username} id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={100} placeholder="Seu usuário" required aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'login-username-error' : undefined} onInput={() => { setErrors((current) => { const { username: _removed, ...rest } = current; return rest }); setMessage('') }} /></div>{errors.username && <p className="login-field-error" id="login-username-error">{errors.username}</p>}</div>
          <div className="login-field"><label htmlFor="login-password">Senha</label><div className="login-input-wrap" data-invalid={Boolean(errors.password)}><LockKeyhole size={18} /><input ref={password} id="login-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" maxLength={256} placeholder="Sua senha" required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} onInput={() => { setErrors((current) => { const { password: _removed, ...rest } = current; return rest }); setMessage('') }} /><button type="button" className="login-password-toggle" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible} aria-controls="login-password" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{errors.password && <p className="login-field-error" id="login-password-error">{errors.password}</p>}</div>
          <Button type="submit" className="login-submit">Entrar <ArrowUpRight size={18} /></Button>
          <p className="login-feedback" role="status">{message}</p>
        </form>
        <p className="login-team-help">Os usuários são cadastrados internamente. Para obter acesso ou ajuda com sua senha, procure a equipe responsável.</p>
        <Link className="login-demo-link" to={paths.admin}>Visualizar portal demonstrativo <ArrowUpRight size={16} /></Link>
      </GlassPanel>
    </div>
  </section>
}
