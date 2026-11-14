import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  RefreshCw,
  Save,
  RotateCcw,
  Sliders,
  Users,
  CheckCircle2,
  AlertCircle,
  Database,
  Cpu,
  Radio,
  Server,
  Zap,
  Check,
  Info,
  UserCheck,
  LockKeyhole,
  Loader2,
} from 'lucide-react'
import {
  type Role,
  type Capability,
  ROLE_LABELS,
  ALL_ROLES,
} from '../lib/permissions'

interface CapabilityMetadata {
  name: string
  category: string
  description: string
  readOnly?: boolean
}

interface PermissionsPayload {
  capabilities: Record<Capability, Role[]>
  defaultCapabilities: Record<Capability, Role[]>
  metadata: Record<Capability, CapabilityMetadata>
  roles: Role[]
}

interface SystemSettingsPayload {
  allowManualPunches: boolean
  requireJustificationReason: boolean
  autoSyncDeviceOnEmployeeChange: boolean
  allowBatchExport: boolean
  strictPunchesAudit: boolean
  systemMaintenanceMessage: string
}

interface SystemStatusPayload {
  database: {
    status: string
    error?: string | null
  }
  counts: {
    usersByRole: Record<string, number>
    totalUsers: number
    totalEmployees: number
    activeEmployees: number
    totalDevices: number
    pendingCommands: number
    totalCommands: number
  }
  process: {
    uptimeSeconds: number
    nodeVersion: string
    platform: string
    memoryMb: {
      rss: number
      heapTotal: number
      heapUsed: number
    }
  }
}

interface RootUserItem {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt?: string
}

type TabType = 'permissions' | 'settings' | 'actions' | 'users'

export default function RootControlPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('permissions')

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // 1. Estado de Permisos
  const [loadingPermissions, setLoadingPermissions] = useState(true)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [permissionsData, setPermissionsData] = useState<PermissionsPayload | null>(null)
  const [draftCapabilities, setDraftCapabilities] = useState<Record<Capability, Role[]> | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  // 2. Estado de Feature Toggles
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settings, setSettings] = useState<SystemSettingsPayload>({
    allowManualPunches: true,
    requireJustificationReason: true,
    autoSyncDeviceOnEmployeeChange: true,
    allowBatchExport: true,
    strictPunchesAudit: false,
    systemMaintenanceMessage: '',
  })

  // 3. Estado de Diagnóstico & Acciones Maestras
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [systemStatus, setSystemStatus] = useState<SystemStatusPayload | null>(null)
  const [executingAction, setExecutingAction] = useState<string | null>(null)

  // 4. Estado de Usuarios para Asignación
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [rootUsers, setRootUsers] = useState<RootUserItem[]>([])
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<string | null>(null)

  // Cargar datos según pestaña
  const fetchPermissions = async () => {
    try {
      setLoadingPermissions(true)
      const res = await api.get<{ ok: boolean; data: PermissionsPayload }>('/root/permissions')
      setPermissionsData(res.data)
      setDraftCapabilities(res.data.capabilities)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar matriz de permisos',
      })
    } finally {
      setLoadingPermissions(false)
    }
  }

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true)
      const res = await api.get<{ ok: boolean; data: SystemSettingsPayload }>('/root/settings')
      setSettings(res.data)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar configuraciones',
      })
    } finally {
      setLoadingSettings(false)
    }
  }

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true)
      const res = await api.get<{ ok: boolean; data: SystemStatusPayload }>('/root/system-status')
      setSystemStatus(res.data)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar diagnóstico del sistema',
      })
    } finally {
      setLoadingStatus(false)
    }
  }

  const fetchRootUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await api.get<{ ok: boolean; data: RootUserItem[] }>('/root/users')
      setRootUsers(res.data)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar usuarios',
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
    fetchSettings()
    fetchStatus()
    fetchRootUsers()
  }, [])

  // Limpiar mensaje tras 6 segundos
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 6000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Detectar cambios no guardados en permisos
  const hasUnsavedPermissions = useMemo(() => {
    if (!permissionsData || !draftCapabilities) return false
    return JSON.stringify(permissionsData.capabilities) !== JSON.stringify(draftCapabilities)
  }, [permissionsData, draftCapabilities])

  // Alternar checkbox de permiso por rol
  const handleToggleCapabilityRole = (cap: Capability, targetRole: Role) => {
    if (targetRole === 'ROOT') return // ROOT siempre tiene todo
    const meta = permissionsData?.metadata[cap]
    if (meta?.readOnly) return // Capacidades de seguridad intocables

    setDraftCapabilities((prev) => {
      if (!prev) return prev
      const currentRoles = prev[cap] || []
      const exists = currentRoles.includes(targetRole)
      const updatedRoles = exists
        ? currentRoles.filter((r) => r !== targetRole)
        : [...currentRoles, targetRole]

      return {
        ...prev,
        [cap]: updatedRoles,
      }
    })
  }

  // Guardar matriz de permisos
  const handleSavePermissions = async () => {
    if (!draftCapabilities) return
    try {
      setSavingPermissions(true)
      const res = await api.put<{ ok: boolean; message: string; data: { capabilities: Record<Capability, Role[]> } }>(
        '/root/permissions',
        { capabilities: draftCapabilities }
      )
      setFeedback({
        type: 'success',
        message: res.message || 'Permisos guardados y aplicados exitosamente en todo el sistema',
      })
      if (permissionsData) {
        setPermissionsData({
          ...permissionsData,
          capabilities: res.data.capabilities,
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al guardar los permisos',
      })
    } finally {
      setSavingPermissions(false)
    }
  }

  // Restaurar permisos por defecto
  const handleResetPermissions = async () => {
    const ok = window.confirm(
      '¿Deseas restaurar la matriz de permisos a los valores originales de fábrica del sistema?'
    )
    if (!ok) return

    try {
      setSavingPermissions(true)
      const res = await api.post<{ ok: boolean; message: string; data: { capabilities: Record<Capability, Role[]> } }>(
        '/root/permissions/reset'
      )
      setFeedback({
        type: 'success',
        message: res.message || 'Permisos restaurados a valores de fábrica',
      })
      if (permissionsData) {
        setPermissionsData({
          ...permissionsData,
          capabilities: res.data.capabilities,
        })
        setDraftCapabilities(res.data.capabilities)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al restaurar permisos',
      })
    } finally {
      setSavingPermissions(false)
    }
  }

  // Guardar configuraciones de funciones
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true)
      const res = await api.put<{ ok: boolean; message: string; data: SystemSettingsPayload }>(
        '/root/settings',
        { settings }
      )
      setFeedback({
        type: 'success',
        message: res.message || 'Configuraciones del sistema actualizadas',
      })
      setSettings(res.data)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al guardar configuraciones',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // Ejecutar Acción: Purgar cola de comandos
  const handlePurgeCommands = async () => {
    const ok = window.confirm(
      '¿Deseas purgar todos los comandos de reloj en estado pendiente o con error? Esta acción desatasca la cola ADMS.'
    )
    if (!ok) return

    try {
      setExecutingAction('purge')
      const res = await api.post<{ ok: boolean; message: string }>('/root/actions/purge-commands')
      setFeedback({
        type: 'success',
        message: res.message || 'Comandos purgados con éxito',
      })
      fetchStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al purgar comandos',
      })
    } finally {
      setExecutingAction(null)
    }
  }

  // Ejecutar Acción: Sincronización forzada
  const handleForceDeviceSync = async () => {
    try {
      setExecutingAction('sync')
      const res = await api.post<{ ok: boolean; message: string }>('/root/actions/sync-devices')
      setFeedback({
        type: 'success',
        message: res.message || 'Órdenes de comprobación enviadas al reloj',
      })
      fetchStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al forzar sincronización',
      })
    } finally {
      setExecutingAction(null)
    }
  }

  // Reasignar rol a usuario
  const handleChangeUserRole = async (targetUser: RootUserItem, newRole: Role) => {
    if (targetUser.role === newRole) return
    const ok = window.confirm(
      `¿Confirmas cambiar el rol de "${targetUser.name}" de ${ROLE_LABELS[targetUser.role]} a ${ROLE_LABELS[newRole]}?`
    )
    if (!ok) return

    try {
      setUpdatingUserRoleId(targetUser.id)
      const res = await api.patch<{ ok: boolean; message: string; data: RootUserItem }>(
        `/root/users/${targetUser.id}/role`,
        { role: newRole }
      )
      setFeedback({
        type: 'success',
        message: res.message || 'Rol actualizado correctamente',
      })
      setRootUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      )
      fetchStatus()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al actualizar rol de usuario',
      })
    } finally {
      setUpdatingUserRoleId(null)
    }
  }

  // Categorías de capacidades disponibles
  const categories = useMemo(() => {
    if (!permissionsData) return []
    const cats = new Set<string>()
    Object.values(permissionsData.metadata).forEach((m) => cats.add(m.category))
    return Array.from(cats)
  }, [permissionsData])

  // Filtrado de capacidades
  const filteredCapabilities = useMemo(() => {
    if (!permissionsData || !draftCapabilities) return []
    const list = Object.keys(draftCapabilities) as Capability[]
    if (categoryFilter === 'ALL') return list
    return list.filter((cap) => permissionsData.metadata[cap]?.category === categoryFilter)
  }, [permissionsData, draftCapabilities, categoryFilter])

  // Formato de tiempo activo
  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${seconds % 60}s`
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ======================================================== */}
      {/* 1. HEADER CAPSULE EXCLUSIVA ROOT                         */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-purple-950/30 border border-amber-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Control Maestro ROOT
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
                  <LockKeyhole className="w-3 h-3 text-amber-400" />
                  Nivel 0 · Exclusivo Propietario
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {user?.name || 'ROOT'} ({user?.email})
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Asignación dinámica de permisos y capacidades por rol, control de interruptores de funcionalidad del sistema, diagnósticos y acciones críticas de seguridad.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchPermissions()
                fetchSettings()
                fetchStatus()
                fetchRootUsers()
              }}
              disabled={loadingPermissions || loadingSettings || loadingStatus || loadingUsers}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Refrescar todos los datos"
            >
              {loadingPermissions || loadingSettings || loadingStatus || loadingUsers ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{loadingPermissions || loadingSettings || loadingStatus || loadingUsers ? 'Cargando...' : 'Refrescar'}</span>
            </button>
          </div>
        </div>

        {/* Barra de pestañas */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-6 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Matriz de Permisos</span>
            {hasUnsavedPermissions && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Cambios sin guardar" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Funcionalidades Globales</span>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'actions'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Acciones & Diagnóstico</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Asignación de Roles ({rootUsers.length})</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs sm:text-sm font-medium animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 1: MATRIZ DE PERMISOS                            */}
      {/* ======================================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Barra de control y guardado */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-400">Filtrar categoría:</span>
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  categoryFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleResetPermissions}
                disabled={savingPermissions || loadingPermissions}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Restablecer valores originales de fábrica"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Restablecer Defaults</span>
              </button>

              <button
                onClick={handleSavePermissions}
                disabled={savingPermissions || !hasUnsavedPermissions}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md cursor-pointer ${
                  hasUnsavedPermissions
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 scale-[1.02]'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{savingPermissions ? 'Guardando...' : 'Guardar Permisos'}</span>
              </button>
            </div>
          </div>

          {/* Tabla de Matriz de Capacidades */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Capacidad / Acción del Sistema</th>
                    <th className="py-3 px-4 text-center w-28 bg-amber-950/20 text-amber-300 border-x border-slate-800">
                      ROOT (Propietario)
                    </th>
                    <th className="py-3 px-4 text-center w-28 text-blue-300">ADMIN (Administrador)</th>
                    <th className="py-3 px-4 text-center w-28 text-emerald-300">SUPERVISOR (Operativo)</th>
                    <th className="py-3 px-4 text-center w-28 text-slate-400">CONSULTA (Lectura)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCapabilities.map((cap) => {
                    const meta = permissionsData?.metadata[cap]
                    const assignedRoles = draftCapabilities?.[cap] || []
                    const isReadOnly = meta?.readOnly

                    return (
                      <tr key={cap} className="hover:bg-slate-800/40 transition-colors group">
                        {/* Nombre y descripción */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm">
                              {meta?.name || cap}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                              {cap}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {meta?.category}
                            </span>
                            {isReadOnly && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Lock className="w-2.5 h-2.5" />
                                Blindado
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {meta?.description || 'Sin descripción'}
                          </p>
                        </td>

                        {/* ROOT: Siempre activo */}
                        <td className="py-3 px-4 text-center bg-amber-950/10 border-x border-slate-800">
                          <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300" title="ROOT siempre conserva todas las capacidades">
                            <Check className="w-4 h-4 font-bold" />
                          </div>
                        </td>

                        {/* ADMIN */}
                        <td className="py-3 px-4 text-center">
                          {isReadOnly ? (
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-600" title="Capacidad exclusiva de ROOT">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCapabilityRole(cap, 'ADMIN')}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                                assignedRoles.includes('ADMIN')
                                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30 hover:scale-105'
                                  : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                              }`}
                              title={assignedRoles.includes('ADMIN') ? 'Quitar a ADMIN' : 'Conceder a ADMIN'}
                            >
                              {assignedRoles.includes('ADMIN') ? (
                                <Check className="w-4 h-4 font-bold" />
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* SUPERVISOR */}
                        <td className="py-3 px-4 text-center">
                          {isReadOnly ? (
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-600" title="Capacidad exclusiva de ROOT">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCapabilityRole(cap, 'SUPERVISOR')}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                                assignedRoles.includes('SUPERVISOR')
                                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:scale-105'
                                  : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                              }`}
                              title={assignedRoles.includes('SUPERVISOR') ? 'Quitar a SUPERVISOR' : 'Conceder a SUPERVISOR'}
                            >
                              {assignedRoles.includes('SUPERVISOR') ? (
                                <Check className="w-4 h-4 font-bold" />
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* CONSULTA */}
                        <td className="py-3 px-4 text-center">
                          {isReadOnly ? (
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-600" title="Capacidad exclusiva de ROOT">
                              <Lock className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCapabilityRole(cap, 'CONSULTA')}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-all cursor-pointer ${
                                assignedRoles.includes('CONSULTA')
                                  ? 'bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-500/30 hover:scale-105'
                                  : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                              }`}
                              title={assignedRoles.includes('CONSULTA') ? 'Quitar a CONSULTA' : 'Conceder a CONSULTA'}
                            >
                              {assignedRoles.includes('CONSULTA') ? (
                                <Check className="w-4 h-4 font-bold" />
                              ) : (
                                <span className="text-xs">—</span>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: FUNCIONALIDADES GLOBALES (FEATURE TOGGLES)    */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle 1: Checadas Manuales */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Permitir Checadas Manuales
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    settings.allowManualPunches ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {settings.allowManualPunches ? 'Activo' : 'Suspendido'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Interruptor maestro global. Si se suspende, se bloquea el formulario de checadas olvidadas en todo el sistema.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowManualPunches}
                onChange={(e) => setSettings({ ...settings, allowManualPunches: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* Toggle 2: Exigir Motivo en Justificaciones */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Exigir Motivo al Justificar
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    settings.requireJustificationReason ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {settings.requireJustificationReason ? 'Obligatorio' : 'Opcional'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Obliga a los supervisores y administradores a redactar una observación o motivo al justificar faltas y retardos.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireJustificationReason}
                onChange={(e) => setSettings({ ...settings, requireJustificationReason: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* Toggle 3: Sincronización ADMS Automática */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Sincronización ADMS Automática
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    settings.autoSyncDeviceOnEmployeeChange ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {settings.autoSyncDeviceOnEmployeeChange ? 'Encolar' : 'Manual'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Encola comandos de actualización en los relojes ZKTeco automáticamente cada vez que se edita el PIN o estado de un empleado.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSyncDeviceOnEmployeeChange}
                onChange={(e) => setSettings({ ...settings, autoSyncDeviceOnEmployeeChange: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* Toggle 4: Exportaciones Masivas */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Exportaciones Masivas a CSV
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    settings.allowBatchExport ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {settings.allowBatchExport ? 'Permitido' : 'Restringido'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Permite descargar reportes masivos de nómina y asistencia en formato Excel/CSV a roles con acceso operativo.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowBatchExport}
                onChange={(e) => setSettings({ ...settings, allowBatchExport: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* Toggle 5: Modo Auditoría Estricta */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Modo Auditoría Estricta
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    settings.strictPunchesAudit ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {settings.strictPunchesAudit ? 'Estricto' : 'Estándar'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Almacena metadatos extendidos (IP, usuario actor, fecha y hora exacta de modificación) en cada justificación o checada manual.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.strictPunchesAudit}
                onChange={(e) => setSettings({ ...settings, strictPunchesAudit: e.target.checked })}
                className="w-5 h-5 rounded accent-amber-500 cursor-pointer mt-1"
              />
            </div>

            {/* Toggle 6: Mensaje de Mantenimiento Global */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Banner Informativo / Mantenimiento
                </h3>
                {settings.systemMaintenanceMessage.trim() && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    Visible en cabecera
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Escribe un mensaje que verán todos los usuarios conectados (deja vacío para ocultar):
              </p>
              <input
                type="text"
                value={settings.systemMaintenanceMessage}
                onChange={(e) => setSettings({ ...settings, systemMaintenanceMessage: e.target.value })}
                placeholder="Ej. Mantenimiento programado hoy a las 22:00 hrs..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'Guardando...' : 'Guardar Configuraciones'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: ACCIONES & DIAGNÓSTICO                        */}
      {/* ======================================================== */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          {/* Tarjetas de Diagnóstico */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Estado BD */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Base de Datos</span>
                <Database className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  systemStatus?.database.status === 'CONNECTED' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
                }`} />
                <span className="text-sm font-bold text-white font-mono">
                  {systemStatus?.database.status === 'CONNECTED' ? 'ONLINE' : 'ERROR'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">PostgreSQL</p>
            </div>

            {/* Total Usuarios */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Cuentas Sistema</span>
                <Users className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-base font-bold text-white font-mono pt-1">
                {systemStatus?.counts.totalUsers || 0}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                ROOT: {systemStatus?.counts.usersByRole['ROOT'] || 0} · ADM: {systemStatus?.counts.usersByRole['ADMIN'] || 0}
              </p>
            </div>

            {/* Empleados Activos */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Colaboradores</span>
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-base font-bold text-white font-mono pt-1">
                {systemStatus?.counts.activeEmployees || 0} / {systemStatus?.counts.totalEmployees || 0}
              </p>
              <p className="text-[10px] text-slate-400">Activos en nómina</p>
            </div>

            {/* Relojes ZKTeco */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Relojes Checadores</span>
                <Server className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-base font-bold text-white font-mono pt-1">
                {systemStatus?.counts.totalDevices || 0}
              </p>
              <p className="text-[10px] text-slate-400">ZKTeco MB160 ADMS</p>
            </div>

            {/* Comandos en Cola */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Cola ADMS</span>
                <Radio className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="text-base font-bold text-white font-mono pt-1">
                {systemStatus?.counts.pendingCommands || 0}
              </p>
              <p className="text-[10px] text-slate-400">Pendientes / error</p>
            </div>

            {/* Memoria y Uptime */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Uptime Node.js</span>
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-sm font-bold text-white font-mono pt-1">
                {systemStatus ? formatUptime(systemStatus.process.uptimeSeconds) : '—'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                RAM: {systemStatus?.process.memoryMb.rss || 0} MB
              </p>
            </div>
          </div>

          {/* Acciones Maestras Disponibles */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Acciones Operativas Críticas</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Acción 1: Purgar cola de comandos */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                    Purgar Comandos de Reloj Atascados
                  </h4>
                  <p className="text-xs text-slate-400">
                    Elimina de la tabla de comandos ADMS todas las órdenes pendientes, fallidas o con error para liberar la sincronización.
                  </p>
                </div>
                <button
                  onClick={handlePurgeCommands}
                  disabled={executingAction === 'purge'}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50"
                >
                  {executingAction === 'purge' ? 'Purgando...' : 'Purgar Cola'}
                </button>
              </div>

              {/* Acción 2: Forzar sincronización de dispositivos */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                    Forzar Verificación en Relojes (CHECK)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Encola órdenes CHECK directas para verificar la conectividad de los relojes checadores en su próxima conexión ADMS.
                  </p>
                </div>
                <button
                  onClick={handleForceDeviceSync}
                  disabled={executingAction === 'sync'}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50"
                >
                  {executingAction === 'sync' ? 'Encolando...' : 'Forzar Check'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 4: ASIGNACIÓN DE ROLES A USUARIOS                */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Gestión Directa de Roles de Cuentas</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Como ROOT, puedes asignar y cambiar el rol de cualquier cuenta en el sistema. El último ROOT activo está protegido contra degradación.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Correo Electrónico</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Rol Actual</th>
                    <th className="py-3 px-4 text-center w-48">Asignar Nuevo Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rootUsers.map((u) => {
                    const isSelf = u.id === user?.id
                    const isUpdating = updatingUserRoleId === u.id

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Tu cuenta
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-xs">
                          {u.email}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.active
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {u.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                              u.role === 'ROOT'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : u.role === 'ADMIN'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                : u.role === 'SUPERVISOR'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={u.role}
                            disabled={isUpdating}
                            onChange={(e) => handleChangeUserRole(u, e.target.value as Role)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer disabled:opacity-50"
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
