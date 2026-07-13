import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminHome from './pages/AdminHome'
import CajeroHome from './pages/CajeroHome'

function RoleRedirect() {
  const { perfil, loading } = useAuth()

  if (loading) return null
  if (perfil?.rol === 'admin') return <Navigate to="/admin" replace />
  if (perfil?.rol === 'cajero') return <Navigate to="/venta" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/venta"
            element={
              <ProtectedRoute roles={['cajero', 'admin']}>
                <CajeroHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRedirect />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
