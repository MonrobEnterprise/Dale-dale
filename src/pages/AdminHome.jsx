import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'

const CARDS = [
  {
    to: '/admin/catalogo',
    title: 'Catálogo',
    description: 'Categorías, productos y variantes con precio y stock.',
  },
  {
    to: '/admin/inventario',
    title: 'Inventario',
    description: 'Registra entradas, salidas y ajustes de stock.',
  },
]

export default function AdminHome() {
  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-navy">Panel de administración</h2>
      <p className="mt-2 text-navy/70">
        Cortes de caja y reportes llegarán en las siguientes fases.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-2xl bg-white p-6 shadow-lg transition hover:brightness-95"
          >
            <h3 className="font-display text-lg font-bold text-navy">{card.title}</h3>
            <p className="mt-1 text-sm text-navy/70">{card.description}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
