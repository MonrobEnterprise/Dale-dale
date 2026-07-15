import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../lib/errorMessages'
import { Modal } from '../../components/admin/Modal'
import { FormField } from '../../components/admin/FormField'

// Igual que el umbral de descuento "alto" en PuntoVenta: una diferencia de
// caja grande pide confirmación explícita para evitar cierres accidentales.
const UMBRAL_CONFIRMACION_PORCENTAJE = 0.1
const UMBRAL_CONFIRMACION_MINIMO = 50

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function CierreCaja({ open, onClose, corte, onCerrado }) {
  const [resumen, setResumen] = useState(null)
  const [loadingResumen, setLoadingResumen] = useState(true)
  const [efectivoContado, setEfectivoContado] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [cerrado, setCerrado] = useState(false)

  useEffect(() => {
    if (!open) return

    async function loadResumen() {
      setLoadingResumen(true)
      const { data } = await supabase
        .from('pagos')
        .select('metodo, monto, venta_id, ventas!inner(estado, corte_id)')
        .eq('ventas.corte_id', corte.id)
        .eq('ventas.estado', 'completada')

      const pagos = data ?? []
      const totales = { efectivo: 0, tarjeta: 0, transferencia: 0 }
      const ventasUnicas = new Set()
      for (const pago of pagos) {
        totales[pago.metodo] = (totales[pago.metodo] ?? 0) + Number(pago.monto)
        ventasUnicas.add(pago.venta_id)
      }

      setResumen({
        totalVentas: ventasUnicas.size,
        totalEfectivo: totales.efectivo,
        totalTarjeta: totales.tarjeta,
        totalTransferencia: totales.transferencia,
        efectivoEsperado: Number(corte.efectivo_inicial) + totales.efectivo,
      })
      setLoadingResumen(false)
    }
    loadResumen()
  }, [open, corte.id, corte.efectivo_inicial])

  const contadoNum = Number(efectivoContado)
  const contadoValido = efectivoContado !== '' && !Number.isNaN(contadoNum) && contadoNum >= 0
  const diferencia = resumen && contadoValido ? contadoNum - resumen.efectivoEsperado : null

  async function handleCerrar() {
    if (!resumen || !contadoValido) return
    setError(null)

    if (Math.abs(diferencia) > Math.max(resumen.efectivoEsperado * UMBRAL_CONFIRMACION_PORCENTAJE, UMBRAL_CONFIRMACION_MINIMO)) {
      const confirmado = window.confirm(
        `La diferencia de caja es de ${money(diferencia)}. ¿Confirmas que quieres cerrar la caja de todas formas?`,
      )
      if (!confirmado) return
    }

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase
        .from('cortes_caja')
        .update({
          estado: 'cerrada',
          fecha_cierre: new Date().toISOString(),
          efectivo_esperado: resumen.efectivoEsperado,
          efectivo_contado: contadoNum,
          diferencia,
          total_ventas: resumen.totalVentas,
          total_efectivo: resumen.totalEfectivo,
          total_tarjeta: resumen.totalTarjeta,
          total_transferencia: resumen.totalTransferencia,
        })
        .eq('id', corte.id)
      if (updateError) throw updateError
      setCerrado(true)
    } catch (err) {
      setError(friendlyError(err, 'No se pudo cerrar la caja. Intenta de nuevo.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cerrar caja">
      {cerrado ? (
        <div>
          <p className="mb-4 text-navy">La caja se cerró correctamente.</p>
          <button
            type="button"
            onClick={onCerrado}
            className="w-full rounded-lg bg-coral py-2 font-semibold text-white transition hover:brightness-95"
          >
            Listo
          </button>
        </div>
      ) : loadingResumen ? (
        <p className="text-navy/60">Calculando…</p>
      ) : (
        <div>
          <div className="mb-4 rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy/80">
            <p>Ventas del turno: {resumen.totalVentas}</p>
            <p>Efectivo: {money(resumen.totalEfectivo)}</p>
            <p>Tarjeta: {money(resumen.totalTarjeta)}</p>
            <p>Transferencia: {money(resumen.totalTransferencia)}</p>
            <p className="mt-1 font-medium text-navy">Efectivo esperado: {money(resumen.efectivoEsperado)}</p>
          </div>

          <FormField
            label="Efectivo contado"
            type="number"
            min="0"
            step="0.01"
            value={efectivoContado}
            onChange={(e) => setEfectivoContado(e.target.value)}
            placeholder="Cuenta el efectivo físico y captúralo aquí"
          />

          {contadoValido && (
            <p className={'mb-3 text-sm font-medium ' + (diferencia === 0 ? 'text-menta' : 'text-coral')}>
              Diferencia: {diferencia > 0 ? '+' : ''}
              {money(diferencia)} {diferencia > 0 ? '(sobra)' : diferencia < 0 ? '(falta)' : ''}
            </p>
          )}

          {error && <p className="mb-3 text-sm text-coral">{error}</p>}

          <button
            type="button"
            onClick={handleCerrar}
            disabled={!contadoValido || submitting}
            className="w-full rounded-lg bg-coral py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {submitting ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </div>
      )}
    </Modal>
  )
}
