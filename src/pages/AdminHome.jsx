import { AppShell } from '../components/AppShell'

export default function AdminHome() {
  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-navy">Panel de administración</h2>
      <p className="mt-2 text-navy/70">
        Catálogo, inventario, cortes de caja y reportes llegarán en las siguientes fases.
      </p>
    </AppShell>
  )
}
