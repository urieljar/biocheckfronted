import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import TimePickerModal from '../components/TimePickerModal'
import CustomDatePicker from '../components/CustomDatePicker'
import {
  CalendarHeart,
  Plus,
  Filter,
  Calendar,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Clock,
  Pencil,
  Trash2,
  Search,
  Globe,
  MapPin,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Table as TableIcon,
} from 'lucide-react'

type ExceptionType =
  | 'HOLIDAY'
  | 'VACATION'
  | 'PERMISSION'
  | 'SICK_LEAVE'
  | 'SPECIAL_REST'
  | 'REDUCED_DAY'
  | 'SCHEDULE_CHANGE'

type ExceptionScope = 'GLOBAL' | 'EMPLOYEE' | 'DEPARTMENT' | 'AREA'

interface CalendarException {
  id: string
  name: string
  date: string
  type: ExceptionType
  scope: ExceptionScope
  description: string | null
  employeeId: string | null
  departmentId: string | null
  areaId: string | null
  scheduleId: string | null
  isWorkDay: boolean
  entryTime: string | null
  exitTime: string | null
  workMinutes: number | null
  active: boolean
  createdAt?: string
  updatedAt?: string
  employee?: { id: string; deviceUserId: string; name: string } | null
  department?: { id: string; code: string; name: string } | null
  area?: { id: string; code: string; name: string } | null
  schedule?: { id: string; name: string; type: string } | null
}

interface EmployeeOption {
  id: string
  deviceUserId: string
  name: string
}

interface CatalogOption {
  id: string
  code: string
  name: string
}

interface ScheduleOption {
  id: string
  name: string
  type: string
}

const TYPE_CONFIG: Record<
  ExceptionType,
  { label: string; badge: string; border: string; bg: string }
> = {
  HOLIDAY: {
    label: 'Día Festivo',
    badge: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    border: 'border-rose-500/30',
    bg: 'bg-rose-950/20',
  },
  VACATION: {
    label: 'Vacaciones',
    badge: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    border: 'border-blue-500/30',
    bg: 'bg-blue-950/20',
  },
  PERMISSION: {
    label: 'Permiso Especial',
    badge: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/20',
  },
  SICK_LEAVE: {
    label: 'Incapacidad Médica',
    badge: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
    border: 'border-purple-500/30',
    bg: 'bg-purple-950/20',
  },
  SPECIAL_REST: {
    label: 'Descanso Especial',
    badge: 'text-slate-300 bg-slate-800 border-slate-700',
    border: 'border-slate-700',
    bg: 'bg-slate-900',
  },
  REDUCED_DAY: {
    label: 'Jornada Reducida',
    badge: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
    border: 'border-orange-500/30',
    bg: 'bg-orange-950/20',
  },
  SCHEDULE_CHANGE: {
    label: 'Cambio de Horario',
    badge: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-950/20',
  },
}

const SCOPE_CONFIG: Record<
  ExceptionScope,
  { label: string; icon: typeof Globe; badge: string }
> = {
  GLOBAL: {
    label: 'Toda la Empresa',
    icon: Globe,
    badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
  EMPLOYEE: {
    label: 'Empleado Individual',
    icon: Users,
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  DEPARTMENT: {
    label: 'Departamento',
    icon: Building2,
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  AREA: {
    label: 'Área',
    icon: MapPin,
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  },
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const WEEKDAY_NAMES = [
  { short: 'Lun', long: 'Lunes' },
  { short: 'Mar', long: 'Martes' },
  { short: 'Mié', long: 'Miércoles' },
  { short: 'Jue', long: 'Jueves' },
  { short: 'Vie', long: 'Viernes' },
  { short: 'Sáb', long: 'Sábado' },
  { short: 'Dom', long: 'Domingo' },
]

export default function CalendarExceptionsPage() {
  const [exceptions, setExceptions] = useState<CalendarException[]>([])
  const [loading, setLoading] = useState(true)

  // Vista activa: 'CALENDAR' (Almanaque Mensual) o 'TABLE' (Tabla Tradicional)
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'TABLE'>('CALENDAR')

  // Navegación del Almanaque
  const [almanacYear, setAlmanacYear] = useState(() => new Date().getFullYear())
  const [almanacMonth, setAlmanacMonth] = useState(() => new Date().getMonth()) // 0 - 11

  // Catalogs
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [departments, setDepartments] = useState<CatalogOption[]>([])
  const [areas, setAreas] = useState<CatalogOption[]>([])
  const [schedules, setSchedules] = useState<ScheduleOption[]>([])

  // Filters
  const [filterType, setFilterType] = useState<string>('')
  const [filterScope, setFilterScope] = useState<string>('')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo, setFilterTo] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingException, setEditingException] = useState<CalendarException | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formIsRange, setFormIsRange] = useState(false)
  const [formType, setFormType] = useState<ExceptionType>('HOLIDAY')
  const [formScope, setFormScope] = useState<ExceptionScope>('GLOBAL')
  const [formDescription, setFormDescription] = useState('')
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [formAreaId, setFormAreaId] = useState('')
  const [formScheduleId, setFormScheduleId] = useState('')
  const [formIsWorkDay, setFormIsWorkDay] = useState(false)
  const [formEntryTime, setFormEntryTime] = useState('08:00')
  const [formExitTime, setFormExitTime] = useState('17:00')
  const [formWorkMinutes, setFormWorkMinutes] = useState<string>('480')

  // Contador de días seleccionados en modo rango
  const rangeDaysCount = useMemo(() => {
    if (!formIsRange || !formDate || !formEndDate) return 1
    if (formEndDate < formDate) return 0
    const start = new Date(formDate + 'T00:00:00')
    const end = new Date(formEndDate + 'T00:00:00')
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return Math.max(diff, 1)
  }, [formIsRange, formDate, formEndDate])

  // TimePickerModal integration for create/edit
  const [timePickerTarget, setTimePickerTarget] = useState<{
    field: 'entry' | 'exit'
    time: string
  } | null>(null)

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<CalendarException | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => {
      setFeedback(null)
    }, feedback.type === 'success' ? 4000 : 7000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Carga inicial
  const loadExceptions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.append('from', filterFrom)
      if (filterTo) params.append('to', filterTo)

      const res = await api.get<{ ok: boolean; data: CalendarException[] }>(
        `/calendar-exceptions?${params.toString()}`
      )
      setExceptions(res.data || [])
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al consultar calendario',
      })
    } finally {
      setLoading(false)
    }
  }

  // Cargar catálogos
  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const [empRes, deptRes, areaRes, schedRes] = await Promise.allSettled([
          api.get<{ ok: boolean; data: EmployeeOption[] }>('/employees?limit=100'),
          api.get<{ ok: boolean; data: CatalogOption[] }>('/catalogs/departments'),
          api.get<{ ok: boolean; data: CatalogOption[] }>('/catalogs/areas'),
          api.get<{ ok: boolean; data: ScheduleOption[] }>('/schedules'),
        ])

        if (empRes.status === 'fulfilled') setEmployees(empRes.value.data || [])
        if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data || [])
        if (areaRes.status === 'fulfilled') setAreas(areaRes.value.data || [])
        if (schedRes.status === 'fulfilled') setSchedules(schedRes.value.data || [])
      } catch (err) {
        console.error('Error al cargar catálogos:', err)
      }
    }

    fetchCatalogs()
    loadExceptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Abrir modal de creación (opcionalmente con fecha pre-seleccionada desde el almanaque)
  const handleOpenCreate = (initialDate?: string | unknown) => {
    const targetDate = typeof initialDate === 'string' ? initialDate : new Date().toISOString().slice(0, 10)
    setEditingException(null)
    setFormName('')
    setFormDate(targetDate)
    setFormEndDate(targetDate)
    setFormIsRange(false)
    setFormType('HOLIDAY')
    setFormScope('GLOBAL')
    setFormDescription('')
    setFormEmployeeId(employees[0]?.id || '')
    setFormDepartmentId(departments[0]?.id || '')
    setFormAreaId(areas[0]?.id || '')
    setFormScheduleId('')
    setFormIsWorkDay(false)
    setFormEntryTime('08:00')
    setFormExitTime('17:00')
    setFormWorkMinutes('480')
    setModalOpen(true)
  }

  // Controles de Navegación del Almanaque
  const handlePrevMonth = () => {
    setAlmanacMonth((prev) => {
      if (prev === 0) {
        setAlmanacYear((y) => y - 1)
        return 11
      }
      return prev - 1
    })
  }

  const handleNextMonth = () => {
    setAlmanacMonth((prev) => {
      if (prev === 11) {
        setAlmanacYear((y) => y + 1)
        return 0
      }
      return prev + 1
    })
  }

  const handleToday = () => {
    const now = new Date()
    setAlmanacYear(now.getFullYear())
    setAlmanacMonth(now.getMonth())
  }

  // Abrir modal de edición
  const handleOpenEdit = (exc: CalendarException) => {
    setEditingException(exc)
    setFormName(exc.name)
    setFormDate(exc.date)
    setFormEndDate(exc.date)
    setFormIsRange(false)
    setFormType(exc.type)
    setFormScope(exc.scope)
    setFormDescription(exc.description || '')
    setFormEmployeeId(exc.employeeId || employees[0]?.id || '')
    setFormDepartmentId(exc.departmentId || departments[0]?.id || '')
    setFormAreaId(exc.areaId || areas[0]?.id || '')
    setFormScheduleId(exc.scheduleId || '')
    setFormIsWorkDay(exc.isWorkDay)
    setFormEntryTime(exc.entryTime ? exc.entryTime.slice(0, 5) : '08:00')
    setFormExitTime(exc.exitTime ? exc.exitTime.slice(0, 5) : '17:00')
    setFormWorkMinutes(exc.workMinutes ? String(exc.workMinutes) : '480')
    setModalOpen(true)
  }

  // Cambio de Tipo de Excepción con auto-configuración de rango
  const handleTypeChange = (newType: ExceptionType) => {
    setFormType(newType)
    // Si selecciona vacaciones, incapacidad o permiso, activamos automáticamente modo rango y alcance individual
    if (newType === 'VACATION' || newType === 'SICK_LEAVE' || newType === 'PERMISSION') {
      setFormIsRange(true)
      if (!formEndDate || formEndDate < formDate) {
        setFormEndDate(formDate)
      }
      if (formScope === 'GLOBAL') {
        setFormScope('EMPLOYEE')
      }
    }
  }

  // Guardar (Crear o Actualizar)
  const handleSave = async (e: FormEvent) => {
    e.preventDefault()

    if (!formName.trim()) {
      setFeedback({ type: 'error', message: 'El nombre es obligatorio' })
      return
    }

    if (!formDate) {
      setFeedback({ type: 'error', message: 'La fecha es obligatoria' })
      return
    }

    if (formIsRange && !formEndDate) {
      setFeedback({ type: 'error', message: 'La fecha final del período es obligatoria' })
      return
    }

    if (formIsRange && formEndDate < formDate) {
      setFeedback({ type: 'error', message: 'La fecha final no puede ser anterior a la fecha de inicio' })
      return
    }

    if (formScope === 'EMPLOYEE' && !formEmployeeId) {
      setFeedback({ type: 'error', message: 'Selecciona un empleado para el alcance Empleado' })
      return
    }

    if (formScope === 'DEPARTMENT' && !formDepartmentId) {
      setFeedback({ type: 'error', message: 'Selecciona un departamento' })
      return
    }

    if (formScope === 'AREA' && !formAreaId) {
      setFeedback({ type: 'error', message: 'Selecciona un área' })
      return
    }

    setSaving(true)

    const payload = {
      name: formName.trim(),
      date: formDate,
      endDate: formIsRange ? formEndDate : formDate,
      type: formType,
      scope: formScope,
      description: formDescription.trim() || null,
      employeeId: formScope === 'EMPLOYEE' ? formEmployeeId : null,
      departmentId: formScope === 'DEPARTMENT' ? formDepartmentId : null,
      areaId: formScope === 'AREA' ? formAreaId : null,
      scheduleId: formScheduleId || null,
      isWorkDay: formIsWorkDay,
      entryTime: formIsWorkDay ? formEntryTime : null,
      exitTime: formIsWorkDay ? formExitTime : null,
      workMinutes: formIsWorkDay && formWorkMinutes ? Number(formWorkMinutes) : null,
    }

    try {
      if (editingException) {
        await api.patch<{ ok: boolean; message: string; data: CalendarException }>(
          `/calendar-exceptions/${editingException.id}`,
          payload
        )
        setFeedback({
          type: 'success',
          message: 'Incidencia actualizada correctamente',
        })
      } else {
        const res = await api.post<{ ok: boolean; message: string; data: CalendarException; count?: number }>(
          '/calendar-exceptions',
          payload
        )
        setFeedback({
          type: 'success',
          message: res.message || 'Incidencia registrada en el calendario correctamente',
        })
      }

      setModalOpen(false)
      loadExceptions()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al guardar incidencia',
      })
    } finally {
      setSaving(false)
    }
  }

  // Eliminar (soft-delete)
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      await api.delete(`/calendar-exceptions/${deleteTarget.id}`)
      setFeedback({
        type: 'success',
        message: `Incidencia "${deleteTarget.name}" desactivada correctamente`,
      })
      setDeleteTarget(null)
      loadExceptions()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al desactivar incidencia',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Filtrado en el cliente para type, scope y search
  const filteredExceptions = exceptions.filter((exc) => {
    if (filterType && exc.type !== filterType) return false
    if (filterScope && exc.scope !== filterScope) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      const matchName = exc.name.toLowerCase().includes(term)
      const matchDesc = exc.description?.toLowerCase().includes(term) || false
      const matchEmp = exc.employee?.name.toLowerCase().includes(term) || false
      const matchDept = exc.department?.name.toLowerCase().includes(term) || false
      if (!matchName && !matchDesc && !matchEmp && !matchDept) return false
    }
    return true
  })

  // Limpiar filtros
  const handleClearFilters = () => {
    setFilterType('')
    setFilterScope('')
    setFilterFrom('')
    setFilterTo('')
    setSearchTerm('')
    setTimeout(() => {
      loadExceptions()
    }, 0)
  }

  // Estructura de celdas para la cuadrícula del Almanaque
  interface CalendarDayCell {
    dateStr: string
    dayNumber: number
    isCurrentMonth: boolean
    isToday: boolean
    isWeekend: boolean
    exceptions: CalendarException[]
  }

  // Cuadrícula completa de 35 o 42 días para el mes visible
  const almanacGrid = useMemo<CalendarDayCell[]>(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const firstDay = new Date(almanacYear, almanacMonth, 1)
    const rawDayOfWeek = firstDay.getDay()
    const firstDayIndex = (rawDayOfWeek + 6) % 7 // Lunes = 0, Domingo = 6

    const daysInCurrentMonth = new Date(almanacYear, almanacMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(almanacYear, almanacMonth, 0).getDate()

    const exceptionsByDate = new Map<string, CalendarException[]>()
    for (const exc of filteredExceptions) {
      if (!exc.date) continue
      const list = exceptionsByDate.get(exc.date) || []
      list.push(exc)
      exceptionsByDate.set(exc.date, list)
    }

    const cells: CalendarDayCell[] = []

    // 1. Días de relleno mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevDate = new Date(almanacYear, almanacMonth - 1, dayNum)
      const y = prevDate.getFullYear()
      const m = String(prevDate.getMonth() + 1).padStart(2, '0')
      const d = String(dayNum).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const dayOfWeek = prevDate.getDay()

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        exceptions: exceptionsByDate.get(dateStr) || [],
      })
    }

    // 2. Días del mes actual
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const m = String(almanacMonth + 1).padStart(2, '0')
      const d = String(dayNum).padStart(2, '0')
      const dateStr = `${almanacYear}-${m}-${d}`
      const dayOfWeek = new Date(almanacYear, almanacMonth, dayNum).getDay()

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        exceptions: exceptionsByDate.get(dateStr) || [],
      })
    }

    // 3. Días de relleno mes siguiente (para completar múltiplo de 7)
    const totalCells = cells.length > 35 ? 42 : 35
    const remaining = totalCells - cells.length
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(almanacYear, almanacMonth + 1, dayNum)
      const y = nextDate.getFullYear()
      const m = String(nextDate.getMonth() + 1).padStart(2, '0')
      const d = String(dayNum).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const dayOfWeek = nextDate.getDay()

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        exceptions: exceptionsByDate.get(dateStr) || [],
      })
    }

    return cells
  }, [almanacYear, almanacMonth, filteredExceptions])

  // Métricas de incidencias del mes seleccionado
  const monthlyMetrics = useMemo(() => {
    const monthPrefix = `${almanacYear}-${String(almanacMonth + 1).padStart(2, '0')}`
    const inMonth = filteredExceptions.filter((e) => e.date?.startsWith(monthPrefix))

    let holidays = 0
    let vacations = 0
    let permissions = 0
    let sickLeaves = 0
    let others = 0

    for (const exc of inMonth) {
      if (exc.type === 'HOLIDAY') holidays++
      else if (exc.type === 'VACATION') vacations++
      else if (exc.type === 'PERMISSION') permissions++
      else if (exc.type === 'SICK_LEAVE') sickLeaves++
      else others++
    }

    return {
      total: inMonth.length,
      holidays,
      vacations,
      permissions,
      sickLeaves,
      others,
    }
  }, [almanacYear, almanacMonth, filteredExceptions])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarHeart className="w-6 h-6 text-rose-400" />
            <span>Incidencias / Vacaciones / Festivos</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de días inhábiles, vacaciones, permisos e incapacidades para cálculo de nómina
          </p>
        </div>

        <button
          onClick={() => handleOpenCreate()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md shadow-amber-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Incidencia</span>
        </button>
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

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Búsqueda por texto */}
          <div className="lg:col-span-4 flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 rounded-xl h-10 focus-within:border-amber-500/70">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, empleado o descripción..."
              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por Tipo */}
          <div className="lg:col-span-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Alcance */}
          <div className="lg:col-span-3">
            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">Todos los alcances</option>
              {Object.entries(SCOPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de acción de filtros */}
          <div className="lg:col-span-2 flex items-center gap-2">
            {(filterType || filterScope || filterFrom || filterTo || searchTerm) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer w-full justify-center h-10"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadExceptions}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50 h-10 flex items-center justify-center"
              title="Recargar"
            >
              <Filter className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtro secundario de fechas */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium">Filtrar por rango:</span>

          {/* Desde */}
          <div className="w-44">
            <CustomDatePicker
              innerLabel="DESDE"
              value={filterFrom}
              onChange={(val) => setFilterFrom(val)}
              accentColor="indigo"
              clearable
            />
          </div>

          {/* Hasta */}
          <div className="w-44">
            <CustomDatePicker
              innerLabel="HASTA"
              value={filterTo}
              minDate={filterFrom}
              onChange={(val) => setFilterTo(val)}
              accentColor="indigo"
              clearable
            />
          </div>

          {(filterFrom || filterTo) && (
            <button
              onClick={() => {
                setFilterFrom('')
                setFilterTo('')
                setTimeout(loadExceptions, 0)
              }}
              className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Quitar fechas
            </button>
          )}

          <span className="text-[11px] text-slate-500 ml-auto">
            {filteredExceptions.length} de {exceptions.length} incidencias registradas
          </span>
        </div>
      </div>

      {/* Selector de Modo de Vista (Almanaque vs Tabla) y Barra de Navegación del Mes */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        {/* Pestañas de Vista */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'CALENDAR'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Vista Almanaque</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('TABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'TABLE'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>Vista Tabla</span>
          </button>
        </div>

        {/* Controles de Navegación del Mes (Visibles en modo Almanaque) */}
        {viewMode === 'CALENDAR' ? (
          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end flex-1">
            {/* Botones de navegación Anterior / Hoy / Siguiente */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Ir al mes actual"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Selectores de Mes y Año */}
            <div className="flex items-center gap-2">
              <select
                value={almanacMonth}
                onChange={(e) => setAlmanacMonth(Number(e.target.value))}
                className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={almanacYear}
                onChange={(e) => setAlmanacYear(Number(e.target.value))}
                className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Contadores del mes activo */}
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800 flex-wrap">
              <span className="text-[11px] font-bold text-slate-300 mr-0.5">
                {monthlyMetrics.total} en {MONTH_NAMES[almanacMonth]}:
              </span>
              {monthlyMetrics.holidays > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300">
                  {monthlyMetrics.holidays} Festivos
                </span>
              )}
              {monthlyMetrics.vacations > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                  {monthlyMetrics.vacations} Vacaciones
                </span>
              )}
              {monthlyMetrics.permissions > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  {monthlyMetrics.permissions} Permisos
                </span>
              )}
              {monthlyMetrics.sickLeaves > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  {monthlyMetrics.sickLeaves} Incapacidades
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-medium self-center">
            Mostrando {filteredExceptions.length} incidencias en formato lista
          </div>
        )}
      </div>

      {/* RENDERIZADO CONDICIONAL: VISTA ALMANAQUE vs VISTA TABLA */}
      {viewMode === 'CALENDAR' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-sm space-y-3">
          {/* Encabezado del Mes en Almanaque */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>{MONTH_NAMES[almanacMonth]}</span>
                <span className="text-amber-400 font-mono font-extrabold">{almanacYear}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                💡 Haz clic en cualquier día para registrar una incidencia o sobre cualquier tarjeta para verla / editarla
              </p>
            </div>

            {/* Leyenda rápida de colores */}
            <div className="flex items-center gap-2 flex-wrap text-[10px]">
              <span className="inline-flex items-center gap-1 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Festivo</span>
              </span>
              <span className="inline-flex items-center gap-1 text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>Vacaciones</span>
              </span>
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Permiso</span>
              </span>
              <span className="inline-flex items-center gap-1 text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Incapacidad</span>
              </span>
            </div>
          </div>

          {/* Cuadrícula del Calendario Mensual */}
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <div className="min-w-[720px]">
              {/* Encabezados de Días de la Semana (Lunes a Domingo) */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-bold uppercase tracking-wider">
                {WEEKDAY_NAMES.map((w, idx) => (
                  <div
                    key={w.short}
                    className={`py-2 px-1 rounded-xl border ${
                      idx >= 5
                        ? 'bg-slate-950/70 border-slate-800/60 text-slate-500'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="hidden sm:inline">{w.long}</span>
                    <span className="sm:hidden">{w.short}</span>
                  </div>
                ))}
              </div>

              {/* Matriz de Celdas de Días */}
              {loading ? (
                <div className="py-24 text-center text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-500 mb-2" />
                  <span className="text-sm">Cargando almanaque de incidencias...</span>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {almanacGrid.map((cell) => (
                    <div
                      key={cell.dateStr}
                      onClick={() => handleOpenCreate(cell.dateStr)}
                      className={`group relative flex flex-col p-2 rounded-xl border transition-all duration-150 min-h-[125px] cursor-pointer select-none ${
                        !cell.isCurrentMonth
                          ? 'bg-slate-950/40 border-slate-900/60 opacity-35 hover:opacity-75'
                          : cell.isToday
                          ? 'bg-amber-950/15 border-amber-500/50 shadow-sm shadow-amber-500/10 hover:border-amber-400'
                          : cell.isWeekend
                          ? 'bg-slate-950/60 border-slate-800/60 hover:border-slate-700'
                          : 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Cabecera del Día */}
                      <div className="flex items-center justify-between mb-1.5 pointer-events-none">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-mono font-bold ${
                              cell.isToday
                                ? 'w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm'
                                : cell.isCurrentMonth
                                ? 'text-slate-200'
                                : 'text-slate-600'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {cell.isToday && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400">
                              Hoy
                            </span>
                          )}
                        </div>

                        {/* Botón rápido "+" al hacer hover */}
                        <span
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all pointer-events-auto"
                          title={`Registrar incidencia para el ${cell.dateStr}`}
                        >
                          <Plus className="w-3 h-3" />
                        </span>
                      </div>

                      {/* Tarjetas de Incidencias en este día */}
                      <div
                        className="flex-1 flex flex-col gap-1 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {cell.exceptions.slice(0, 3).map((exc) => {
                          const typeCfg = TYPE_CONFIG[exc.type] || {
                            label: exc.type,
                            badge: 'text-slate-300 bg-slate-800 border-slate-700',
                            bg: 'bg-slate-900',
                            border: 'border-slate-700',
                          }
                          const scopeCfg = SCOPE_CONFIG[exc.scope]
                          const ScopeIcon = scopeCfg?.icon || Globe

                          return (
                            <div
                              key={exc.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEdit(exc)
                              }}
                              className={`px-2 py-1 rounded-lg border text-[11px] leading-tight flex flex-col gap-0.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm ${typeCfg.bg} ${typeCfg.border} hover:border-amber-400/70`}
                              title={`${exc.name} (${typeCfg.label}) • Clic para ver / editar`}
                            >
                              {/* Renglón superior: Etiqueta de Tipo + Destino */}
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[10px] font-bold truncate ${typeCfg.badge.split(' ')[0]}`}>
                                  {typeCfg.label}
                                </span>
                                <div className="flex items-center gap-0.5 text-[9px] text-slate-400">
                                  <ScopeIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate max-w-[65px]">
                                    {exc.scope === 'EMPLOYEE'
                                      ? exc.employee?.name?.split(' ')[0] || 'Emp'
                                      : exc.scope === 'DEPARTMENT'
                                      ? exc.department?.name || 'Depto'
                                      : 'Global'}
                                  </span>
                                </div>
                              </div>

                              {/* Nombre de la Incidencia */}
                              <span className="font-semibold text-slate-100 truncate text-[11px]">
                                {exc.name}
                              </span>

                              {/* Horario si es jornada laborable */}
                              {exc.isWorkDay && exc.entryTime && exc.exitTime && (
                                <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span>
                                    {exc.entryTime.slice(0, 5)} - {exc.exitTime.slice(0, 5)}
                                  </span>
                                </span>
                              )}
                            </div>
                          )
                        })}

                        {/* Píldora de eventos adicionales si hay más de 3 */}
                        {cell.exceptions.length > 3 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFilterFrom(cell.dateStr)
                              setFilterTo(cell.dateStr)
                              setViewMode('TABLE')
                            }}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded text-left transition-colors cursor-pointer"
                            title="Ver todas las incidencias de este día en la tabla"
                          >
                            + {cell.exceptions.length - 3} más...
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Exceptions Table */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Fecha</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Incidencia</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Tipo</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Alcance / Destino</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">¿Es Laboral?</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Estado</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                      <span>Cargando incidencias del calendario...</span>
                    </td>
                  </tr>
                ) : filteredExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No se encontraron incidencias registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredExceptions.map((exc) => {
                    const typeCfg = TYPE_CONFIG[exc.type] || {
                      label: exc.type,
                      badge: 'text-slate-300 bg-slate-800 border-slate-700',
                    }
                    const scopeCfg = SCOPE_CONFIG[exc.scope] || {
                      label: exc.scope,
                      icon: Globe,
                      badge: 'text-slate-400',
                    }
                    const ScopeIcon = scopeCfg.icon

                    return (
                      <tr key={exc.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Fecha */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap font-mono text-xs">
                          <span className="text-amber-300 font-semibold">{exc.date}</span>
                        </td>

                        {/* Nombre & Descripción */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 min-w-[140px]">
                          <div className="font-semibold text-slate-100">{exc.name}</div>
                          {exc.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {exc.description}
                            </div>
                          )}
                        </td>

                        {/* Tipo */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeCfg.badge}`}
                          >
                            {typeCfg.label}
                          </span>
                        </td>

                        {/* Alcance / Destino */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${scopeCfg.badge}`}
                            >
                              <ScopeIcon className="w-3 h-3" />
                              {scopeCfg.label}
                            </span>
                            {exc.scope === 'EMPLOYEE' && exc.employee && (
                              <span className="text-xs text-slate-300 font-medium">
                                ({exc.employee.name})
                              </span>
                            )}
                            {exc.scope === 'DEPARTMENT' && exc.department && (
                              <span className="text-xs text-slate-300 font-medium">
                                ({exc.department.name})
                              </span>
                            )}
                            {exc.scope === 'AREA' && exc.area && (
                              <span className="text-xs text-slate-300 font-medium">
                                ({exc.area.name})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Es Laborable */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap text-xs">
                          {exc.isWorkDay ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Laborable ({exc.entryTime?.slice(0, 5)} - {exc.exitTime?.slice(0, 5)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400 border border-slate-700">
                              Inhábil / No laborable
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap text-xs">
                          {exc.active ? (
                            <span className="text-emerald-400 font-medium">Activa</span>
                          ) : (
                            <span className="text-slate-500">Inactiva</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(exc)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Editar incidencia"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(exc)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Desactivar / Eliminar incidencia"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <CalendarHeart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {editingException ? 'Editar Incidencia de Calendario' : 'Nueva Incidencia / Festivo'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Configuración de días especiales que afectan el cálculo de asistencia
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="exception-form" onSubmit={handleSave} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Nombre de la incidencia <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Día de la Independencia, Vacaciones de Verano, etc."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500 h-9"
                  />
                </div>

                {/* Tipo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Tipo de Excepción <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value as ExceptionType)}
                    className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alcance (Scope) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Alcance / Cobertura <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as ExceptionScope)}
                    className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                  >
                    <option value="GLOBAL">Global (Toda la Empresa)</option>
                    <option value="EMPLOYEE">Empleado Individual</option>
                    <option value="DEPARTMENT">Por Departamento</option>
                    <option value="AREA">Por Área</option>
                  </select>
                </div>

                {/* Destino Condicional según Alcance */}
                {formScope === 'EMPLOYEE' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Empleado <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                    >
                      <option value="">Selecciona un empleado...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          [{emp.deviceUserId}] {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formScope === 'DEPARTMENT' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Departamento <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formDepartmentId}
                      onChange={(e) => setFormDepartmentId(e.target.value)}
                      className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                    >
                      <option value="">Selecciona un departamento...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formScope === 'AREA' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-200">
                      Área <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formAreaId}
                      onChange={(e) => setFormAreaId(e.target.value)}
                      className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                    >
                      <option value="">Selecciona un área...</option>
                      {areas.map((ar) => (
                        <option key={ar.id} value={ar.id}>
                          {ar.name} ({ar.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Modalidad de Duración: Día Único vs Rango/Período */}
                {!editingException && (
                  <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Duración de la Incidencia
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formIsRange
                          ? 'Período continuo de varios días (ej. Vacaciones, Incapacidad médica, Permisos)'
                          : 'Un solo día puntual (ej. Festivo oficial, descanso o día especial)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setFormIsRange(false)
                          setFormEndDate(formDate)
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          !formIsRange
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Día Único
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormIsRange(true)
                          if (!formEndDate || formEndDate < formDate) {
                            setFormEndDate(formDate)
                          }
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          formIsRange
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Período / Rango
                      </button>
                    </div>
                  </div>
                )}

                {/* Selección de Fechas */}
                {!formIsRange ? (
                  <div className="sm:col-span-2">
                    <CustomDatePicker
                      label="Fecha de la Incidencia *"
                      value={formDate}
                      onChange={setFormDate}
                      required
                      accentColor="amber"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <CustomDatePicker
                        label="Fecha de Inicio *"
                        value={formDate}
                        onChange={(val) => {
                          setFormDate(val)
                          if (formEndDate && formEndDate < val) {
                            setFormEndDate(val)
                          }
                        }}
                        required
                        accentColor="amber"
                      />
                      <CustomDatePicker
                        label="Fecha de Fin *"
                        value={formEndDate}
                        minDate={formDate}
                        onChange={setFormEndDate}
                        required
                        accentColor="amber"
                      />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs">
                      <span className="text-amber-300 font-medium flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Duración total del período:
                      </span>
                      <span className="font-bold text-amber-200 font-mono bg-amber-500/20 px-2 py-0.5 rounded-md">
                        {rangeDaysCount} {rangeDaysCount === 1 ? 'día seleccionado' : 'días seleccionados'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Horario asociado opcional */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Horario de referencia opcional
                  </label>
                  <select
                    value={formScheduleId}
                    onChange={(e) => setFormScheduleId(e.target.value)}
                    className="w-full px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9 cursor-pointer"
                  >
                    <option value="">Sin horario específico vinculado</option>
                    {schedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} ({sch.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Descripción / Motivo (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detalles adicionales, justificación legal o acuerdo interno..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500 resize-none"
                  />
                </div>

                {/* Configuración de Día Laboral */}
                <div className="sm:col-span-2 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">
                        ¿Es una jornada con labor / trabajo?
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Marca esta casilla si en este día se debe laborar con un horario especial o reducido
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsWorkDay}
                        onChange={(e) => setFormIsWorkDay(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {formIsWorkDay && (
                    <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
                      {/* Hora Entrada */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-amber-300">
                          Hora Entrada
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setTimePickerTarget({ field: 'entry', time: formEntryTime })
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-amber-500/30 rounded-lg text-xs font-mono font-bold text-amber-300 flex items-center justify-between hover:bg-slate-850 cursor-pointer h-9"
                        >
                          <span>{formEntryTime}</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      </div>

                      {/* Hora Salida */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-indigo-300">
                          Hora Salida
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setTimePickerTarget({ field: 'exit', time: formExitTime })
                          }
                          className="w-full px-3 py-1.5 bg-slate-900 border border-indigo-500/30 rounded-lg text-xs font-mono font-bold text-indigo-300 flex items-center justify-between hover:bg-slate-850 cursor-pointer h-9"
                        >
                          <span>{formExitTime}</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      </div>

                      {/* Minutos */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Minutos de Jornada
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={formWorkMinutes}
                          onChange={(e) => setFormWorkMinutes(e.target.value)}
                          className="w-full px-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="exception-form"
                disabled={saving}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-amber-600/25 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{editingException ? 'Guardar Cambios' : 'Crear Incidencia'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">¿Desactivar esta incidencia?</h4>
                <p className="text-xs text-slate-400">Esta acción no borrará los cálculos pasados</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs space-y-1">
              <p className="text-slate-200 font-semibold">{deleteTarget.name}</p>
              <p className="text-slate-400 font-mono">Fecha: {deleteTarget.date}</p>
              <p className="text-slate-400">Tipo: {TYPE_CONFIG[deleteTarget.type]?.label || deleteTarget.type}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-rose-600/25 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirmar Desactivación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Picker Modal for isWorkDay entry/exit times */}
      {timePickerTarget && (
        <TimePickerModal
          isOpen={Boolean(timePickerTarget)}
          title={timePickerTarget.field === 'entry' ? 'Hora de Entrada' : 'Hora de Salida'}
          dayName="Jornada Especial"
          type={timePickerTarget.field}
          initialTime={timePickerTarget.time}
          onConfirm={(selected24h) => {
            if (timePickerTarget.field === 'entry') {
              setFormEntryTime(selected24h)
            } else {
              setFormExitTime(selected24h)
            }
            setTimePickerTarget(null)
          }}
          onClose={() => setTimePickerTarget(null)}
        />
      )}
    </div>
  )
}
