import { createContext, useContext } from 'react'

export type User = { id: number; username: string; role: 'admin' | 'operator' }
export type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'offline'
export type AuthContextValue = {
  state: AuthState
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider ausente')
  return value
}
