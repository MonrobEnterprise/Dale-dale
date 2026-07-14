// Traduce errores de Supabase/Postgres a mensajes en español para mostrar en
// la UI. Nunca se muestra el texto crudo del error al usuario final.
export function friendlyError(err, fallback = 'No se pudo guardar. Verifica los datos e intenta de nuevo.') {
  const message = err?.message || ''

  if (err?.code === '23505' || /duplicate key/i.test(message)) {
    if (/sku/i.test(message)) {
      return 'Ya existe una variante con ese SKU.'
    }
    return 'Ese valor ya está en uso.'
  }

  if (/Stock insuficiente/i.test(message)) {
    return 'No hay stock suficiente para completar la operación.'
  }

  if (/no está abierta|corte de caja indicado no existe/i.test(message)) {
    return 'La caja no está abierta. Vuelve a abrirla e intenta de nuevo.'
  }

  if (/no cubren el total/i.test(message)) {
    return 'Los pagos capturados no cubren el total de la venta.'
  }

  return fallback
}
