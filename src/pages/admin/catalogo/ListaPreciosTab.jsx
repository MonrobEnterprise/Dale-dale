import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import logoPinata from '../../../assets/logo-pinata.png'

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

function descripcionVariante(v) {
  return [v.tamano, v.color, v.tema].filter(Boolean).join(' · ')
}

export default function ListaPreciosTab() {
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [catRes, prodRes, varRes] = await Promise.all([
        supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('productos').select('id, categoria_id, nombre').eq('activo', true).order('nombre'),
        supabase
          .from('variantes')
          .select('id, producto_id, tamano, color, tema, precio')
          .eq('activo', true)
          .order('id'),
      ])

      const productos = prodRes.data ?? []
      const variantes = varRes.data ?? []

      const armado = (catRes.data ?? [])
        .map((cat) => {
          const productosDeCategoria = productos
            .filter((p) => p.categoria_id === cat.id)
            .map((p) => ({
              ...p,
              variantes: variantes.filter((v) => v.producto_id === p.id),
            }))
            .filter((p) => p.variantes.length > 0)
          return { ...cat, productos: productosDeCategoria }
        })
        .filter((cat) => cat.productos.length > 0)

      setCategorias(armado)
      setLoading(false)
    }
    load()
  }, [])

  const fechaGeneracion = useMemo(
    () => new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  )

  const totalVariantes = categorias.reduce(
    (sum, cat) => sum + cat.productos.reduce((s, p) => s + p.variantes.length, 0),
    0,
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/70">
          {loading
            ? 'Cargando catálogo…'
            : `${totalVariantes} productos activos, agrupados por categoría, con fecha de generación ${fechaGeneracion}.`}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={loading || totalVariantes === 0}
          className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95 disabled:opacity-40"
        >
          Descargar / Imprimir PDF
        </button>
      </div>

      {!loading && totalVariantes === 0 && (
        <p className="text-navy/60">No hay productos activos con variantes para incluir en la lista.</p>
      )}

      {/* Vista en pantalla: mismo contenido que se imprime, para previsualizar
          antes de generar el PDF. El documento imprimible real está más
          abajo (.price-list-print), oculto en pantalla vía @media print. */}
      {!loading && totalVariantes > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <ListaPreciosDocumento categorias={categorias} fechaGeneracion={fechaGeneracion} modo="pantalla" />
        </div>
      )}

      <div className="price-list-print">
        <ListaPreciosDocumento categorias={categorias} fechaGeneracion={fechaGeneracion} modo="impresion" />
      </div>
    </div>
  )
}

function ListaPreciosDocumento({ categorias, fechaGeneracion, modo }) {
  return (
    <div className={modo === 'impresion' ? 'bg-white p-8 text-navy' : 'p-8 text-navy'}>
      <div className="mb-6 flex items-center gap-4 rounded-xl bg-navy px-6 py-4">
        <img src={logoPinata} alt="" className="h-14 w-auto" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">¡Dale, dale!!</h1>
          <p className="text-sm text-white/80">Lista de precios · {fechaGeneracion}</p>
        </div>
      </div>

      {categorias.map((cat) => (
        <div key={cat.id} className="mb-6 break-inside-avoid-page">
          <h2 className="mb-2 border-b-2 border-coral pb-1 font-display text-lg font-bold text-navy">
            {cat.nombre}
          </h2>
          {cat.productos.map((p) => (
            <div key={p.id} className="mb-3 break-inside-avoid-page">
              <p className="font-semibold text-navy">{p.nombre}</p>
              <ul>
                {p.variantes.map((v) => {
                  const desc = descripcionVariante(v)
                  return (
                    <li
                      key={v.id}
                      className="flex items-baseline justify-between border-b border-dorado/20 py-1 text-sm"
                    >
                      <span className="text-navy/70">{desc || '—'}</span>
                      <span className="font-semibold text-navy">{money(v.precio)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}

      <p className="mt-8 text-center font-display text-sm text-navy/60">¡No pierdas el tino!</p>
    </div>
  )
}
