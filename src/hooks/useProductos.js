import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProductos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('productos')
      .select('*, categorias(id, nombre)')
      .order('nombre')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setProductos(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { productos, loading, error, reload }
}
