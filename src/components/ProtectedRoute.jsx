import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ roles, children }) {
  const { session, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-crema text-navy">
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (perfil && !perfil.activo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-crema text-navy">
        Tu cuenta está desactivada. Contacta al administrador.
      </div>
    )
  }

  if (roles && perfil && !roles.includes(perfil.rol)) {
    return <Navigate to="/" replace />
  }

  return children
}
