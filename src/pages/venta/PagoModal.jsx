import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../lib/errorMessages'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../../components/admin/Modal'
import { FormField } from '../../components/admin/FormField'
import Ticket from './Ticket'

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function PagoModal({ open, onClose, total, subtotal, descuento, carrito, corteId, onSuccess }) {
  const { perfil } = useAuth()
  const [tarjeta, setTarjeta] = useState('0')
  const [transferencia, setTransferencia] = useState('0')
  const [efectivoRecibido, setEfectivoRecibido] = useState('0')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [folio, setFolio] = useState(null)
  const [fechaVenta, setFechaVenta] = useState(null)

  const tarjetaNum = Number(tarjeta) || 0
  const transferenciaNum = Number(transferencia) || 0
  const efectivoRecibidoNum = Number(efectivoRecibido) || 0

  const efectivoAdeudado = Math.max(total - tarjetaNum - transferenciaNum, 0)
  const efectivoAplicado = Math.min(efectivoRecibidoNum, efectivoAdeudado)
  const cambio = Math.max(efectivoRecibidoNum - efectivoAdeudado, 0)
  const pagado = efectivoAplicado + tarjetaNum + transferenciaNum
  const puedeConfirmar = Math.abs(pagado - total) < 0.005

  function pagarTodoEnEfectivo() {
    setTarjeta('0')
    setTransferencia('0')
    setEfectivoRecibido(total.toFixed(2))
  }

  async function handleConfirmar() {
    setError(null)
    setSubmitting(true)
    try {
      const p_detalle = carrito.map((item) => ({
        variante_id: item.variante_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
      }))
      const p_pagos = []
      if (efectivoAplicado > 0) p_pagos.push({ metodo: 'efectivo', monto: Number(efectivoAplicado.toFixed(2)) })
      if (tarjetaNum > 0) p_pagos.push({ metodo: 'tarjeta', monto: tarjetaNum })
      if (transferenciaNum > 0) p_pagos.push({ metodo: 'transferencia', monto: transferenciaNum })

      const { data, error: rpcError } = await supabase.rpc('registrar_venta', {
        p_corte_id: corteId,
        p_descuento: descuento,
        p_detalle,
        p_pagos,
      })
      if (rpcError) throw rpcError
      setFolio(data?.[0]?.folio ?? null)
      setFechaVenta(new Date())
    } catch (err) {
      setError(friendlyError(err, 'No se pudo completar la venta. Verifica los datos e intenta de nuevo.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cobrar">
      {folio ? (
        <div>
          <p className="mb-4 text-navy">
            Venta registrada con folio <span className="font-semibold">{folio}</span>.
          </p>

          <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-navy/10 bg-navy/5 p-3">
            <Ticket
              folio={folio}
              fecha={fechaVenta?.toLocaleString('es-MX')}
              cajero={perfil?.nombre ?? '—'}
              carrito={carrito}
              subtotal={subtotal}
              descuento={descuento}
              total={total}
              pagos={{ efectivo: efectivoAplicado, tarjeta: tarjetaNum, transferencia: transferenciaNum, cambio }}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 rounded-lg bg-navy/10 py-2 font-medium text-navy hover:bg-navy/20"
            >
              Imprimir ticket
            </button>
            <button
              type="button"
              onClick={() => onSuccess(folio)}
              className="flex-1 rounded-lg bg-coral py-2 font-semibold text-white transition hover:brightness-95"
            >
              Nueva venta
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-lg font-bold text-navy">Total a pagar: {money(total)}</p>

          <div className="grid grid-cols-2 gap-x-4">
            <FormField
              label="Tarjeta"
              type="number"
              min="0"
              step="0.01"
              value={tarjeta}
              onChange={(e) => setTarjeta(e.target.value)}
            />
            <FormField
              label="Transferencia"
              type="number"
              min="0"
              step="0.01"
              value={transferencia}
              onChange={(e) => setTransferencia(e.target.value)}
            />
          </div>

          <FormField
            label="Efectivo recibido"
            type="number"
            min="0"
            step="0.01"
            value={efectivoRecibido}
            onChange={(e) => setEfectivoRecibido(e.target.value)}
          />
          <button
            type="button"
            onClick={pagarTodoEnEfectivo}
            className="mb-3 text-sm text-navy/70 hover:underline"
          >
            Pagar todo en efectivo
          </button>

          <div className="mb-3 rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy/80">
            <p>Efectivo aplicado a la venta: {money(efectivoAplicado)}</p>
            <p>Cambio: {money(cambio)}</p>
            <p className="font-medium text-navy">
              Pagado: {money(pagado)} de {money(total)}
            </p>
          </div>

          {error && <p className="mb-3 text-sm text-coral">{error}</p>}

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!puedeConfirmar || submitting}
            className="w-full rounded-lg bg-coral py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
          >
            {submitting ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </div>
      )}
    </Modal>
  )
}
