import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { friendlyError } from '../../../lib/errorMessages'
import { useProductos } from '../../../hooks/useProductos'
import { DataTable } from '../../../components/admin/DataTable'
import { Modal } from '../../../components/admin/Modal'
import { FormField } from '../../../components/admin/FormField'
import { ActivoBadge } from '../../../components/admin/ActivoBadge'

const emptyForm = {
  id: null,
  sku: '',
  codigo_barras: '',
  tamano: '',
  color: '',
  tema: '',
  precio: '',
  costo: '',
  stock: '0',
  stock_minimo: '3',
}

export default function VariantesTab() {
  const { productos, loading: loadingProductos } = useProductos()
  const [productoId, setProductoId] = useState('')
  const [variantes, setVariantes] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function loadVariantes(id) {
    if (!id) {
      setVariantes([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('variantes')
      .select('*')
      .eq('producto_id', id)
      .order('id')
    setVariantes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadVariantes(productoId)
  }, [productoId])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(variante) {
    setForm({
      id: variante.id,
      sku: variante.sku ?? '',
      codigo_barras: variante.codigo_barras ?? '',
      tamano: variante.tamano ?? '',
      color: variante.color ?? '',
      tema: variante.tema ?? '',
      precio: String(variante.precio),
      costo: variante.costo != null ? String(variante.costo) : '',
      stock: String(variante.stock),
      stock_minimo: String(variante.stock_minimo),
    })
    setError(null)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const precio = Number(form.precio)
    if (form.precio === '' || Number.isNaN(precio) || precio < 0) {
      setError('El precio es obligatorio y debe ser mayor o igual a 0.')
      return
    }

    const payload = {
      producto_id: Number(productoId),
      codigo_barras: form.codigo_barras.trim() || null,
      tamano: form.tamano.trim() || null,
      color: form.color.trim() || null,
      tema: form.tema.trim() || null,
      precio,
      costo: form.costo === '' ? null : Number(form.costo),
      stock_minimo: form.stock_minimo === '' ? 3 : Number(form.stock_minimo),
    }
    if (!form.id) {
      payload.stock = form.stock === '' ? 0 : Number(form.stock)
    }

    setSubmitting(true)
    try {
      if (form.id) {
        const { error: updateError } = await supabase.from('variantes').update(payload).eq('id', form.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('variantes').insert(payload)
        if (insertError) throw insertError
      }
      setModalOpen(false)
      await loadVariantes(productoId)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActivo(variante) {
    await supabase.from('variantes').update({ activo: !variante.activo }).eq('id', variante.id)
    await loadVariantes(productoId)
  }

  const columns = [
    { key: 'sku', label: 'SKU interno', render: (row) => row.sku },
    { key: 'codigo_barras', label: 'Código de barras', render: (row) => row.codigo_barras ?? '—' },
    {
      key: 'descripcion',
      label: 'Tamaño / Color / Tema',
      render: (row) => [row.tamano, row.color, row.tema].filter(Boolean).join(' · ') || '—',
    },
    { key: 'precio', label: 'Precio', render: (row) => `$${Number(row.precio).toFixed(2)}` },
    {
      key: 'stock',
      label: 'Stock',
      render: (row) => (
        <span className={row.stock <= row.stock_minimo ? 'font-semibold text-dorado' : ''}>
          {row.stock}
        </span>
      ),
    },
    { key: 'stock_minimo', label: 'Mínimo' },
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <FormField
          label="Producto"
          type="select"
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          disabled={loadingProductos}
        >
          <option value="">Selecciona un producto…</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
              {!p.activo ? ' (inactivo)' : ''}
            </option>
          ))}
        </FormField>
        <button
          type="button"
          onClick={openCreate}
          disabled={!productoId}
          className="mt-6 h-fit rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95 disabled:opacity-40"
        >
          + Nueva variante
        </button>
      </div>

      {!productoId ? (
        <p className="text-navy/60">Selecciona un producto para ver sus variantes.</p>
      ) : loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={variantes} emptyMessage="Este producto aún no tiene variantes." />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? 'Editar variante' : 'Nueva variante'}>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-4">
            {form.id && (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-navy">SKU interno</span>
                <span className="block rounded-lg border border-navy/10 bg-navy/5 px-3 py-2 text-navy/70">
                  {form.sku}
                </span>
              </label>
            )}
            <FormField
              label="Código de barras"
              value={form.codigo_barras}
              onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
            />
            <FormField
              label="Precio"
              type="number"
              step="0.01"
              min="0"
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              required
            />
            <FormField label="Tamaño" value={form.tamano} onChange={(e) => setForm({ ...form, tamano: e.target.value })} />
            <FormField label="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <FormField label="Tema" value={form.tema} onChange={(e) => setForm({ ...form, tema: e.target.value })} />
            <FormField
              label="Costo"
              type="number"
              step="0.01"
              min="0"
              value={form.costo}
              onChange={(e) => setForm({ ...form, costo: e.target.value })}
            />
            {!form.id ? (
              <FormField
                label="Stock inicial"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            ) : (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block font-medium text-navy">Stock actual</span>
                <span className="block rounded-lg border border-navy/10 bg-navy/5 px-3 py-2 text-navy/70">
                  {form.stock} — usa Inventario para ajustar existencias
                </span>
              </label>
            )}
            <FormField
              label="Stock mínimo"
              type="number"
              min="0"
              value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
            />
          </div>
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
