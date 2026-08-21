import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { STAFF_UNAUTHORIZED, apiStaff, getStaffToken, setStaffToken } from '../lib/api'
import type { AuthResponse, User } from '../lib/types'

interface StaffAuthData {
  user: User
  token?: string
}

interface StaffAuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  updateProfile: (data: {
    name?: string
    email?: string
    phone?: string
    password?: string
    current_password?: string
  }) => Promise<User>
}

const StaffAuthContext = createContext<StaffAuthContextValue | null>(null)

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      if (!getStaffToken()) {
        setLoading(false)
        return
      }
      try {
        const data = await apiStaff<User>('/user')
        setUser(data)
      } catch {
        setStaffToken(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  // Cierra la sesión del staff cuando la API nota que el token ya no es válido (401)
  useEffect(() => {
    function onUnauthorized() {
      setStaffToken(null)
      setUser(null)
    }
    window.addEventListener(STAFF_UNAUTHORIZED, onUnauthorized)
    return () => window.removeEventListener(STAFF_UNAUTHORIZED, onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiStaff<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setStaffToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiStaff('/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setStaffToken(null)
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (data: {
      name?: string
      email?: string
      phone?: string
      password?: string
      current_password?: string
    }) => {
      const res = await apiStaff<StaffAuthData>('/user', {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      if (res.token) setStaffToken(res.token)
      setUser(res.user)
      return res.user
    },
    [],
  )

  return (
    <StaffAuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </StaffAuthContext.Provider>
  )
}

export function useStaffAuth(): StaffAuthContextValue {
  const ctx = useContext(StaffAuthContext)
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider')
  return ctx
}