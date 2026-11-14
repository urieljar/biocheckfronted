import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { roleLabel } from '../lib/permissions'
import {
  UserCircle,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  User,
} from 'lucide-react'

export default function ProfilePage() {
  const { user, login } = useAuth()

  // Profile Form
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Password Form
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loadingPassword, setLoadingPassword] = useState(false)

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Auto-cerrar mensaje de confirmación después de unos segundos
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => {
      setFeedback(null)
    }, feedback.type === 'success' ? 4000 : 7000)
    return () => clearTimeout(timer)
  }, [feedback])

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoadingProfile(true)
    setFeedback(null)

    try {
      const res = await api.patch<{ ok: boolean; message: string; data: { id: string; name: string; email: string; role: string } }>(
        '/auth/me',
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }
      )

      // Actualizar datos locales en AuthContext
      const currentToken = localStorage.getItem('token') || ''
      login(currentToken, {
        id: user.id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
      })

      setFeedback({
        type: 'success',
        message: 'Información de perfil actualizada correctamente',
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al actualizar perfil',
      })
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setFeedback(null)

    if (!currentPassword) {
      setFeedback({
        type: 'error',
        message: 'Escribe tu contraseña actual para poder cambiarla',
      })
      return
    }

    if (password.length < 10) {
      setFeedback({
        type: 'error',
        message: 'La contraseña debe tener al menos 10 caracteres',
      })
      return
    }

    if (password !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: 'Las contraseñas no coinciden',
      })
      return
    }

    setLoadingPassword(true)
    try {
      await api.patch('/auth/password', {
        currentPassword,
        newPassword: password,
      })
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setFeedback({
        type: 'success',
        message: 'Contraseña actualizada correctamente',
      })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cambiar la contraseña',
      })
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-blue-400" />
          <span>Mi Perfil de Cuenta</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Administración de tus datos personales y credenciales de acceso
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-75 hover:opacity-100 underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* User Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-2xl font-bold shadow-inner">
            {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{user?.name}</h3>
            <p className="text-xs text-slate-400">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>{roleLabel(user?.role)}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Cuenta Activa
              </span>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-mono">
          ID: {user?.id}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Datos Personales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-blue-400" />
            <span>Datos Personales</span>
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Nombre Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingProfile}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
            >
              {loadingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Cambios</span>
              )}
            </button>
          </form>
        </div>

        {/* Form Cambiar Contraseña */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Seguridad y Contraseña</span>
          </h3>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Contraseña Actual
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Nueva Contraseña (mínimo 10 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loadingPassword}
              className="w-full mt-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-amber-600/20"
            >
              {loadingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <span>Actualizar Contraseña</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
