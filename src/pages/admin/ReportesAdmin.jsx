import { useState } from 'react'
import { AppShell } from '../../components/AppShell'
import VentasTab from './reportes/VentasTab'
import CortesTab from './reportes/CortesTab'

const TABS = [
  { key: 'ventas', label: 'Ventas' },
  { key: 'cortes', label: 'Cortes de caja' },
]

export default function ReportesAdmin() {
  const [tab, setTab] = useState('ventas')

  return (
    <AppShell>
      <h2 className="mb-4 text-xl font-semibold text-navy">Reportes</h2>

      <div className="mb-6 flex gap-2 border-b border-navy/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium ' +
              (tab === t.key ? 'border-coral text-coral' : 'border-transparent text-navy/60 hover:text-navy')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ventas' && <VentasTab />}
      {tab === 'cortes' && <CortesTab />}
    </AppShell>
  )
}
