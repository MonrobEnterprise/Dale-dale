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
    return 'No hay stock suficiente para registrar esa salida.'
  }

  return fallback
}
