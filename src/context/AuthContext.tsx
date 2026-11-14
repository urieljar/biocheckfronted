/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextType {
  token: string | null
  user: AuthUser | null
  login: (token: string, user?: AuthUser) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('user')
    if (!saved) return null
    try {
      return JSON.parse(saved)
    } catch {
      return null
    }
  })

  const login = (newToken: string, newUser?: AuthUser) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser))
      setUser(newUser)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  // El rol y el nombre se refrescan desde el servidor: si un administrador cambia
  // permisos o desactiva la cuenta, el panel lo refleja sin esperar a un nuevo login.
  useEffect(() => {
    if (!token) return

    let ignore = false

    api
      .get<{ ok: boolean; data: AuthUser }>('/auth/me')
      .then((res) => {
        if (ignore) return
        localStorage.setItem('user', JSON.stringify(res.data))
        setUser(res.data)
      })
      .catch((error: unknown) => {
        if (ignore) return
        // Solo una sesión inválida cierra sesión; un fallo de red no.
        if ((error as { status?: number })?.status === 401) logout()
      })

    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
