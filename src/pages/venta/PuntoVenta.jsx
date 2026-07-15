import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { varianteLabel } from '../../lib/varianteLabel'
import { FormField } from '../../components/admin/FormField'
import { DataTable } from '../../components/admin/DataTable'
import PagoModal from './PagoModal'
import CierreCaja from './CierreCaja'

// Un descuento por encima de este porcentaje del subtotal exige confirmación
// explícita antes de aplicarse, por si se capturó un valor por error.
const UMBRAL_CONFIRMACION_DESCUENTO = 0.2

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function PuntoVenta({ corte, onCerrarCaja }) {
  const [variantes, setVariantes] = useState([])
  const [search, setSearch] = useState('')
  const [carrito, setCarrito] = useState([])

  const [descuentoTipo, setDescuentoTipo] = useState('monto')
  const [descuentoValor, setDescuentoValor] = useState('')
  const [descuentoAplicado, setDescuentoAplicado] = useState(0)

  const [pagoAbierto, setPagoAbierto] = useState(false)
  const [cierreAbierto, setCierreAbierto] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(null)

  async function loadVariantes() {
    const { data } = await supabase
      .from('variantes')
      .select('id, sku, tamano, color, tema, precio, stock, productos!inner(nombre)')
      .eq('activo', true)
      .eq('productos.activo', true)
      .order('id')
    setVariantes(data ?? [])
  }

  useEffect(() => {
    loadVariantes()
  }, [])

  const resultados = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return variantes.filter((v) => varianteLabel(v).toLowerCase().includes(q)).slice(0, 8)
  }, [search, variantes])

  function agregarAlCarrito(v) {
    if (v.stock <= 0) return
    setCarrito((prev) => {
      const existente = prev.find((item) => item.variante_id === v.id)
      if (existente) {
        if (existente.cantidad >= v.stock) return prev
        return prev.map((item) =>
          item.variante_id === v.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        )
      }
      return [
        ...prev,
        { variante_id: v.id, label: varianteLabel(v), precio: Number(v.precio), cantidad: 1, stock: v.stock },
      ]
    })
    setSearch('')
  }

  function cambiarCantidad(varianteId, delta) {
    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.variante_id !== varianteId) return item
          const cantidad = Math.min(item.stock, Math.max(0, item.cantidad + delta))
          return { ...item, cantidad }
        })
        .filter((item) => item.cantidad > 0),
    )
  }

  function quitarLinea(varianteId) {
    setCarrito((prev) => prev.filter((item) => item.variante_id !== varianteId))
  }

  const subtotal = useMemo(
    () => carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
    [carrito],
  )
  const total = Math.max(subtotal - descuentoAplicado, 0)

  function aplicarDescuento() {
    const valor = Number(descuentoValor)
    if (descuentoValor === '' || Number.isNaN(valor) || valor < 0) return

    const monto = descuentoTipo === 'porcentaje' ? subtotal * (valor / 100) : valor
    const montoClamp = Math.min(Math.max(monto, 0), subtotal)

    if (montoClamp > subtotal * UMBRAL_CONFIRMACION_DESCUENTO) {
      const confirmado = window.confirm(
        `¿Confirmas un descuento de ${money(montoClamp)} sobre un subtotal de ${money(subtotal)}?`,
      )
      if (!confirmado) return
    }
    setDescuentoAplicado(montoClamp)
  }

  function quitarDescuento() {
    setDescuentoAplicado(0)
    setDescuentoValor('')
  }

  function handleVentaExitosa(folio) {
    setMensajeExito(folio)
    setCarrito([])
    quitarDescuento()
    setPagoAbierto(false)
    loadVariantes()
  }

  const columns = [
    { key: 'label', label: 'Producto' },
    {
      key: 'cantidad',
      label: 'Cantidad',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiarCantidad(row.variante_id, -1)}
            className="h-6 w-6 rounded bg-navy/10 text-navy hover:bg-navy/20"
          >
            −
          </button>
          <span className="w-6 text-center">{row.cantidad}</span>
          <button
            type="button"
            onClick={() => cambiarCantidad(row.variante_id, 1)}
            disabled={row.cantidad >= row.stock}
            className="h-6 w-6 rounded bg-navy/10 text-navy hover:bg-navy/20 disabled:opacity-40"
          >
            +
          </button>
        </div>
      ),
    },
    { key: 'precio', label: 'Precio', render: (row) => money(row.precio) },
    { key: 'subtotal', label: 'Subtotal', render: (row) => money(row.precio * row.cantidad) },
    {
      key: 'acciones',
      label: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => quitarLinea(row.variante_id)}
          className="text-sm text-coral hover:underline"
        >
          Quitar
        </button>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-navy">Punto de venta</h2>
          <p className="text-sm text-navy/70">
            Caja abierta desde {new Date(corte.fecha_apertura).toLocaleString('es-MX')} · fondo inicial{' '}
            {money(corte.efectivo_inicial)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCierreAbierto(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy/70 hover:bg-navy/5"
        >
          Cerrar caja
        </button>
      </div>

      {mensajeExito && (
        <div className="mb-4 rounded-lg bg-menta/20 px-4 py-3 text-sm font-medium text-navy">
          Venta registrada con folio {mensajeExito}.
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <FormField
          label="Buscar producto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Busca por producto, SKU, tamaño, color o tema…"
        />
        {resultados.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-navy/10 bg-white shadow-lg">
            {resultados.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={v.stock <= 0}
                  onClick={() => agregarAlCarrito(v)}
                  className={
                    'block w-full px-3 py-2 text-left text-sm ' +
                    (v.stock <= 0 ? 'cursor-not-allowed text-navy/30' : 'hover:bg-coral/5')
                  }
                >
                  {varianteLabel(v)} · stock: {v.stock} · {money(v.precio)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DataTable columns={columns} rows={carrito} emptyMessage="El carrito está vacío. Busca un producto para agregarlo." />

      <div className="mt-6 flex flex-col items-end gap-2">
        <div className="flex items-end gap-3">
          <FormField
            label="Descuento"
            type="select"
            value={descuentoTipo}
            onChange={(e) => setDescuentoTipo(e.target.value)}
          >
            <option value="monto">$ Monto</option>
            <option value="porcentaje">% Porcentaje</option>
          </FormField>
          <FormField
            label="Valor"
            type="number"
            min="0"
            step="0.01"
            value={descuentoValor}
            onChange={(e) => setDescuentoValor(e.target.value)}
          />
          <button
            type="button"
            onClick={aplicarDescuento}
            disabled={carrito.length === 0}
            className="mb-3 rounded-lg bg-navy/10 px-3 py-2 text-sm font-medium text-navy hover:bg-navy/20 disabled:opacity-40"
          >
            Aplicar
          </button>
          {descuentoAplicado > 0 && (
            <button
              type="button"
              onClick={quitarDescuento}
              className="mb-3 text-sm text-coral hover:underline"
            >
              Quitar descuento
            </button>
          )}
        </div>

        <div className="w-full max-w-xs text-right text-sm text-navy/70">
          <p>Subtotal: {money(subtotal)}</p>
          {descuentoAplicado > 0 && <p>Descuento: −{money(descuentoAplicado)}</p>}
          <p className="text-lg font-bold text-navy">Total: {money(total)}</p>
        </div>

        <button
          type="button"
          onClick={() => setPagoAbierto(true)}
          disabled={carrito.length === 0}
          className="rounded-lg bg-coral px-6 py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
        >
          Cobrar
        </button>
      </div>

      {pagoAbierto && (
        <PagoModal
          open={pagoAbierto}
          onClose={() => setPagoAbierto(false)}
          total={total}
          subtotal={subtotal}
          descuento={descuentoAplicado}
          carrito={carrito}
          corteId={corte.id}
          onSuccess={handleVentaExitosa}
        />
      )}

      {cierreAbierto && (
        <CierreCaja
          open={cierreAbierto}
          onClose={() => setCierreAbierto(false)}
          corte={corte}
          onCerrado={onCerrarCaja}
        />
      )}
    </div>
  )
}
