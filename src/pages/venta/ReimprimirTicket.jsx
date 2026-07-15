import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { varianteLabel } from '../../lib/varianteLabel'
import { friendlyError } from '../../lib/errorMessages'
import { Modal } from '../../components/admin/Modal'
import { FormField } from '../../components/admin/FormField'
import Ticket from './Ticket'

export default function ReimprimirTicket({ open, onClose }) {
  const [folio, setFolio] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [ticketData, setTicketData] = useState(null)

  async function buscar(e) {
    e.preventDefault()
    setError(null)
    setTicketData(null)
    const folioBuscado = folio.trim().toUpperCase()
    if (!folioBuscado) return

    setBuscando(true)
    try {
      const { data: venta, error: ventaError } = await supabase
        .from('ventas')
        .select('id, folio, subtotal, descuento, total, created_at, estado, perfiles(nombre)')
        .eq('folio', folioBuscado)
        .maybeSingle()
      if (ventaError) throw ventaError
      if (!venta) {
        setError('No se encontró ninguna venta con ese folio.')
        return
      }

      const [detalleRes, pagosRes] = await Promise.all([
        supabase
          .from('venta_detalle')
          .select('variante_id, cantidad, precio_unitario, variantes(sku, tamano, color, tema, productos(nombre))')
          .eq('venta_id', venta.id),
        supabase.from('pagos').select('metodo, monto').eq('venta_id', venta.id),
      ])

      const carrito = (detalleRes.data ?? []).map((d) => ({
        variante_id: d.variante_id,
        label: varianteLabel(d.variantes ?? {}),
        precio: Number(d.precio_unitario),
        cantidad: d.cantidad,
      }))

      const pagos = { efectivo: 0, tarjeta: 0, transferencia: 0, cambio: 0 }
      for (const p of pagosRes.data ?? []) {
        pagos[p.metodo] = (pagos[p.metodo] ?? 0) + Number(p.monto)
      }

      setTicketData({
        folio: venta.folio,
        fecha: new Date(venta.created_at).toLocaleString('es-MX'),
        cajero: venta.perfiles?.nombre ?? '—',
        carrito,
        subtotal: Number(venta.subtotal),
        descuento: Number(venta.descuento),
        total: Number(venta.total),
        pagos,
        cancelada: venta.estado === 'cancelada',
      })
    } catch (err) {
      setError(friendlyError(err, 'No se pudo buscar la venta. Intenta de nuevo.'))
    } finally {
      setBuscando(false)
    }
  }

  function handleClose() {
    setFolio('')
    setError(null)
    setTicketData(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Reimprimir ticket">
      <form onSubmit={buscar} className="mb-1 flex items-end gap-2">
        <div className="flex-1">
          <FormField
            label="Folio de la venta"
            value={folio}
            onChange={(e) => setFolio(e.target.value)}
            placeholder="DD-000123"
          />
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="mb-3 rounded-lg bg-navy/10 px-4 py-2 text-sm font-medium text-navy hover:bg-navy/20 disabled:opacity-40"
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-coral">{error}</p>}

      {ticketData && (
        <div>
          <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-navy/10 bg-navy/5 p-3">
            <Ticket {...ticketData} esCopia />
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full rounded-lg bg-coral py-2 font-semibold text-white hover:brightness-95"
          >
            Imprimir
          </button>
        </div>
      )}
    </Modal>
  )
}
