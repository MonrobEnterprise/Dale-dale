import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { DataTable } from '../../../components/admin/DataTable'
import { Modal } from '../../../components/admin/Modal'

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

function fecha(iso) {
  return iso ? new Date(iso).toLocaleString('es-MX') : '—'
}

export default function CortesTab() {
  const [cortes, setCortes] = useState([])
  const [loading, setLoading] = useState(true)
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('cortes_caja')
        .select('*, perfiles(nombre)')
        .order('fecha_apertura', { ascending: false })
      setCortes(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const porEmpleado = useMemo(() => {
    const mapa = new Map()
    for (const corte of cortes) {
      if (corte.estado !== 'cerrada') continue
      const nombre = corte.perfiles?.nombre ?? 'Sin nombre'
      const actual = mapa.get(nombre) ?? { id: corte.usuario_id, nombre, turnos: 0, totalVentas: 0, diferencia: 0 }
      actual.turnos += 1
      actual.totalVentas += Number(corte.total_ventas ?? 0)
      actual.diferencia += Number(corte.diferencia ?? 0)
      mapa.set(nombre, actual)
    }
    return Array.from(mapa.values())
  }, [cortes])

  const columnsEmpleado = [
    { key: 'nombre', label: 'Empleado' },
    { key: 'turnos', label: 'Turnos cerrados' },
    { key: 'totalVentas', label: 'Total ventas', render: (row) => money(row.totalVentas) },
    {
      key: 'diferencia',
      label: 'Diferencia acumulada',
      render: (row) => (
        <span className={row.diferencia === 0 ? 'text-menta' : 'text-coral'}>{money(row.diferencia)}</span>
      ),
    },
  ]

  const columnsHistorico = [
    { key: 'empleado', label: 'Empleado', render: (row) => row.perfiles?.nombre ?? '—' },
    { key: 'apertura', label: 'Apertura', render: (row) => fecha(row.fecha_apertura) },
    { key: 'cierre', label: 'Cierre', render: (row) => fecha(row.fecha_cierre) },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => (
        <span
          className={
            'rounded-full px-2 py-0.5 text-xs font-medium ' +
            (row.estado === 'abierta' ? 'bg-dorado/20 text-dorado' : 'bg-navy/10 text-navy/60')
          }
        >
          {row.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
        </span>
      ),
    },
    { key: 'fondo', label: 'Fondo inicial', render: (row) => money(row.efectivo_inicial) },
    { key: 'total_ventas', label: 'Total ventas', render: (row) => (row.total_ventas != null ? money(row.total_ventas) : '—') },
    {
      key: 'diferencia',
      label: 'Diferencia',
      render: (row) =>
        row.diferencia != null ? (
          <span className={Number(row.diferencia) === 0 ? 'text-menta' : 'text-coral'}>{money(row.diferencia)}</span>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <div>
      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <>
          <h3 className="mb-3 font-semibold text-navy">Ventas y diferencias por empleado</h3>
          <div className="mb-8">
            <DataTable columns={columnsEmpleado} rows={porEmpleado} emptyMessage="Aún no hay turnos cerrados." />
          </div>

          <h3 className="mb-3 font-semibold text-navy">Histórico de cortes de caja</h3>
          <DataTable
            columns={columnsHistorico}
            rows={cortes}
            onRowClick={setDetalle}
            emptyMessage="Aún no hay cortes de caja registrados."
          />
        </>
      )}

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle del corte">
        {detalle && (
          <div className="space-y-1 text-sm text-navy/80">
            <p>Empleado: {detalle.perfiles?.nombre ?? '—'}</p>
            <p>Apertura: {fecha(detalle.fecha_apertura)}</p>
            <p>Cierre: {fecha(detalle.fecha_cierre)}</p>
            <p>Fondo inicial: {money(detalle.efectivo_inicial)}</p>
            {detalle.estado === 'cerrada' ? (
              <>
                <p>Total ventas: {detalle.total_ventas}</p>
                <p>Efectivo: {money(detalle.total_efectivo)}</p>
                <p>Tarjeta: {money(detalle.total_tarjeta)}</p>
                <p>Transferencia: {money(detalle.total_transferencia)}</p>
                <p>Efectivo esperado: {money(detalle.efectivo_esperado)}</p>
                <p>Efectivo contado: {money(detalle.efectivo_contado)}</p>
                <p className="font-medium text-navy">
                  Diferencia: {Number(detalle.diferencia) > 0 ? '+' : ''}
                  {money(detalle.diferencia)}
                </p>
              </>
            ) : (
              <p className="text-navy/60">Este corte sigue abierto; el resumen se calcula al cerrarlo.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
