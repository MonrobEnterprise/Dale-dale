import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { friendlyError } from '../../../lib/errorMessages'
import { DataTable } from '../../../components/admin/DataTable'
import { Modal } from '../../../components/admin/Modal'
import { FormField } from '../../../components/admin/FormField'
import { ActivoBadge } from '../../../components/admin/ActivoBadge'

const emptyForm = { id: null, nombre: '' }

export default function CategoriasTab() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadCategorias() {
    setLoading(true)
    const { data } = await supabase.from('categorias').select('*').order('nombre')
    setCategorias(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadCategorias()
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(categoria) {
    setForm({ id: categoria.id, nombre: categoria.nombre })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('El nombre es obligatorio.')
      return
    }

    setSubmitting(true)
    try {
      if (form.id) {
        const { error: updateError } = await supabase
          .from('categorias')
          .update({ nombre })
          .eq('id', form.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('categorias').insert({ nombre })
        if (insertError) throw insertError
      }
      setModalOpen(false)
      await loadCategorias()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActivo(categoria) {
    await supabase.from('categorias').update({ activo: !categoria.activo }).eq('id', categoria.id)
    await loadCategorias()
  }

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'activo', label: 'Estado', render: (row) => <ActivoBadge activo={row.activo} /> },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (row) => (
        <div className="flex gap-3">
          <button type="button" className="text-coral hover:underline" onClick={() => openEdit(row)}>
            Editar
          </button>
          <button
            type="button"
            className="text-navy/60 hover:underline"
            onClick={() => toggleActivo(row)}
          >
            {row.activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95"
        >
          + Nueva categoría
        </button>
      </div>

      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={categorias} emptyMessage="Aún no hay categorías." />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={handleSubmit}>
          <FormField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          {error && <p className="mb-3 text-sm text-coral">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg px-4 py-2 text-navy/70 hover:bg-navy/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
