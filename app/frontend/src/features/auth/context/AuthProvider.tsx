import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, clearToken, getExpiry, getToken, setToken } from '../services/api'
import { AuthContext } from './AuthContext'
import type { AuthState, User } from './AuthContext'

type LoginResponse = { access_token: string; expires_at: number; user: User }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => getToken() ? 'loading' : 'anonymous')
  const [user, setUser] = useState<User | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    function expired() { setUser(null); setState('anonymous') }
    window.addEventListener('arboriza:session-expired', expired)
    return () => window.removeEventListener('arboriza:session-expired', expired)
  }, [])
  useEffect(() => {
    if (!getToken()) return
    let cancelled = false
    api<User>('/auth/me').then((current) => {
      if (!cancelled) { setUser(current); setState('authenticated') }
    }).catch((error: unknown) => {
      if (!cancelled) {
        if (error instanceof ApiError && error.status === 401) { setUser(null); setState('anonymous') }
        else setState('offline')
      }
    })
    return () => { cancelled = true }
  }, [attempt])
  useEffect(() => {
    if (state !== 'authenticated') return
    const expires = getExpiry()
    if (!expires) return
    const timer = window.setTimeout(() => { clearToken(); setUser(null); setState('anonymous') }, Math.max(0, expires * 1000 - Date.now()))
    return () => window.clearTimeout(timer)
  }, [state])
  const login = useCallback(async (username: string, password: string) => {
    const response = await api<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, false)
    setToken(response.access_token, response.expires_at); setUser(response.user); setState('authenticated')
  }, [])
  const logout = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' })
    clearToken(); setUser(null); setState('anonymous')
  }, [])
  const retry = useCallback(() => { setState('loading'); setAttempt((value) => value + 1) }, [])
  return <AuthContext.Provider value={{ state, user, login, logout, retry }}>{children}</AuthContext.Provider>
}
