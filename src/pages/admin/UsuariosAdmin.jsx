import { useEffect, useState } from 'react'
import { AppShell } from '../../components/AppShell'
import { supabase } from '../../lib/supabaseClient'
import { friendlyError } from '../../lib/errorMessages'
import { DataTable } from '../../components/admin/DataTable'
import { Modal } from '../../components/admin/Modal'
import { FormField } from '../../components/admin/FormField'
import { ActivoBadge } from '../../components/admin/ActivoBadge'

const emptyForm = { nombre: '', email: '', password: '', rol: 'cajero' }

function generarPassword() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const azar = new Uint32Array(12)
  crypto.getRandomValues(azar)
  return Array.from(azar, (n) => alfabeto[n % alfabeto.length]).join('')
}

async function mensajeDeError(error) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json()
      if (body?.error) return body.error
    } catch {
      // el cuerpo no era JSON parseable; se usa el mensaje genérico de abajo
    }
  }
  return friendlyError(error, 'No se pudo crear el usuario. Intenta de nuevo.')
}

export default function UsuariosAdmin() {
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [credencialesNuevas, setCredencialesNuevas] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function loadPerfiles() {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('id, nombre, rol, activo').order('nombre')
    setPerfiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadPerfiles()
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setCredencialesNuevas(null)
    setCopiado(false)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('crear-usuario', {
        body: { email: form.email.trim(), password: form.password, nombre: form.nombre.trim(), rol: form.rol },
      })
      if (invokeError) throw new Error(await mensajeDeError(invokeError))
      if (data?.error) throw new Error(data.error)

      setCredencialesNuevas({ email: form.email.trim(), password: form.password })
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copiarCredenciales() {
    const texto = `Correo: ${credencialesNuevas.email}\nContraseña: ${credencialesNuevas.password}`
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
  }

  function cerrarModalExito() {
    setModalOpen(false)
    setCredencialesNuevas(null)
    loadPerfiles()
  }

  async function toggleActivo(perfil) {
    await supabase.from('perfiles').update({ activo: !perfil.activo }).eq('id', perfil.id)
    await loadPerfiles()
  }

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'rol', label: 'Rol', render: (row) => <span className="capitalize">{row.rol}</span> },
    { key: 'activo', label: 'Estado', render: (row) => <ActivoBadge activo={row.activo} /> },
    {
      key: 'acciones',
      label: 'Acciones',
      render: (row) => (
        <button type="button" className="text-coral hover:underline" onClick={() => toggleActivo(row)}>
          {row.activo ? 'Desactivar' : 'Activar'}
        </button>
      ),
    },
  ]

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-navy">Usuarios</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-coral px-4 py-2 font-medium text-white hover:brightness-95"
        >
          + Nuevo usuario
        </button>
      </div>

      {loading ? (
        <p className="text-navy/60">Cargando…</p>
      ) : (
        <DataTable columns={columns} rows={perfiles} emptyMessage="Aún no hay usuarios registrados." />
      )}

      <Modal
        open={modalOpen}
        onClose={() => (credencialesNuevas ? undefined : setModalOpen(false))}
        title={credencialesNuevas ? 'Usuario creado' : 'Nuevo usuario'}
      >
        {credencialesNuevas ? (
          <div>
            <p className="mb-3 text-sm text-coral">
              Guarda estos datos ahora — no se volverán a mostrar.
            </p>
            <div className="mb-4 space-y-1 rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy">
              <p>Correo: {credencialesNuevas.email}</p>
              <p>Contraseña: {credencialesNuevas.password}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copiarCredenciales}
                className="flex-1 rounded-lg bg-navy/10 py-2 text-sm font-medium text-navy hover:bg-navy/20"
              >
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={cerrarModalExito}
                className="flex-1 rounded-lg bg-coral py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Ya las guardé
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
            <FormField
              label="Correo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <FormField label="Rol" type="select" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="cajero">Cajero</option>
              <option value="admin">Admin</option>
            </FormField>
            <div className="mb-3">
              <FormField
                label="Contraseña temporal"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, password: generarPassword() })}
                className="text-sm text-navy/70 hover:underline"
              >
                Generar contraseña
              </button>
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
                {submitting ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  )
}
