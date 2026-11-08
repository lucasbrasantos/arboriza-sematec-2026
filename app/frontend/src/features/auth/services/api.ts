const TOKEN_KEY = 'arboriza.session'
const EXPIRY_KEY = 'arboriza.session.expires'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export function getToken() { return sessionStorage.getItem(TOKEN_KEY) }
export function getExpiry() { const value = Number(sessionStorage.getItem(EXPIRY_KEY)); return Number.isFinite(value) && value > 0 ? value : null }
export function setToken(token: string, expiresAt: number) { sessionStorage.setItem(TOKEN_KEY, token); sessionStorage.setItem(EXPIRY_KEY, String(expiresAt)) }
export function clearToken() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(EXPIRY_KEY) }

export async function api<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (authenticated && token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`/api${path}`, { ...options, headers }) }
  catch { throw new ApiError(0, 'Não foi possível conectar ao servidor. Confira se o backend está em execução.') }
  if (!response.ok) {
    if (response.status === 401 && authenticated) { clearToken(); window.dispatchEvent(new Event('arboriza:session-expired')) }
    if ([502, 503, 504].includes(response.status)) throw new ApiError(response.status, 'O servidor está indisponível. Confira se o backend está em execução e tente novamente.')
    const body: unknown = await response.json().catch(() => null)
    const detail = typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string' ? body.detail : response.status >= 500 ? 'Não foi possível acessar o servidor. Confira se o backend está em execução e tente novamente.' : 'Não foi possível concluir a operação.'
    throw new ApiError(response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
