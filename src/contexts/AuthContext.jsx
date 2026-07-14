import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadPerfil = useCallback(async (userId) => {
    if (!userId) {
      setPerfil(null)
      return
    }
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, activo')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error cargando perfil:', error.message)
      setPerfil(null)
      return
    }
    setPerfil(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      loadPerfil(session?.user?.id).finally(() => setLoading(false))
    })

    // `loading` debe cubrir también la recarga de perfil que dispara cada
    // evento de auth (login, logout, refresh de token), no sólo el arranque
    // inicial: si no, hay una ventana justo después del login donde
    // `session` ya es verdadero pero `perfil` todavía es null porque este
    // fetch no ha resuelto, y los consumidores de useAuth() (RoleRedirect,
    // ProtectedRoute) la interpretan como "sin rol" y redirigen a /login,
    // que a su vez redirige de vuelta a "/" por tener sesión — un ping-pong
    // que React corta con "Maximum update depth exceeded".
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(true)
      loadPerfil(session?.user?.id).finally(() => setLoading(false))
    })

    return () => listener.subscription.unsubscribe()
  }, [loadPerfil])

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    perfil,
    loading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
