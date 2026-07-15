import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminHome from './pages/AdminHome'
import CajeroHome from './pages/CajeroHome'
import CatalogoAdmin from './pages/admin/CatalogoAdmin'
import InventarioAdmin from './pages/admin/InventarioAdmin'
import ReportesAdmin from './pages/admin/ReportesAdmin'
import UsuariosAdmin from './pages/admin/UsuariosAdmin'

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
            path="/admin/catalogo"
            element={
              <ProtectedRoute roles={['admin']}>
                <CatalogoAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/inventario"
            element={
              <ProtectedRoute roles={['admin']}>
                <InventarioAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reportes"
            element={
              <ProtectedRoute roles={['admin']}>
                <ReportesAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute roles={['admin']}>
                <UsuariosAdmin />
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
