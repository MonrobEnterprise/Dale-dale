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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      loadPerfil(session?.user?.id)
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
