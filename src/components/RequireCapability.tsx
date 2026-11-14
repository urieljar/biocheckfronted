import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { can, type Capability } from '../lib/permissions'

// Protege una pantalla completa: si el rol no tiene la capacidad pedida, vuelve al inicio.
export function RequireCapability({ capability }: { capability: Capability }) {
  const { user } = useAuth()

  if (!can(user?.role, capability)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
