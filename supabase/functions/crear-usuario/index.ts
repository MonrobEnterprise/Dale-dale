// Edge Function: crear-usuario
//
// Única pieza de la gestión de usuarios que necesita correr en el servidor:
// crear un usuario nuevo en Supabase Auth requiere la Admin API, que sólo
// funciona con la llave service_role -- esa llave nunca debe llegar al
// navegador. Listar usuarios y desactivarlos ya se resuelve desde el
// frontend directo, porque las policies de RLS de `perfiles` ya lo permiten
// para el admin.
//
// Verificación en dos capas:
// 1. verify_jwt=true en el deploy: Supabase rechaza cualquier llamada sin
//    sesión válida antes de que este código se ejecute.
// 2. Aquí adentro: se arma un cliente "como quien llama" (reenviando su
//    propio header Authorization) y se confirma su identidad con
//    auth.getUser() -- nunca se confía en un rol que mande el cliente. Con
//    ese id verificado se consulta `perfiles` con el cliente service_role
//    (no se puede depender de que el llamante tenga permiso de leerlo) y se
//    exige rol = 'admin' y activo = true.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return respond({ error: 'No autorizado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser()
    if (userError || !user) return respond({ error: 'No autorizado.' }, 401)

    // Cliente con privilegios de servicio: sólo se usa para el chequeo de rol
    // y las operaciones que sí requieren saltarse RLS / usar la Admin API.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: perfilLlamante, error: perfilError } = await adminClient
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfilLlamante || perfilLlamante.rol !== 'admin' || !perfilLlamante.activo) {
      return respond({ error: 'No tienes permiso para esta acción.' }, 403)
    }

    const { email, password, nombre, rol } = await req.json()

    if (!email || !password || !nombre || !rol) {
      return respond({ error: 'Faltan datos obligatorios.' }, 400)
    }
    if (!['admin', 'cajero'].includes(rol)) {
      return respond({ error: 'Rol inválido.' }, 400)
    }
    if (String(password).length < 8) {
      return respond({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
    }

    const { data: nuevoUsuario, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      const mensaje = /already been registered|already exists/i.test(createError.message)
        ? 'Ese correo ya está registrado.'
        : 'No se pudo crear el usuario. Verifica los datos e intenta de nuevo.'
      return respond({ error: mensaje }, 400)
    }

    const { error: perfilInsertError } = await adminClient.from('perfiles').insert({
      id: nuevoUsuario.user.id,
      nombre,
      rol,
    })

    if (perfilInsertError) {
      // El usuario de Auth ya se creó; si el perfil falla, se borra ese
      // usuario para no dejar una cuenta sin perfil asociado (rompería el
      // login -- AuthContext espera encontrar la fila en `perfiles`).
      await adminClient.auth.admin.deleteUser(nuevoUsuario.user.id)
      return respond({ error: 'No se pudo guardar el perfil del usuario. Intenta de nuevo.' }, 500)
    }

    return respond({ success: true, id: nuevoUsuario.user.id, email })
  } catch (_err) {
    return respond({ error: 'Error inesperado. Intenta de nuevo.' }, 500)
  }
})
