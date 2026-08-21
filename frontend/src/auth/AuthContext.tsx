import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AUTH_UNAUTHORIZED, api, getToken, setToken } from '../lib/api'
import type { AuthResponse, User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: {
    name: string
    email: string
    phone?: string
    password: string
  }) => Promise<void>
  refreshUser: () => Promise<User | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const data = await api<User>('/user')
        setUser(data)
      } catch {
        setToken(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  // Cierra la sesión cuando la API notifica que el token ya no es válido (401)
  useEffect(() => {
    function onUnauthorized() {
      setToken(null)
      setUser(null)
    }
    window.addEventListener(AUTH_UNAUTHORIZED, onUnauthorized)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED, onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(
    async (payload: { name: string; email: string; phone?: string; password: string }) => {
      const data = await api<AuthResponse>('/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setToken(data.token)
      setUser(data.user)
    },
    [],
  )

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<User>('/user')
      setUser(data)
      return data
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}