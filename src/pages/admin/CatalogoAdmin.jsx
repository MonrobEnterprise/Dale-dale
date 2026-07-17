import { useState } from 'react'
import { AppShell } from '../../components/AppShell'
import CategoriasTab from './catalogo/CategoriasTab'
import ProductosTab from './catalogo/ProductosTab'
import VariantesTab from './catalogo/VariantesTab'
import ImportarExcelTab from './catalogo/ImportarExcelTab'
import ListaPreciosTab from './catalogo/ListaPreciosTab'

const TABS = [
  { key: 'categorias', label: 'Categorías' },
  { key: 'productos', label: 'Productos' },
  { key: 'variantes', label: 'Variantes' },
  { key: 'importar', label: 'Importar Excel' },
  { key: 'precios', label: 'Lista de precios' },
]

export default function CatalogoAdmin() {
  const [tab, setTab] = useState('categorias')

  return (
    <AppShell>
      <h2 className="mb-4 text-xl font-semibold text-navy">Catálogo</h2>

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

      {tab === 'categorias' && <CategoriasTab />}
      {tab === 'productos' && <ProductosTab />}
      {tab === 'variantes' && <VariantesTab />}
      {tab === 'importar' && <ImportarExcelTab />}
      {tab === 'precios' && <ListaPreciosTab />}
    </AppShell>
  )
}
