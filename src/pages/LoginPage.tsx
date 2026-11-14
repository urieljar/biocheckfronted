import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, type AuthUser } from '../context/AuthContext'
import { api } from '../lib/api'
import { Fingerprint, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

interface LoginResponse {
  ok: boolean
  message: string
  data: {
    token: string
    user: AuthUser
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      })

      if (response.data?.token) {
        login(response.data.token, response.data.user)
        navigate('/')
      } else {
        throw new Error('Respuesta inválida del servidor')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-4 shadow-inner">
            <Fingerprint className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BioCheck</h1>
          <p className="text-sm text-slate-400 mt-1">Gestión de asistencia biométrica</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ejemplo.com"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Ingresando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
