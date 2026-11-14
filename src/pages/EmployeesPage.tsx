import { useState, useEffect, useRef, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import EmployeeProfileForm from '../components/EmployeeProfileForm'
import EmployeeLifecycleDialog, { type LaborAction } from '../components/EmployeeLifecycleDialog'
import { EMPTY_EMPLOYEE_PROFILE as EMPTY_PROFILE, type EmployeeProfileData } from '../lib/employee-profile'
import {
  Users,
  Search,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Edit2,
  Send,
  X,
  Radio,
  Contact,
} from 'lucide-react'

interface Device {
  id: string
  name: string
  ip: string
}

interface Employee {
  id: string
  deviceId: string
  deviceUserId: string
  deviceUid: number | null
  name: string
  deviceRole: number
  deviceRoleName?: string
  devicePin: string | null
  cardNumber: string | null
  active: boolean
  deletedAt?: string | null
  profile?: { employmentStatus?: string | null; hireDate?: string | null; terminationDate?: string | null; terminationReason?: string | null }
  deviceSyncStatus: 'PENDING' | 'SYNCED' | 'ERROR'
  deviceSyncError: string | null
  deviceSyncedAt: string | null
  device?: Device
}

interface CatalogOption {
  id: string
  code: string
  name: string
}

interface EmployeesResponse {
  ok: boolean
  data: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ClockPresenceResult {
  device: { id: string; name: string }
  checkedAt: string
  clockUsers: number
  total: number
  found: number
  missing: number
  employees: { id: string; deviceUserId: string; name: string; present: boolean }[]
}

export default function EmployeesPage() {
  const { user } = useAuth()
  // El rol CONSULTA ve la plantilla pero no captura ni envía nada al checador.
  const canWrite = can(user?.role, 'employee.write')
  const canReadPin = can(user?.role, 'employee.pin.read')
  const canChangeStatus = can(user?.role, 'employee.status')
  const canDelete = can(user?.role, 'employee.delete')
  const [laborFilter, setLaborFilter] = useState('ACTIVE')
  const [laborAction, setLaborAction] = useState<{ employee: Employee; action: LaborAction } | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Catalogs for profile
  const [departments, setDepartments] = useState<CatalogOption[]>([])
  const [positions, setPositions] = useState<CatalogOption[]>([])
  const [areas, setAreas] = useState<CatalogOption[]>([])

  // Modals & form state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [hasExistingProfile, setHasExistingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [syncingAllPending, setSyncingAllPending] = useState(false)
  const [verifyingClock, setVerifyingClock] = useState(false)
  const [clockPresence, setClockPresence] = useState<ClockPresenceResult | null>(null)
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'missing'>('all')
  const employeeRequest = useRef(0)
  const presenceById = new Map(clockPresence?.employees.map((employee) => [employee.id, employee.present]))

  const handleVerifyClock = async () => {
    setPresenceFilter('all')
    setPage(1)
    setVerifyingClock(true)
    setClockPresence(null)
    setFeedback(null)
    try {
      const response = await api.post<{ ok: boolean; data: ClockPresenceResult }>('/devices/verify-employees', {})
      setClockPresence(response.data)
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No fue posible verificar los empleados en el reloj' })
    } finally {
      setVerifyingClock(false)
    }
  }

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

  // Form fields
  const [formData, setFormData] = useState({
    deviceUserId: '',
    name: '',
    deviceRole: 0,
    devicePin: '',
    cardNumber: '',
    deviceUid: '',
  })

  const [profileForm, setProfileForm] = useState<EmployeeProfileData>(EMPTY_PROFILE)

  const loadEmployees = async (pageNum = page, searchQuery = search, filter = presenceFilter, snapshot = clockPresence, status = laborFilter) => {
    const requestId = ++employeeRequest.current
    setLoading(true)
    try {
      if (filter === 'missing' && snapshot) {
        const query = searchQuery.trim().toLocaleLowerCase('es-MX')
        const missing = snapshot.employees.filter((employee) => !employee.present &&
          (!query || employee.name.toLocaleLowerCase('es-MX').includes(query) || employee.deviceUserId.includes(query)))
        const records = await Promise.all(missing.slice((pageNum - 1) * 15, pageNum * 15)
          .map((employee) => api.get<{ data: Employee }>(`/employees/${employee.id}`)))
        if (requestId !== employeeRequest.current) return
        setEmployees(records.map((response) => response.data))
        setTotalPages(Math.max(1, Math.ceil(missing.length / 15)))
        setTotal(missing.length)
        return
      }
      const queryParams = new URLSearchParams({
        page: String(pageNum),
        limit: '15',
        laborStatus: status,
        ...(searchQuery ? { search: searchQuery } : {}),
      })
      const res = await api.get<EmployeesResponse>(`/employees?${queryParams.toString()}`)
      if (requestId !== employeeRequest.current) return
      setEmployees(res.data)
      setTotalPages(res.pagination.totalPages || 1)
      setTotal(res.pagination.total || 0)
    } catch (err) {
      if (requestId !== employeeRequest.current) return
      setEmployees([])
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar empleados',
      })
    } finally {
      if (requestId === employeeRequest.current) setLoading(false)
    }
  }

  const loadCatalogs = async () => {
    try {
      const [depRes, posRes, areaRes] = await Promise.allSettled([
        api.get<{ ok: boolean; data: CatalogOption[] }>('/catalogs/departments'),
        api.get<{ ok: boolean; data: CatalogOption[] }>('/catalogs/positions'),
        api.get<{ ok: boolean; data: CatalogOption[] }>('/catalogs/areas'),
      ])
      if (depRes.status === 'fulfilled') setDepartments(depRes.value.data)
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data)
      if (areaRes.status === 'fulfilled') setAreas(areaRes.value.data)
    } catch {
      // Ignorar error secundario
    }
  }

  useEffect(() => {
    loadEmployees(page, search)
    loadCatalogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, presenceFilter, clockPresence, laborFilter])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadEmployees(1, search)
  }

  const handleLaborSaved = (message: string) => {
    const status = laborAction?.action === 'terminate' ? 'TERMINATED' : laborAction?.action === 'archive' ? 'DELETED' : 'ACTIVE'
    setLaborAction(null)
    setLaborFilter(status)
    setPresenceFilter('all')
    setClockPresence(null)
    setPage(1)
    setFeedback({ type: 'success', message })
    loadEmployees(1, search, 'all', null, status)
  }

  const handleOpenCreate = () => {
    setFormData({
      deviceUserId: '',
      name: '',
      deviceRole: 0,
      devicePin: '',
      cardNumber: '',
      deviceUid: '',
    })
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp)
    setFormData({
      deviceUserId: emp.deviceUserId,
      name: emp.name,
      deviceRole: emp.deviceRole,
      devicePin: emp.devicePin || '',
      cardNumber: emp.cardNumber || '',
      deviceUid: emp.deviceUid ? String(emp.deviceUid) : '',
    })
    setIsEditOpen(true)
  }

  const handleOpenProfile = async (emp: Employee) => {
    setProfileError('')
    setSelectedEmployee(emp)
    setActionLoading(`profile-${emp.id}`)
    setProfileForm(EMPTY_PROFILE)
    setHasExistingProfile(false)

    try {
      const res = await api.get<{ ok: boolean; data: EmployeeProfileData | null }>(
        `/employees/${emp.id}/profile`
      )
      if (res.data) {
        setHasExistingProfile(true)
        setProfileForm(Object.fromEntries(
          Object.keys(EMPTY_PROFILE).map((key) => [key, res.data?.[key as keyof EmployeeProfileData] ?? ''])
        ) as unknown as EmployeeProfileData)
      } else {
        // Inicializar nombre si está disponible
        setProfileForm({
          ...EMPTY_PROFILE,
          firstName: emp.name,
          employeeNumber: emp.deviceUserId,
        })
      }
      setIsProfileOpen(true)
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No fue posible cargar el expediente' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateEmployee = async (e: FormEvent) => {
    e.preventDefault()
    setClockPresence(null)
    setPresenceFilter('all')
    setPage(1)
    setActionLoading('create')
    setFeedback(null)
    try {
      const payload = {
        deviceUserId: formData.deviceUserId.trim(),
        name: formData.name.trim(),
        deviceRole: Number(formData.deviceRole),
        ...(canReadPin ? { devicePin: formData.devicePin.trim() || null } : {}),
        cardNumber: formData.cardNumber.trim() || null,
        deviceUid: formData.deviceUid ? Number(formData.deviceUid) : null,
      }

      await api.post('/employees', payload)
      setFeedback({
        type: 'success',
        message: `Empleado "${payload.name}" guardado en la base de datos (pendiente de sincronizar).`,
      })
      setIsCreateOpen(false)
      loadEmployees(1, '', 'all', null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible crear el empleado',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleEditEmployee = async (e: FormEvent) => {
    e.preventDefault()
    setClockPresence(null)
    setPresenceFilter('all')
    setPage(1)
    if (!selectedEmployee) return
    setActionLoading('edit')
    setFeedback(null)
    try {
      const payload = {
        name: formData.name.trim(),
        deviceRole: Number(formData.deviceRole),
        ...(canReadPin ? { devicePin: formData.devicePin.trim() || null } : {}),
        cardNumber: formData.cardNumber.trim() || null,
        deviceUid: formData.deviceUid ? Number(formData.deviceUid) : null,
      }

      await api.patch(`/employees/${selectedEmployee.id}/device-settings`, payload)
      setFeedback({
        type: 'success',
        message: `Ajustes del empleado actualizados en la base de datos.`,
      })
      setIsEditOpen(false)
      loadEmployees(1, search, 'all', null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible actualizar el empleado',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return
    setActionLoading('save-profile')
    setProfileError('')
    setFeedback(null)

    try {
      const payload = Object.fromEntries(
        Object.keys(EMPTY_PROFILE).map((key) => [key, profileForm[key as keyof typeof EMPTY_PROFILE].trim() || null])
      )

      if (hasExistingProfile) {
        await api.patch(`/employees/${selectedEmployee.id}/profile`, payload)
      } else {
        await api.post(`/employees/${selectedEmployee.id}/profile`, payload)
      }

      setFeedback({
        type: 'success',
        message: `Expediente de ${selectedEmployee.name} actualizado exitosamente`,
      })
      setIsProfileOpen(false)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al guardar expediente',
      })
      setProfileError(err instanceof Error ? err.message : 'Error al guardar expediente')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSyncToDevice = async (id: string, name: string) => {
    setClockPresence(null)
    setPresenceFilter('all')
    setPage(1)
    setActionLoading(`sync-${id}`)
    setFeedback(null)
    try {
      await api.post(`/employees/${id}/sync-to-device`, {})
      setFeedback({
        type: 'success',
        message: `Empleado "${name}" sincronizado exitosamente al reloj por conexión directa.`,
      })
      loadEmployees(1, search, 'all', null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al sincronizar al reloj',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleQueueAdms = async (id: string, name: string) => {
    setClockPresence(null)
    setPresenceFilter('all')
    setPage(1)
    setActionLoading(`adms-${id}`)
    setFeedback(null)
    try {
      await api.post(`/employees/${id}/queue-adms-sync`, {})
      setFeedback({
        type: 'success',
        message: `Comando ADMS encolado para "${name}". Se aplicará cuando el reloj consulte el servidor.`,
      })
      loadEmployees(1, search, 'all', null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al encolar comando ADMS',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSyncAllPending = async () => {
    setClockPresence(null)
    setPresenceFilter('all')
    setPage(1)
    setSyncingAllPending(true)
    setFeedback(null)
    try {
      const res = await api.post<{ processed: number; message: string }>(
        '/employees/sync-pending-to-device',
        { limit: 10 }
      )
      setFeedback({
        type: 'success',
        message: res.message || `Procesados empleados pendientes`,
      })
      loadEmployees(1, search, 'all', null)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al sincronizar pendientes',
      })
    } finally {
      setSyncingAllPending(false)
    }
  }

  const roleLabel = (role: number) => {
    switch (role) {
      case 14:
        return 'Super Admin'
      case 12:
        return 'Admin Sistema'
      case 2:
        return 'Registrador'
      default:
        return 'Empleado'
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            <span>Gestión de Personal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Resultados: {total} empleados {presenceFilter === 'missing' && clockPresence ? 'no encontrados en el reloj' : 'en BioCheck'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && (
            <>
              <button
                onClick={handleVerifyClock}
                disabled={verifyingClock || syncingAllPending || actionLoading !== null}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl disabled:opacity-50"
                title="Consultar el reloj y comparar sus usuarios sin modificar empleados"
              >
                {verifyingClock ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>{verifyingClock ? 'Verificando reloj...' : 'Verificar en reloj'}</span>
              </button>
              <button
                onClick={handleSyncAllPending}
                disabled={syncingAllPending || verifyingClock}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                title="Sincronizar empleados en estado PENDING al checador"
              >
                <RefreshCw className={`w-4 h-4 ${syncingAllPending ? 'animate-spin' : ''}`} />
                <span>Sincronizar Pendientes</span>
              </button>

              <button
                onClick={handleOpenCreate}
                disabled={verifyingClock}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nuevo Empleado</span>
              </button>
            </>
          )}
        </div>
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

      {/* Search and Filters */}
      {clockPresence && (
        <section className={`rounded-2xl border p-4 ${clockPresence.missing ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <h3 className="font-semibold text-slate-100">Verificación: {clockPresence.device.name}</h3>
          <p className="text-sm text-slate-300 mt-1">{clockPresence.found} encontrados · {clockPresence.missing} no encontrados · {clockPresence.total} empleados comparados</p>
          <p className="text-xs text-slate-400 mt-2">Última lectura: {new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mazatlan', dateStyle: 'short', timeStyle: 'short' }).format(new Date(clockPresence.checkedAt))}. Resultado del reloj verificado; incluye todas las páginas de empleados de ese dispositivo.</p>
          {clockPresence.missing > 0 && <div className="mt-3"><p className="text-sm font-medium text-amber-300">No encontrados en el reloj:</p><ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">{clockPresence.employees.filter((employee) => !employee.present).map((employee) => <li key={employee.id} className="text-sm text-slate-200 break-words">{employee.name} <span className="text-xs text-slate-400">({employee.deviceUserId})</span></li>)}</ul><p className="text-xs text-slate-400 mt-3">La ausencia en el reloj no determina una baja laboral. Revisa cada caso antes de volver a enviarlo.</p></div>}
        </section>
      )}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="text-xs text-slate-400 flex flex-col gap-1.5 w-full sm:w-auto">Estado laboral
          <select value={laborFilter} onChange={(event) => { setLaborFilter(event.target.value); setPresenceFilter('all'); setPage(1) }} className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200">
            <option value="ACTIVE">Vigentes</option><option value="TERMINATED">Dados de baja</option><option value="ALL">Todos</option>{canDelete && <option value="DELETED">Eliminados</option>}
          </select>
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1.5 w-full sm:w-auto">
          Mostrar empleados
          <select
            value={clockPresence ? presenceFilter : 'all'}
            onChange={(event) => { setPresenceFilter(event.target.value as 'all' | 'missing'); if (event.target.value === 'missing') setLaborFilter('ALL'); setPage(1) }}
            className="w-full sm:w-auto bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200"
          >
            <option value="all">Todos los empleados</option>
            <option value="missing" disabled={!clockPresence}>No encontrados en el reloj{clockPresence ? ` (${clockPresence.missing})` : ' · verificar primero'}</option>
          </select>
        </label>
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o ID de checador..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </form>

        <button
          onClick={() => loadEmployees(page, search)}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          title="Recargar listado"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Employees Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">ID Checador</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Nombre</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Rol Reloj</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">PIN / Tarjeta</th>
                <th title="El estado de sincronización anterior no confirma que el empleado siga en el reloj" className="py-3 px-3 sm:py-3.5 sm:px-4">Estado Sinc.</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Presencia en reloj</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
                    <span>Cargando empleados...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No se encontraron empleados registrados.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className={`transition-colors ${presenceById.get(emp.id) === false ? 'bg-rose-500/5 hover:bg-rose-500/10' : 'hover:bg-slate-800/40'}`}>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      <div className="font-mono text-xs font-semibold text-blue-400">
                        {emp.deviceUserId}
                      </div>
                      {emp.deviceUid && (
                        <div className="text-[10px] text-slate-500">UID: {emp.deviceUid}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 font-medium text-slate-100">
                      <div>{emp.name}</div>
                      <div className={`text-xs mt-1 ${emp.deletedAt ? 'text-slate-500' : emp.profile?.employmentStatus === 'TERMINATED' ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {emp.deletedAt ? 'Eliminado · recuperable' : emp.profile?.employmentStatus === 'TERMINATED' ? `Baja: ${emp.profile.terminationDate || 'sin fecha'}` : 'Vigente'}
                      </div>
                      {presenceById.get(emp.id) === false && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-rose-300"><AlertCircle className="w-3.5 h-3.5" />No encontrado en el reloj</span>}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {roleLabel(emp.deviceRole)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-xs text-slate-400">
                      {canReadPin && <div>PIN: {emp.devicePin || '—'}</div>}
                      <div>Tarjeta: {emp.cardNumber || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      {emp.deviceSyncStatus === 'SYNCED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sincronizado</span>
                        </span>
                      )}
                      {emp.deviceSyncStatus === 'PENDING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pendiente</span>
                        </span>
                      )}
                      {emp.deviceSyncStatus === 'ERROR' && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          title={emp.deviceSyncError || 'Error al sincronizar'}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Error</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      <span title={clockPresence && presenceById.has(emp.id) ? `Según lectura del ${new Date(clockPresence.checkedAt).toLocaleString('es-MX', { timeZone: 'America/Mazatlan' })}` : 'Pulsa Verificar en reloj para consultar su presencia'} className={`inline-flex px-2.5 py-1 rounded-full text-xs border ${presenceById.get(emp.id) === true ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : presenceById.get(emp.id) === false ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {presenceById.get(emp.id) === true ? 'Encontrado' : presenceById.get(emp.id) === false ? 'No encontrado' : 'Sin verificar'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {canWrite && !emp.deletedAt ? (
                          <>
                        <button
                          onClick={() => handleOpenProfile(emp)}
                          disabled={actionLoading === `profile-${emp.id}`}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Expediente / Perfil del Empleado (Departamento, Puesto, Área)"
                        >
                          {actionLoading === `profile-${emp.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Contact className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleSyncToDevice(emp.id, emp.name)}
                          disabled={actionLoading === `sync-${emp.id}` || verifyingClock || emp.profile?.employmentStatus === 'TERMINATED'}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Sincronizar directamente por Socket TCP"
                        >
                          {actionLoading === `sync-${emp.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Radio className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleQueueAdms(emp.id, emp.name)}
                          disabled={actionLoading === `adms-${emp.id}` || verifyingClock || emp.profile?.employmentStatus === 'TERMINATED'}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Encolar comando ADMS (/iclock)"
                        >
                          {actionLoading === `adms-${emp.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Editar ajustes"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-500 px-2">
                            Solo lectura
                          </span>
                        )}
                        <select aria-label={`Más acciones para ${emp.name}`} value="" disabled={verifyingClock} onChange={(event) => { if (event.target.value) setLaborAction({ employee: emp, action: event.target.value as LaborAction }) }} className="max-w-36 rounded-lg bg-slate-800 border border-slate-700 p-1.5 text-xs text-slate-300">
                          <option value="">Más acciones</option>
                          {!emp.deletedAt && <option value="history">Historial laboral</option>}
                          {canChangeStatus && !emp.deletedAt && emp.profile?.employmentStatus !== 'TERMINATED' && <option value="terminate">Dar de baja</option>}
                          {canChangeStatus && !emp.deletedAt && emp.profile?.employmentStatus === 'TERMINATED' && <option value="rehire">Reingreso</option>}
                          {canDelete && !emp.deletedAt && <option value="archive">Eliminar registro</option>}
                          {canDelete && emp.deletedAt && <option value="restore">Recuperar registro</option>}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-3 sm:px-4 py-3 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              Página {page} de {totalPages} ({total} empleados)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-lg disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-lg disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {laborAction && <EmployeeLifecycleDialog key={`${laborAction.employee.id}-${laborAction.action}`} employee={laborAction.employee} action={laborAction.action} onClose={() => setLaborAction(null)} onSaved={handleLaborSaved} />}

      {/* Modal Expediente / Perfil del Empleado */}
      {isProfileOpen && selectedEmployee && (
        <EmployeeProfileForm
          employee={selectedEmployee} value={profileForm} onChange={setProfileForm}
          onSubmit={handleSaveProfile} onClose={() => setIsProfileOpen(false)}
          saving={actionLoading === 'save-profile'}
          error={profileError}
          departments={departments} positions={positions} areas={areas}
        />
      )}

      {/* Modal Crear Empleado */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Nuevo Empleado</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  ID en el Reloj (deviceUserId) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.deviceUserId}
                  onChange={(e) =>
                    setFormData({ ...formData, deviceUserId: e.target.value })
                  }
                  placeholder="Ej: 101"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Rol en el Reloj
                  </label>
                  <select
                    value={formData.deviceRole}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceRole: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm cursor-pointer"
                  >
                    <option value={0}>Empleado (0)</option>
                    <option value={2}>Registrador (2)</option>
                    <option value={12}>Admin Sistema (12)</option>
                    <option value={14}>Super Admin (14)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    UID Interno (Opcional)
                  </label>
                  <input
                    type="number"
                    value={formData.deviceUid}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceUid: e.target.value })
                    }
                    placeholder="1 - 65535"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {canReadPin && <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    PIN / Contraseña
                  </label>
                  <input
                    type="text"
                    value={formData.devicePin}
                    onChange={(e) =>
                      setFormData({ ...formData, devicePin: e.target.value })
                    }
                    placeholder="Solo dígitos"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>}

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Número de Tarjeta
                  </label>
                  <input
                    type="text"
                    value={formData.cardNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, cardNumber: e.target.value })
                    }
                    placeholder="Número de tarjeta"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'create' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Guardar Empleado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Empleado */}
      {isEditOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-400" />
                <span>Editar Empleado ({selectedEmployee.deviceUserId})</span>
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Rol en el Reloj
                  </label>
                  <select
                    value={formData.deviceRole}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceRole: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={0}>Empleado (0)</option>
                    <option value={2}>Registrador (2)</option>
                    <option value={12}>Admin Sistema (12)</option>
                    <option value={14}>Super Admin (14)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    UID Interno
                  </label>
                  <input
                    type="number"
                    value={formData.deviceUid}
                    onChange={(e) =>
                      setFormData({ ...formData, deviceUid: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {canReadPin && <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    PIN / Contraseña
                  </label>
                  <input
                    type="text"
                    value={formData.devicePin}
                    onChange={(e) =>
                      setFormData({ ...formData, devicePin: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>}

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Número de Tarjeta
                  </label>
                  <input
                    type="text"
                    value={formData.cardNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, cardNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'edit'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'edit' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
