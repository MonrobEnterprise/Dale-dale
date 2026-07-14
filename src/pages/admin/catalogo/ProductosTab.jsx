import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { friendlyError } from '../../../lib/errorMessages'
import { useProductos } from '../../../hooks/useProductos'
import { DataTable } from '../../../components/admin/DataTable'
import { Modal } from '../../../components/admin/Modal'
import { FormField } from '../../../components/admin/FormField'
import { ActivoBadge } from '../../../components/admin/ActivoBadge'

const emptyForm = { id: null, nombre: '', descripcion: '', categoria_id: '' }

export default function ProductosTab() {
  const { productos, loading, reload } = useProductos()
  const [categorias, setCategorias] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('categorias')
      .select('*')
      .order('nombre')
      .then(({ data }) => setCategorias(data ?? []))
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(producto) {
    setForm({
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      categoria_id: producto.categoria_id ?? '',
    })
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

    const payload = {
      nombre,
      descripcion: form.descripcion.trim() || null,
      categoria_id: form.categoria_id === '' ? null : Number(form.categoria_id),
    }

    setSubmitting(true)
    try {
      if (form.id) {
        const { error: updateError } = await supabase.from('productos').update(payload).eq('id', form.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('productos').insert(payload)
        if (insertError) throw insertError
      }
      setModalOpen(false)
      await reload()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActivo(producto) {
    await supabase.from('productos').update({ activo: !producto.activo }).eq('id', producto.id)
    await reload()
  }

  // Sólo categorías activas, salvo la del producto en edición aunque esté inactiva.
  const categoriaOptions = categorias.filter(
    (c) => c.activo || c.id === Number(form.categoria_id)
  )

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'categoria', label: 'Categoría', render: (row) => row.categorias?.nombre ?? '—' },
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
          + Nuevo producto
        </button>
      </div>

      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={productos} emptyMessage="Aún no hay productos." />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Editar producto' : 'Nuevo producto'}>
        <form onSubmit={handleSubmit}>
          <FormField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />
          <FormField
            label="Descripción"
            type="textarea"
            rows={3}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
          <FormField
            label="Categoría"
            type="select"
            value={form.categoria_id}
            onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
          >
            <option value="">Sin categoría</option>
            {categoriaOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {!c.activo ? ' (inactiva)' : ''}
              </option>
            ))}
          </FormField>
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
