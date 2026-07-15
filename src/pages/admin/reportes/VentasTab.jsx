import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../../lib/supabaseClient'
import { varianteLabel } from '../../../lib/varianteLabel'
import { rangoDesde, bucketKey, bucketLabel } from '../../../lib/dateBuckets'
import { DataTable } from '../../../components/admin/DataTable'

const GRANULARIDADES = [
  { key: 'dia', label: 'Día' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
]

// Colores "chart-safe": misma familia que el brand (coral/dorado/menta) pero
// con dorado oscurecido y menta más saturada, porque la tríada original falla
// el validador de la skill de dataviz (lightness/chroma/contraste).
const COLOR_METODO = {
  efectivo: '#F26A5C',
  tarjeta: '#D99B1F',
  transferencia: '#12967D',
}

const LABEL_METODO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function VentasTab() {
  const [granularidad, setGranularidad] = useState('dia')
  const [ventas, setVentas] = useState([])
  const [pagos, setPagos] = useState([])
  const [topProductos, setTopProductos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const desde = rangoDesde(granularidad).toISOString()

      const [ventasRes, pagosRes, detalleRes] = await Promise.all([
        supabase
          .from('ventas')
          .select('created_at, total')
          .eq('estado', 'completada')
          .gte('created_at', desde),
        supabase
          .from('pagos')
          .select('metodo, monto, ventas!inner(estado, created_at)')
          .eq('ventas.estado', 'completada')
          .gte('ventas.created_at', desde),
        supabase
          .from('venta_detalle')
          .select('cantidad, variante_id, ventas!inner(estado, created_at), variantes(sku, tamano, color, tema, productos(nombre))')
          .eq('ventas.estado', 'completada')
          .gte('ventas.created_at', desde),
      ])

      setVentas(ventasRes.data ?? [])
      setPagos(pagosRes.data ?? [])

      const porVariante = new Map()
      for (const fila of detalleRes.data ?? []) {
        const actual = porVariante.get(fila.variante_id) ?? { cantidad: 0, variante: fila.variantes }
        actual.cantidad += fila.cantidad
        porVariante.set(fila.variante_id, actual)
      }
      const top = Array.from(porVariante.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10)
        .map((v) => ({ label: varianteLabel(v.variante ?? {}), cantidad: v.cantidad }))
      setTopProductos(top)

      setLoading(false)
    }
    load()
  }, [granularidad])

  const porBucket = useMemo(() => {
    const mapa = new Map()
    for (const venta of ventas) {
      const key = bucketKey(venta.created_at, granularidad)
      mapa.set(key, (mapa.get(key) ?? 0) + Number(venta.total))
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, total]) => ({ key, label: bucketLabel(key, granularidad), total }))
  }, [ventas, granularidad])

  const totalesPorMetodo = useMemo(() => {
    const totales = { efectivo: 0, tarjeta: 0, transferencia: 0 }
    for (const pago of pagos) {
      totales[pago.metodo] = (totales[pago.metodo] ?? 0) + Number(pago.monto)
    }
    return totales
  }, [pagos])

  const granularidadLabel = GRANULARIDADES.find((g) => g.key === granularidad).label.toLowerCase()

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {GRANULARIDADES.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGranularidad(g.key)}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-medium ' +
              (granularidad === g.key ? 'bg-coral text-white' : 'bg-navy/5 text-navy/70 hover:bg-navy/10')
            }
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['efectivo', 'tarjeta', 'transferencia'].map((metodo) => (
              <div key={metodo} className="rounded-2xl bg-white p-4 shadow-lg">
                <div className="mb-1 flex items-center gap-2 text-sm text-navy/70">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_METODO[metodo] }} />
                  {LABEL_METODO[metodo]}
                </div>
                <p className="text-xl font-bold text-navy">{money(totalesPorMetodo[metodo])}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-semibold text-navy">Ventas por {granularidadLabel}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porBucket}>
                  <CartesianGrid vertical={false} stroke="#14315C" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#14315C' }}
                    axisLine={{ stroke: '#14315C', strokeOpacity: 0.1 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#14315C' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip formatter={(value) => money(value)} contentStyle={{ borderRadius: 8, borderColor: '#14315C22' }} />
                  <Bar dataKey="total" fill="#F26A5C" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: 'label', label: 'Periodo' },
                  { key: 'total', label: 'Total', render: (row) => money(row.total) },
                ]}
                rows={porBucket}
                emptyMessage="No hay ventas en este rango."
              />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-semibold text-navy">Productos más vendidos</h3>
            {topProductos.length === 0 ? (
              <p className="text-sm text-navy/60">No hay ventas en este rango.</p>
            ) : (
              <div style={{ height: Math.max(topProductos.length * 36, 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductos} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} stroke="#14315C" strokeOpacity={0.1} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: '#14315C' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={220}
                      tick={{ fontSize: 12, fill: '#14315C' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#14315C22' }} />
                    <Bar dataKey="cantidad" fill="#F26A5C" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
