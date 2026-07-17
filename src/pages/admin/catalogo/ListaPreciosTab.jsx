import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import logoPinata from '../../../assets/logo-pinata.png'

// Datos institucionales fijos (de la lona y la campaña de ubicación) — no
// viven en el catálogo, así que se capturan aquí directo.
const CONTACTO = {
  telefono: '246 174 9245',
  facebook: 'Dale, dale!!',
  instagram: 'Dale, dale!!',
  direccion: 'Gasoducto S/N, casi esq. Blvd. Ocotlán, Col. Miraflores, Tlaxcala',
  slogan: '¡No pierdas el tino…!',
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

function descripcionVariante(v) {
  return [v.tamano, v.color, v.tema].filter(Boolean).join(' · ')
}

export default function ListaPreciosTab() {
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState([])

  async function cargarLista() {
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

  useEffect(() => {
    cargarLista()
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cargarLista}
            disabled={loading}
            className="rounded-lg bg-navy/10 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/20 disabled:opacity-40"
          >
            {loading ? 'Actualizando…' : 'Actualizar lista'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || totalVariantes === 0}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-40"
          >
            Descargar / Imprimir PDF
          </button>
        </div>
      </div>

      {!loading && totalVariantes === 0 && (
        <p className="text-navy/60">No hay productos activos con variantes para incluir en la lista.</p>
      )}

      {/* Vista en pantalla: mismo documento que se imprime, para previsualizar
          antes de generar el PDF. El documento imprimible real está más
          abajo (.price-list-print), oculto en pantalla (display:none). */}
      {!loading && totalVariantes > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <ListaPreciosDocumento categorias={categorias} fechaGeneracion={fechaGeneracion} />
        </div>
      )}

      <div className="price-list-print">
        <ListaPreciosDocumento categorias={categorias} fechaGeneracion={fechaGeneracion} />
      </div>
    </div>
  )
}

function Encabezado({ fechaGeneracion }) {
  return (
    <div className="flex items-center justify-between bg-navy px-6 py-4 text-white">
      <div className="flex items-center gap-2">
        <img src={logoPinata} alt="" className="h-9 w-auto" />
        <h1 className="text-lg font-bold">¡Dale, dale!!</h1>
      </div>
      <div className="text-sm text-white/80">Lista de precios · {fechaGeneracion}</div>
    </div>
  )
}

function PieDePagina() {
  return (
    <div className="bg-navy px-6 py-2 text-white">
      <p className="text-center text-[11px] text-white/90">{CONTACTO.direccion}</p>
      <p className="text-center text-[11px] text-white/90">
        Tel. / WhatsApp: {CONTACTO.telefono} · Facebook: {CONTACTO.facebook} · Instagram: {CONTACTO.instagram}
      </p>
      <p className="text-center font-display text-xs font-semibold text-coral">{CONTACTO.slogan}</p>
    </div>
  )
}

// Documento como <table> con <thead>/<tfoot>: es el único mecanismo que
// Chrome repite de forma confiable en cada hoja impresa cuando el
// contenido ocupa varias páginas (ver comentario en index.css). Se usa
// tanto para la vista previa en pantalla como para el documento imprimible
// — en pantalla simplemente se ve como una tabla normal, sin repetirse.
function ListaPreciosDocumento({ categorias, fechaGeneracion }) {
  return (
    <table className="w-full border-collapse bg-white text-navy">
      <thead>
        <tr>
          <td colSpan={2} className="p-0">
            <Encabezado fechaGeneracion={fechaGeneracion} />
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td colSpan={2} className="p-0">
            <PieDePagina />
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td colSpan={2} className="h-4" />
        </tr>
        {categorias.map((cat) => (
          <Fragment key={cat.id}>
            <tr>
              <td
                colSpan={2}
                className="border-b-2 border-coral px-8 pb-1 pt-4 font-display text-lg font-bold text-navy"
              >
                {cat.nombre}
              </td>
            </tr>
            {cat.productos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td colSpan={2} className="px-8 pt-3 font-semibold text-navy">
                    {p.nombre}
                  </td>
                </tr>
                {p.variantes.map((v) => {
                  const desc = descripcionVariante(v)
                  return (
                    <tr key={v.id}>
                      <td className="border-b border-dorado/20 py-1 pl-8 pr-2 text-sm text-navy/70">
                        {desc || '—'}
                      </td>
                      <td className="border-b border-dorado/20 py-1 pr-8 pl-2 text-right text-sm font-semibold text-navy">
                        {money(v.precio)}
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}
