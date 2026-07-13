import { useAuth } from '../contexts/AuthContext'

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
      <main className="p-6">{children}</main>
    </div>
  )
}
