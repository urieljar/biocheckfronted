import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface DeviceStatus {
  connected: boolean
  ip: string
  port: number
  deviceTime?: string
}

interface Stats {
  employees: number | null
  attendances: number | null
  schedules: number | null
}

export default function DashboardPage() {
  const { user } = useAuth()
  const canImportUsers = can(user?.role, 'device.import')
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null)
  const [loadingDevice, setLoadingDevice] = useState(false)
  const [syncingUsers, setSyncingUsers] = useState(false)
  const [syncingAttendances, setSyncingAttendances] = useState(false)
  const [stats, setStats] = useState<Stats>({
    employees: null,
    attendances: null,
    schedules: null,
  })
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

  const checkDevice = async () => {
    setLoadingDevice(true)
    try {
      const res = await api.get<{ ok: boolean; data: DeviceStatus }>('/devices/test')
      setDeviceStatus(res.data)
    } catch {
      setDeviceStatus({ connected: false, ip: '192.168.1.201', port: 4370 })
    } finally {
      setLoadingDevice(false)
    }
  }

  const loadStats = async () => {
    try {
      const [empRes, attRes, schRes] = await Promise.allSettled([
        api.get<{ pagination?: { total: number } }>('/employees?limit=1'),
        api.get<{ pagination?: { total: number } }>('/attendances?limit=1'),
        api.get<{ data?: unknown[] }>('/schedules'),
      ])

      setStats({
        employees:
          empRes.status === 'fulfilled' ? empRes.value.pagination?.total ?? null : null,
        attendances:
          attRes.status === 'fulfilled' ? attRes.value.pagination?.total ?? null : null,
        schedules:
          schRes.status === 'fulfilled' ? schRes.value.data?.length ?? null : null,
      })
    } catch {
      // Ignorar error al cargar métricas iniciales
    }
  }

  useEffect(() => {
    let ignore = false

    const fetchInitialData = async () => {
      try {
        const res = await api.get<{ ok: boolean; data: DeviceStatus }>('/devices/test')
        if (!ignore) {
          setDeviceStatus(res.data)
        }
      } catch {
        if (!ignore) {
          setDeviceStatus({ connected: false, ip: '192.168.1.201', port: 4370 })
        }
      }

      try {
        const [empRes, attRes, schRes] = await Promise.allSettled([
          api.get<{ pagination?: { total: number } }>('/employees?limit=1'),
          api.get<{ pagination?: { total: number } }>('/attendances?limit=1'),
          api.get<{ data?: unknown[] }>('/schedules'),
        ])

        if (!ignore) {
          setStats({
            employees:
              empRes.status === 'fulfilled' ? empRes.value.pagination?.total ?? null : null,
            attendances:
              attRes.status === 'fulfilled' ? attRes.value.pagination?.total ?? null : null,
            schedules:
              schRes.status === 'fulfilled' ? schRes.value.data?.length ?? null : null,
          })
        }
      } catch {
        // Ignorar
      }
    }

    fetchInitialData()

    return () => {
      ignore = true
    }
  }, [])

  const handleSyncUsers = async () => {
    setSyncingUsers(true)
    setFeedback(null)
    try {
      const res = await api.post<{ message: string }>('/devices/sync-users')
      setFeedback({
        type: 'success',
        message: res.message || 'Usuarios sincronizados correctamente con el reloj',
      })
      loadStats()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al sincronizar usuarios',
      })
    } finally {
      setSyncingUsers(false)
    }
  }

  const handleSyncAttendances = async () => {
    setSyncingAttendances(true)
    setFeedback(null)
    try {
      const res = await api.post<{ message: string }>('/devices/sync-attendances')
      setFeedback({
        type: 'success',
        message: res.message || 'Checadas sincronizadas correctamente con el reloj',
      })
      loadStats()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al sincronizar checadas',
      })
    } finally {
      setSyncingAttendances(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
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
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
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

      {/* Device Status Card */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                deviceStatus?.connected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {deviceStatus?.connected ? (
                <Wifi className="w-6 h-6" />
              ) : (
                <WifiOff className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Reloj Checador ZKTeco MB160</h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    deviceStatus?.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {deviceStatus?.connected ? 'En línea' : 'Desconectado'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                IP: {deviceStatus?.ip || '192.168.1.201'} | Puerto: {deviceStatus?.port || 4370}
                {deviceStatus?.deviceTime && (
                  <> | Hora del reloj: {new Date(deviceStatus.deviceTime).toLocaleString()}</>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={checkDevice}
            disabled={loadingDevice}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDevice ? 'animate-spin' : ''}`} />
            <span>Verificar Conexión</span>
          </button>
        </div>
      </section>

      {/* Quick Sync Actions */}
      <div className={`grid grid-cols-1 gap-4 ${canImportUsers ? 'md:grid-cols-2' : ''}`}>
        {/* Importar usuarios del reloj puede desactivar empleados: solo ROOT y ADMIN */}
        {canImportUsers && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Sincronización de Usuarios</h3>
              <p className="text-xs text-slate-400 mt-1">
                Descarga y actualiza los usuarios registrados directamente en la memoria del MB160.
              </p>
            </div>
            <button
              onClick={handleSyncUsers}
              disabled={syncingUsers}
              className="mt-5 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
            >
              {syncingUsers ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sincronizando Usuarios...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Sincronizar Usuarios del Reloj</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Sincronización de Checadas</h3>
            <p className="text-xs text-slate-400 mt-1">
              Descarga las nuevas marcaciones de asistencia acumuladas sin borrarlas del reloj.
            </p>
          </div>
          <button
            onClick={handleSyncAttendances}
            disabled={syncingAttendances}
            className="mt-5 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
          >
            {syncingAttendances ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sincronizando Checadas...</span>
              </>
            ) : (
              <>
                <CalendarCheck className="w-4 h-4" />
                <span>Descargar Checadas del Reloj</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards with Links */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/empleados"
          className="group bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Empleados</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {stats.employees !== null ? stats.employees : '—'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/asistencias"
          className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total de Checadas</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {stats.attendances !== null ? stats.attendances : '—'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          to="/horarios"
          className="group bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Horarios Activos</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                {stats.schedules !== null ? stats.schedules : '—'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
        </Link>
      </section>
    </div>
  )
}
