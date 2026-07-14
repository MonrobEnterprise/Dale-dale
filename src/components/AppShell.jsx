import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ADMIN_LINKS = [
  { to: '/admin', label: 'Panel', end: true },
  { to: '/admin/catalogo', label: 'Catálogo' },
  { to: '/admin/inventario', label: 'Inventario' },
]

export function AppShell({ children }) {
  const { perfil, logout } = useAuth()

  return (
    <div className="min-h-screen bg-crema">
      <header className="flex items-center justify-between bg-navy px-6 py-4 text-white">
        <h1 className="text-lg font-bold">¡Dale, dale!!</h1>
        <div className="flex items-center gap-4 text-sm">
          {perfil && (
            <span>
              {perfil.nombre} · <span className="capitalize">{perfil.rol}</span>
            </span>
          )}
          <button
            onClick={logout}
            className="rounded-lg bg-coral px-3 py-1.5 font-medium transition hover:brightness-95"
          >
            Salir
          </button>
        </div>
      </header>
      {perfil?.rol === 'admin' && (
        <nav className="flex gap-4 border-b border-navy/10 bg-white px-6 py-2 text-sm">
          {ADMIN_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                'font-medium ' + (isActive ? 'text-coral' : 'text-navy/60 hover:text-navy')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="p-6">{children}</main>
    </div>
  )
}
