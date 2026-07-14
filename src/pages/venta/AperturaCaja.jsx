import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../lib/errorMessages'
import { FormField } from '../../components/admin/FormField'

export default function AperturaCaja({ onAbierta }) {
  const { user } = useAuth()
  const [efectivoInicial, setEfectivoInicial] = useState('0')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const monto = Number(efectivoInicial)
    if (efectivoInicial === '' || Number.isNaN(monto) || monto < 0) {
      setError('Captura un fondo de caja válido.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error: insertError } = await supabase
        .from('cortes_caja')
        .insert({ usuario_id: user.id, efectivo_inicial: monto })
        .select()
        .single()
      if (insertError) throw insertError
      onAbierta(data)
    } catch (err) {
      setError(friendlyError(err, 'No se pudo abrir la caja. Intenta de nuevo.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-lg">
      <h2 className="mb-1 text-xl font-semibold text-navy">Apertura de caja</h2>
      <p className="mb-4 text-sm text-navy/70">Captura el fondo con el que inicias el turno.</p>

      <form onSubmit={handleSubmit}>
        <FormField
          label="Efectivo inicial"
          type="number"
          min="0"
          step="0.01"
          value={efectivoInicial}
          onChange={(e) => setEfectivoInicial(e.target.value)}
          required
        />

        {error && <p className="mb-3 text-sm text-coral">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-coral py-2 font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {submitting ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </form>
    </div>
  )
}
