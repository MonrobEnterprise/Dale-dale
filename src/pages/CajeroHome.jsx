import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabaseClient'
import AperturaCaja from './venta/AperturaCaja'
import PuntoVenta from './venta/PuntoVenta'

export default function CajeroHome() {
  const { user } = useAuth()
  const [corte, setCorte] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCorte() {
      setLoading(true)
      const { data } = await supabase
        .from('cortes_caja')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('estado', 'abierta')
        .maybeSingle()
      setCorte(data ?? null)
      setLoading(false)
    }
    loadCorte()
  }, [user.id])

  return (
    <AppShell>
      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : corte ? (
        <PuntoVenta corte={corte} onCerrarCaja={() => setCorte(null)} />
      ) : (
        <AperturaCaja onAbierta={setCorte} />
      )}
    </AppShell>
  )
}
