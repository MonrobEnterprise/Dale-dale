import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../lib/errorMessages'
import { DataTable } from '../../components/admin/DataTable'
import { FormField } from '../../components/admin/FormField'

const CANTIDAD_LABEL = {
  entrada: 'Cantidad a agregar',
  salida: 'Cantidad a retirar',
  ajuste: 'Nuevo stock total',
}

const TIPO_COLOR = {
  entrada: 'text-menta',
  salida: 'text-coral',
  ajuste: 'text-dorado',
}

function varianteLabel(v) {
  const desc = [v.tamano, v.color, v.tema].filter(Boolean).join(' · ')
  return [v.productos?.nombre, desc, v.sku ? `SKU ${v.sku}` : null].filter(Boolean).join(' — ')
}

export default function InventarioAdmin() {
  const { user } = useAuth()
  const [variantes, setVariantes] = useState([])
  const [historial, setHistorial] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(true)

  const [search, setSearch] = useState('')
  const [varianteId, setVarianteId] = useState('')
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadVariantes() {
    const { data } = await supabase
      .from('variantes')
      .select('id, sku, tamano, color, tema, stock, productos(nombre)')
      .eq('activo', true)
      .order('id')
    setVariantes(data ?? [])
  }

  async function loadHistorial() {
    setLoadingHistorial(true)
    const { data } = await supabase
      .from('movimientos_inventario')
      .select('*, variantes(sku, tamano, color, tema, productos(nombre)), perfiles(nombre)')
      .order('created_at', { ascending: false })
      .limit(50)
    setHistorial(data ?? [])
    setLoadingHistorial(false)
  }

  useEffect(() => {
    loadVariantes()
    loadHistorial()
  }, [])

  const resultados = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return variantes
      .filter((v) => varianteLabel(v).toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, variantes])

  const seleccionada = variantes.find((v) => v.id === Number(varianteId))

  function selectVariante(v) {
    setVarianteId(String(v.id))
    setSearch(varianteLabel(v))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!varianteId) {
      setError('Selecciona una variante.')
      return
    }
    const cantidadNum = Number(cantidad)
    if (cantidad === '' || Number.isNaN(cantidadNum) || cantidadNum < 0) {
      setError('Captura una cantidad válida.')
      return
    }

    setSubmitting(true)
    try {
      const { error: insertError } = await supabase.from('movimientos_inventario').insert({
        variante_id: Number(varianteId),
        tipo,
        cantidad: cantidadNum,
        motivo: motivo.trim() || null,
        usuario_id: user.id,
      })
      if (insertError) throw insertError

      setVarianteId('')
      setSearch('')
      setCantidad('')
      setMotivo('')
      setTipo('entrada')
      await Promise.all([loadVariantes(), loadHistorial()])
    } catch (err) {
      setError(friendlyError(err, 'No se pudo registrar el movimiento. Verifica los datos e intenta de nuevo.'))
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'fecha',
      label: 'Fecha',
      render: (row) => new Date(row.created_at).toLocaleString('es-MX'),
    },
    {
      key: 'variante',
      label: 'Variante',
      render: (row) => varianteLabel(row.variantes ?? {}),
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (row) => <span className={'font-medium capitalize ' + TIPO_COLOR[row.tipo]}>{row.tipo}</span>,
    },
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'motivo', label: 'Motivo', render: (row) => row.motivo ?? '—' },
    { key: 'usuario', label: 'Usuario', render: (row) => row.perfiles?.nombre ?? '—' },
  ]

  return (
    <AppShell>
      <h2 className="mb-4 text-xl font-semibold text-navy">Inventario</h2>

      <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 font-semibold text-navy">Registrar movimiento</h3>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-3">
            <FormField
              label="Variante"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setVarianteId('')
              }}
              placeholder="Busca por producto, SKU, tamaño, color o tema…"
            />
            {resultados.length > 0 && !varianteId && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-navy/10 bg-white shadow-lg">
                {resultados.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => selectVariante(v)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-coral/5"
                    >
                      {varianteLabel(v)} · stock: {v.stock}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {seleccionada && (
            <p className="mb-3 text-sm text-navy/70">Stock actual: {seleccionada.stock}</p>
          )}

          <div className="grid grid-cols-2 gap-x-4">
            <FormField label="Tipo" type="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </FormField>
            <FormField
              label={CANTIDAD_LABEL[tipo]}
              type="number"
              min="0"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </div>
          <FormField
            label="Motivo (opcional)"
            type="textarea"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />

          {error && <p className="mb-3 text-sm text-coral">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95 disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Registrar movimiento'}
          </button>
        </form>
      </div>

      <h3 className="mb-3 font-semibold text-navy">Historial reciente</h3>
      {loadingHistorial ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={historial} emptyMessage="Aún no hay movimientos registrados." />
      )}
    </AppShell>
  )
}
