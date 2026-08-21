const API_URL = '/api/v1'

// Eventos globales para cerrar sesión cuando la API devuelve 401 (token expirado/inválido).
// Se separa el cliente del staff para que cada área gestione su propia sesión.
export const AUTH_UNAUTHORIZED = 'auth:unauthorized'
export const STAFF_UNAUTHORIZED = 'auth:staff:unauthorized'

export class ApiError extends Error {
  status: number
  retryIn?: number
  constructor(status: number, message: string, retryIn?: number) {
    super(message)
    this.status = status
    this.retryIn = retryIn
  }
}

// Sesión de cliente (portal)
export function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('token', token)
  else localStorage.removeItem('token')
}

// Sesión de personal / admin (independiente de la del cliente)
export function getStaffToken(): string | null {
  return localStorage.getItem('staff_token')
}

export function setStaffToken(token: string | null): void {
  if (token) localStorage.setItem('staff_token', token)
  else localStorage.removeItem('staff_token')
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Error ${res.status}`
  let retryIn: number | undefined
  try {
    const body = await res.json()
    message = body.message || message
    if (typeof body.retry_in_seconds === 'number') retryIn = body.retry_in_seconds
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, message, retryIn)
}

interface RequestConfig {
  token?: string | null
  unauthorizedEvent?: string
}

async function request<T>(path: string, options: RequestInit, cfg: RequestConfig = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (!isForm) headers['Content-Type'] = 'application/json'
  const token = cfg.token ?? getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && cfg.unauthorizedEvent) {
    window.dispatchEvent(new CustomEvent(cfg.unauthorizedEvent))
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

// API para el área del cliente (usa el token del cliente).
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(path, options, { unauthorizedEvent: AUTH_UNAUTHORIZED })
}

// API para el panel interno / staff (usa el token propio del staff).
export async function apiStaff<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(path, options, {
    token: getStaffToken(),
    unauthorizedEvent: STAFF_UNAUTHORIZED,
  })
}

// Helper para descargas de blobs / PDF con autorización centralizada (cliente).
export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED))
  }
  if (!res.ok) {
    throw await parseError(res)
  }
  return res.blob()
}