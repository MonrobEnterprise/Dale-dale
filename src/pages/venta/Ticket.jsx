import logoPinata from '../../assets/logo-pinata.png'

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

export default function Ticket({ folio, fecha, cajero, carrito, subtotal, descuento, total, pagos, esCopia, cancelada }) {
  return (
    <div className="ticket-print mx-auto w-[58mm] bg-white p-2 text-[11px] leading-tight text-navy">
      <div className="mb-2 text-center">
        <img src={logoPinata} alt="" className="mx-auto h-12 w-auto" />
        <p className="font-display text-sm font-bold">¡Dale, dale!!</p>
        {esCopia && <p className="font-semibold text-navy/60">(Copia)</p>}
        {cancelada && <p className="font-semibold text-coral">VENTA CANCELADA</p>}
      </div>

      <div className="mb-2 space-y-0.5 border-b border-navy/30 pb-2">
        <p>Folio: {folio}</p>
        <p>Fecha: {fecha}</p>
        <p>Cajero: {cajero}</p>
      </div>

      <div className="mb-2 space-y-1.5 border-b border-navy/30 pb-2">
        {carrito.map((item) => (
          <div key={item.variante_id}>
            <p>{item.label}</p>
            <div className="flex justify-between text-navy/70">
              <span>
                {item.cantidad} × {money(item.precio)}
              </span>
              <span className="text-navy">{money(item.precio * item.cantidad)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 space-y-0.5 border-b border-navy/30 pb-2 text-right">
        <p>Subtotal: {money(subtotal)}</p>
        {descuento > 0 && <p>Descuento: −{money(descuento)}</p>}
        <p className="font-bold">Total: {money(total)}</p>
      </div>

      <div className="mb-2 space-y-0.5 border-b border-navy/30 pb-2">
        {pagos.efectivo > 0 && <p>Efectivo: {money(pagos.efectivo)}</p>}
        {pagos.tarjeta > 0 && <p>Tarjeta: {money(pagos.tarjeta)}</p>}
        {pagos.transferencia > 0 && <p>Transferencia: {money(pagos.transferencia)}</p>}
        {pagos.cambio > 0 && <p>Cambio: {money(pagos.cambio)}</p>}
      </div>

      <p className="text-center font-display">¡No pierdas el tino!</p>
    </div>
  )
}
