import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import CustomDatePicker from '../components/CustomDatePicker'
import {
  Calculator,
  Calendar,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  CalendarCheck,
  AlertTriangle,
  UserCheck,
  UserX,
  Coffee,
  FileSpreadsheet,
  Building2,
  Briefcase,
  Search,
  X,
  Eye,
  ShieldCheck,
  Trash2,
  CalendarDays,
  Table as TableIcon,
} from 'lucide-react'

type CalcMode = 'INDIVIDUAL' | 'COMPANY' | 'DEPARTMENT'

interface EmployeeOption {
  id: string
  deviceUserId: string
  name: string
  active?: boolean
}

interface DepartmentOption {
  id: string
  code: string
  name: string
}

interface DayRule {
  dayType?: string
  entryTime?: string | null
  exitTime?: string | null
  workMinutes?: number | null
}

interface DayException {
  id?: string
  name: string
  type: string
  scope?: string
  description?: string | null
  isWorkDay?: boolean
  entryTime?: string | null
  exitTime?: string | null
  workMinutes?: number | null
}

interface PunchDetail {
  id?: string | number
  time: string
  recordTime?: string
  source?: 'DEVICE' | 'MANUAL' | string
}

interface DayCalculation {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'REST' | 'LATE' | 'EARLY_DEPARTURE' | 'INCOMPLETE'
  statuses?: string[]
  reason?: string
  exception?: DayException | null
  rule?: DayRule | null
  firstEntry?: string | null
  lastExit?: string | null
  punches: string[]
  punchDetails?: PunchDetail[]
  workedMinutes: number
}

interface JustifyTarget {
  employeeId: string
  employeeName: string
  deviceUserId: string
  date: string
  currentStatus: string
  currentStatuses?: string[]
  currentReason?: string
  existingException?: DayException | null
  rule?: DayRule | null
  workedMinutes?: number
  firstEntry?: string | null
  lastExit?: string | null
}

interface ManualPunchTarget {
  employeeId: string
  employeeName: string
  deviceUserId: string
  date: string
  currentStatus?: string
  currentStatuses?: string[]
  firstEntry?: string | null
  lastExit?: string | null
  rule?: DayRule | null
  punches?: string[]
  punchDetails?: PunchDetail[]
  isGlobal?: boolean
}

interface CalculationSummary {
  totalDays: number
  present: number
  absent: number
  excused: number
  rest: number
  late: number
  earlyDeparture: number
  incomplete: number
  workedMinutes?: number
  workedHoursFormatted?: string
}

interface CalculationData {
  employee: {
    id: string
    deviceUserId: string
    name: string
  }
  from: string
  to: string
  timeZone: string
  summary: CalculationSummary
  days: DayCalculation[]
}

interface CalculationResponse {
  ok: boolean
  data: CalculationData
  message?: string
}

interface BatchEmployeeItem {
  employee: {
    id: string
    deviceUserId: string
    name: string
    department?: { id: string; code: string; name: string } | null
    area?: { id: string; code: string; name: string } | null
    position?: { id: string; code: string; name: string } | null
  }
  summary: CalculationSummary & {
    workedMinutes: number
    workedHoursFormatted: string
  }
  days: DayCalculation[]
}

interface BatchCalculationData {
  from: string
  to: string
  timeZone: string
  scope: 'ALL' | 'DEPARTMENT'
  department?: { id: string; code: string; name: string } | null
  totalEmployees: number
  companySummary: {
    totalEmployees: number
    totalDaysEvaluated: number
    present: number
    absent: number
    late: number
    earlyDeparture: number
    incomplete: number
    excused: number
    rest: number
    totalWorkedMinutes: number
    totalWorkedHoursFormatted: string
  }
  employees: BatchEmployeeItem[]
}

interface BatchCalculationResponse {
  ok: boolean
  data: BatchCalculationData
  message?: string
}

export default function AttendanceCalcPage() {
  const { user } = useAuth()
  const canWriteAttendance = can(user?.role, 'attendance.write')

  const [calcMode, setCalcMode] = useState<CalcMode>('INDIVIDUAL')

  // Catálogos
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [loadingEmployees, setLoadingEmployees] = useState(true)

  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [loadingDepartments, setLoadingDepartments] = useState(true)

  // Rango de fechas (Default: Primer día del mes actual hasta el día de hoy)
  const [from, setFrom] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  )
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CalculationData | null>(null)
  const [batchResult, setBatchResult] = useState<BatchCalculationData | null>(null)

  // Búsqueda en la tabla masiva de pre-nómina
  const [batchSearch, setBatchSearch] = useState('')

  // Modo de vista del desglose diario individual: 'TABLE' (Tabla) o 'CALENDAR' (Almanaque Mensual)
  const [dailyViewMode, setDailyViewMode] = useState<'TABLE' | 'CALENDAR'>('TABLE')

  // Modal para ver el detalle diario de un empleado en cálculo masivo
  const [activeDetailEmployee, setActiveDetailEmployee] = useState<BatchEmployeeItem | null>(null)

  // Estado para el Modal Rápido de Justificación
  const [justifyTarget, setJustifyTarget] = useState<JustifyTarget | null>(null)
  const [justifyType, setJustifyType] = useState<
    'PERMISSION' | 'SICK_LEAVE' | 'VACATION' | 'SPECIAL_REST'
  >('PERMISSION')
  const [justifyName, setJustifyName] = useState('Permiso justificado')
  const [justifyDescription, setJustifyDescription] = useState('')
  const [justifyEndDate, setJustifyEndDate] = useState('')
  const [savingJustify, setSavingJustify] = useState(false)
  const [removingJustifyId, setRemovingJustifyId] = useState<string | null>(null)

  // Estado para el Modal de Registro Manual de Checada Olvidada
  const [manualPunchTarget, setManualPunchTarget] = useState<ManualPunchTarget | null>(null)
  const [manualPunchTime, setManualPunchTime] = useState('17:00')
  const [manualPunchDate, setManualPunchDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualPunchEmployeeId, setManualPunchEmployeeId] = useState('')
  const [manualPunchNote, setManualPunchNote] = useState('Olvido de checada al retirarse')
  const [savingManualPunch, setSavingManualPunch] = useState(false)
  const [deletingManualPunchId, setDeletingManualPunchId] = useState<string | number | null>(null)

  const JUSTIFY_PRESETS = [
    {
      label: 'Permiso Personal Autorizado',
      icon: '📋',
      type: 'PERMISSION' as const,
      name: 'Permiso personal con goce',
      description: 'Permiso con goce de sueldo autorizado por dirección',
    },
    {
      label: 'Incapacidad Médica (IMSS)',
      icon: '🩺',
      type: 'SICK_LEAVE' as const,
      name: 'Incapacidad médica / IMSS',
      description: 'Comprobante médico / incapacidad presentada por colaborador',
    },
    {
      label: 'Vacaciones',
      icon: '🏖️',
      type: 'VACATION' as const,
      name: 'Período vacacional',
      description: 'Día correspondiente a período vacacional',
    },
    {
      label: 'Comisión de Trabajo',
      icon: '💼',
      type: 'PERMISSION' as const,
      name: 'Comisión laboral externa',
      description: 'Actividades o comisiones fuera de oficina autorizadas',
    },
    {
      label: 'Tolerancia de Retardo',
      icon: '🚗',
      type: 'PERMISSION' as const,
      name: 'Tolerancia de retardo vial / transporte',
      description: 'Justificación por percance de transporte o vialidad',
    },
    {
      label: 'Descanso Especial',
      icon: '☕',
      type: 'SPECIAL_REST' as const,
      name: 'Descanso extraordinario / especial',
      description: 'Día de descanso extraordinario acordado con la empresa',
    },
  ]

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Auto-cerrar mensaje de retroalimentación
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => {
      setFeedback(null)
    }, feedback.type === 'success' ? 4000 : 7000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Cargar lista de empleados y departamentos al inicio
  useEffect(() => {
    const fetchCatalogs = async () => {
      setLoadingEmployees(true)
      setLoadingDepartments(true)
      try {
        const [empRes, deptRes] = await Promise.allSettled([
          api.get<{ ok: boolean; data: EmployeeOption[] }>('/employees?limit=200'),
          api.get<{ ok: boolean; data: DepartmentOption[] }>('/catalogs/departments'),
        ])

        if (empRes.status === 'fulfilled') {
          const empList = empRes.value.data || []
          setEmployees(empList)
          if (empList.length > 0) {
            setSelectedEmployeeId(empList[0].id)
          }
        }

        if (deptRes.status === 'fulfilled') {
          const deptList = deptRes.value.data || []
          setDepartments(deptList)
          if (deptList.length > 0) {
            setSelectedDepartmentId(deptList[0].id)
          }
        }
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Error al cargar catálogos',
        })
      } finally {
        setLoadingEmployees(false)
        setLoadingDepartments(false)
      }
    }

    fetchCatalogs()
  }, [])

  // Refrescar el cálculo actual sin resetear la vista
  const refreshCalculation = async (empIdForModalUpdate?: string) => {
    try {
      if (calcMode === 'INDIVIDUAL' && selectedEmployeeId) {
        const res = await api.get<CalculationResponse>(
          `/attendance-calculations/employees/${selectedEmployeeId}?from=${from}&to=${to}`
        )
        setResult(res.data)
      } else if (calcMode !== 'INDIVIDUAL') {
        const queryParams = new URLSearchParams({ from, to })
        if (calcMode === 'DEPARTMENT' && selectedDepartmentId) {
          queryParams.set('departmentId', selectedDepartmentId)
        }
        const res = await api.get<BatchCalculationResponse>(
          `/attendance-calculations?${queryParams.toString()}`
        )
        setBatchResult(res.data)

        if (activeDetailEmployee || empIdForModalUpdate) {
          const idToLook = empIdForModalUpdate || activeDetailEmployee?.employee.id
          const refreshed = res.data.employees.find((e) => e.employee.id === idToLook)
          if (refreshed) {
            setActiveDetailEmployee(refreshed)
          }
        }
      }
    } catch (err) {
      console.error('Error al refrescar cálculo:', err)
    }
  }

  // Abrir modal de justificación rápida
  const handleOpenJustify = (
    day: DayCalculation,
    employee: { id: string; name: string; deviceUserId: string }
  ) => {
    setJustifyTarget({
      employeeId: employee.id,
      employeeName: employee.name,
      deviceUserId: employee.deviceUserId,
      date: day.date,
      currentStatus: day.status,
      currentStatuses: day.statuses,
      currentReason: day.reason,
      existingException: day.exception || null,
      rule: day.rule,
      workedMinutes: day.workedMinutes,
      firstEntry: day.firstEntry,
      lastExit: day.lastExit,
    })

    if (day.exception) {
      setJustifyType(
        (day.exception.type as 'PERMISSION' | 'SICK_LEAVE' | 'VACATION' | 'SPECIAL_REST') ||
          'PERMISSION'
      )
      setJustifyName(day.exception.name || 'Permiso justificado')
      setJustifyDescription(day.exception.description || '')
      setJustifyEndDate(day.date)
    } else {
      if (day.statuses?.includes('LATE') || day.status === 'LATE') {
        setJustifyType('PERMISSION')
        setJustifyName('Tolerancia de retardo autorizada')
        setJustifyDescription('Retardo justificado por el supervisor')
      } else if (day.statuses?.includes('INCOMPLETE') || day.status === 'INCOMPLETE') {
        setJustifyType('PERMISSION')
        setJustifyName('Checada omitida justificada')
        setJustifyDescription('Omisión de registro de salida autorizada')
      } else if (day.statuses?.includes('EARLY_DEPARTURE') || day.status === 'EARLY_DEPARTURE') {
        setJustifyType('PERMISSION')
        setJustifyName('Salida anticipada justificada')
        setJustifyDescription('Salida previa autorizada por supervisor')
      } else {
        setJustifyType('PERMISSION')
        setJustifyName('Permiso con goce autorizado')
        setJustifyDescription('Falta justificada con autorización de gerencia')
      }
      setJustifyEndDate(day.date)
    }
  }

  // Guardar justificación vía POST /calendar-exceptions
  const handleSaveJustification = async (e: FormEvent) => {
    e.preventDefault()
    if (!justifyTarget) return

    if (!justifyName.trim()) {
      setFeedback({ type: 'error', message: 'El motivo de la justificación es obligatorio' })
      return
    }

    setSavingJustify(true)
    try {
      const payload = {
        name: justifyName.trim(),
        date: justifyTarget.date,
        endDate: justifyEndDate || justifyTarget.date,
        type: justifyType,
        scope: 'EMPLOYEE',
        employeeId: justifyTarget.employeeId,
        description: justifyDescription.trim() || null,
        isWorkDay: false,
      }

      await api.post('/calendar-exceptions', payload)

      const empName = justifyTarget.employeeName
      const tDate = justifyTarget.date
      const empId = justifyTarget.employeeId
      setJustifyTarget(null)

      setFeedback({
        type: 'success',
        message: `Justificación guardada para ${empName} (${tDate}). Pre-nómina recalculada.`,
      })

      await refreshCalculation(empId)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al registrar la justificación',
      })
    } finally {
      setSavingJustify(false)
    }
  }

  // Eliminar justificación
  const handleRemoveJustification = async (
    day: DayCalculation,
    employee: { id: string; name: string; deviceUserId: string }
  ) => {
    if (!day.exception?.id) {
      setFeedback({
        type: 'error',
        message: 'No se encontró el ID de la justificación para revocarla',
      })
      return
    }

    const ok = window.confirm(
      `¿Deseas revocar la justificación "${day.exception.name}" del ${day.date} para ${employee.name}?`
    )
    if (!ok) return

    setRemovingJustifyId(day.exception.id)
    try {
      await api.delete(`/calendar-exceptions/${day.exception.id}`)
      setFeedback({
        type: 'success',
        message: `Justificación revocada para el día ${day.date}. Jornada reevaluada.`,
      })
      await refreshCalculation(employee.id)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al revocar justificación',
      })
    } finally {
      setRemovingJustifyId(null)
    }
  }

  // Abrir modal de checada manual olvidada desde una fila de día
  const handleOpenManualPunch = (
    day: DayCalculation,
    employee: { id: string; name: string; deviceUserId: string }
  ) => {
    if (!canWriteAttendance) return
    setManualPunchTarget({
      employeeId: employee.id,
      employeeName: employee.name,
      deviceUserId: employee.deviceUserId,
      date: day.date,
      currentStatus: day.status,
      currentStatuses: day.statuses,
      firstEntry: day.firstEntry,
      lastExit: day.lastExit,
      rule: day.rule,
      punches: day.punches,
      punchDetails: day.punchDetails,
      isGlobal: false,
    })
    setManualPunchDate(day.date)
    setManualPunchEmployeeId(employee.id)

    // Sugerencia inteligente de hora según checadas faltantes
    if (day.firstEntry && !day.lastExit) {
      setManualPunchTime(day.rule?.exitTime?.slice(0, 5) || '17:00')
      setManualPunchNote('Olvido de checada al retirarse')
    } else if (!day.firstEntry && day.lastExit) {
      setManualPunchTime(day.rule?.entryTime?.slice(0, 5) || '09:00')
      setManualPunchNote('Olvido de checada al ingresar')
    } else if (day.punches.length === 0) {
      setManualPunchTime(day.rule?.entryTime?.slice(0, 5) || '09:00')
      setManualPunchNote('Olvido de checada de entrada')
    } else {
      setManualPunchTime(day.rule?.exitTime?.slice(0, 5) || '17:00')
      setManualPunchNote('Checada complementaria autorizada')
    }
  }

  // Abrir modal de checada manual general (botón superior)
  const handleOpenGeneralManualPunch = () => {
    if (!canWriteAttendance) return
    const currentEmp = employees.find((e) => e.id === selectedEmployeeId) || employees[0]
    setManualPunchTarget({
      employeeId: currentEmp?.id || '',
      employeeName: currentEmp?.name || '',
      deviceUserId: currentEmp?.deviceUserId || '',
      date: new Date().toISOString().slice(0, 10),
      isGlobal: true,
    })
    setManualPunchDate(new Date().toISOString().slice(0, 10))
    setManualPunchEmployeeId(currentEmp?.id || '')
    setManualPunchTime('17:00')
    setManualPunchNote('Olvido de checada al retirarse')
  }

  // Guardar checada manual en el backend (POST /api/attendances/manual)
  const handleSaveManualPunch = async (e: FormEvent) => {
    e.preventDefault()
    if (!manualPunchTarget || !canWriteAttendance) return

    const empId = manualPunchTarget.isGlobal ? manualPunchEmployeeId : manualPunchTarget.employeeId
    if (!empId) {
      setFeedback({ type: 'error', message: 'Selecciona un colaborador' })
      return
    }

    const targetDate = manualPunchTarget.isGlobal ? manualPunchDate : manualPunchTarget.date
    if (!targetDate) {
      setFeedback({ type: 'error', message: 'Define la fecha de la checada' })
      return
    }

    if (!manualPunchTime) {
      setFeedback({ type: 'error', message: 'Define la hora de la checada' })
      return
    }

    setSavingManualPunch(true)
    try {
      const formattedTime = manualPunchTime.length === 5 ? `${manualPunchTime}:00` : manualPunchTime
      await api.post('/attendances/manual', {
        employeeId: empId,
        date: targetDate,
        time: formattedTime,
        note: manualPunchNote.trim() || undefined,
      })

      const empName = employees.find((e) => e.id === empId)?.name || manualPunchTarget.employeeName
      setManualPunchTarget(null)

      setFeedback({
        type: 'success',
        message: `Checada manual registrada exitosamente para ${empName} (${targetDate} a las ${formattedTime}). Pre-nómina recalculada.`,
      })

      await refreshCalculation(empId)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al registrar la checada manual',
      })
    } finally {
      setSavingManualPunch(false)
    }
  }

  // Eliminar checada manual (DELETE /api/attendances/manual/:id)
  const handleDeleteManualPunch = async (
    punchId: string | number,
    employee: { id: string; name: string }
  ) => {
    if (!canWriteAttendance) return
    const ok = window.confirm('¿Deseas eliminar esta checada registrada manualmente?')
    if (!ok) return

    setDeletingManualPunchId(punchId)
    try {
      await api.delete(`/attendances/manual/${punchId}`)
      setFeedback({
        type: 'success',
        message: 'Checada manual eliminada correctamente. Jornada recalculada.',
      })
      await refreshCalculation(employee.id)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al eliminar la checada manual',
      })
    } finally {
      setDeletingManualPunchId(null)
    }
  }

  // Manejador de cálculo
  const handleCalculate = async (e?: FormEvent) => {
    if (e) e.preventDefault()

    if (!from || !to) {
      setFeedback({ type: 'error', message: 'Define ambas fechas (Desde y Hasta)' })
      return
    }

    if (from > to) {
      setFeedback({ type: 'error', message: 'La fecha "Desde" no puede ser posterior a "Hasta"' })
      return
    }

    // Validar máximo 31 días
    const diffDays =
      (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) /
        (1000 * 60 * 60 * 24) +
      1
    if (diffDays > 31) {
      setFeedback({
        type: 'error',
        message: `El rango seleccionado es de ${Math.round(diffDays)} días. El máximo permitido por el sistema es de 31 días.`,
      })
      return
    }

    if (calcMode === 'INDIVIDUAL' && !selectedEmployeeId) {
      setFeedback({ type: 'error', message: 'Selecciona un empleado para calcular' })
      return
    }

    if (calcMode === 'DEPARTMENT' && !selectedDepartmentId) {
      setFeedback({ type: 'error', message: 'Selecciona un departamento' })
      return
    }

    setLoading(true)
    setFeedback(null)

    try {
      if (calcMode === 'INDIVIDUAL') {
        const res = await api.get<CalculationResponse>(
          `/attendance-calculations/employees/${selectedEmployeeId}?from=${from}&to=${to}`
        )
        setResult(res.data)
        setBatchResult(null)
        setFeedback({
          type: 'success',
          message: `Cálculo generado exitosamente para ${res.data.employee.name} (${res.data.summary.totalDays} días)`,
        })
      } else {
        const queryParams = new URLSearchParams({ from, to })
        if (calcMode === 'DEPARTMENT') {
          queryParams.set('departmentId', selectedDepartmentId)
        }

        const res = await api.get<BatchCalculationResponse>(
          `/attendance-calculations?${queryParams.toString()}`
        )
        setBatchResult(res.data)
        setResult(null)

        const deptName = res.data.department?.name
        setFeedback({
          type: 'success',
          message: deptName
            ? `Pre-nómina generada para ${res.data.totalEmployees} empleados de ${deptName}`
            : `Pre-nómina generada para toda la empresa (${res.data.totalEmployees} empleados)`,
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al calcular asistencias',
      })
      setResult(null)
      setBatchResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Preajustes rápidos de fecha
  const applyPreset = (preset: 'current-fortnight' | 'prev-fortnight' | 'current-month' | 'last-7') => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()

    if (preset === 'last-7') {
      const past = new Date()
      past.setDate(past.getDate() - 6)
      setFrom(past.toISOString().slice(0, 10))
      setTo(now.toISOString().slice(0, 10))
    } else if (preset === 'current-fortnight') {
      if (day <= 15) {
        const start = new Date(year, month, 1)
        const end = new Date(year, month, 15)
        setFrom(start.toISOString().slice(0, 10))
        setTo(end.toISOString().slice(0, 10))
      } else {
        const start = new Date(year, month, 16)
        const end = new Date(year, month + 1, 0)
        setFrom(start.toISOString().slice(0, 10))
        setTo(end.toISOString().slice(0, 10))
      }
    } else if (preset === 'prev-fortnight') {
      if (day <= 15) {
        // Segunda quincena del mes pasado
        const start = new Date(year, month - 1, 16)
        const end = new Date(year, month, 0)
        setFrom(start.toISOString().slice(0, 10))
        setTo(end.toISOString().slice(0, 10))
      } else {
        // Primera quincena de este mes
        const start = new Date(year, month, 1)
        const end = new Date(year, month, 15)
        setFrom(start.toISOString().slice(0, 10))
        setTo(end.toISOString().slice(0, 10))
      }
    } else if (preset === 'current-month') {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0)
      setFrom(start.toISOString().slice(0, 10))
      setTo(end.toISOString().slice(0, 10))
    }
  }

  // Formato de minutos a horas y minutos
  const formatMinutes = (totalMinutes: number) => {
    if (!totalMinutes || totalMinutes <= 0) return '0 min'
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    if (hours === 0) return `${minutes} min`
    return `${hours}h ${minutes}m`
  }

  // Formato amigable de fecha
  const formatDateFriendly = (dateStr: string) => {
    try {
      const date = new Date(`${dateStr}T12:00:00Z`)
      const weekday = date.toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'UTC' })
      const day = date.getUTCDate().toString().padStart(2, '0')
      const month = date.toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' })
      return {
        weekday: weekday.toUpperCase(),
        display: `${day} ${month}`,
      }
    } catch {
      return { weekday: '—', display: dateStr }
    }
  }

  // Traducción amigable de motivos y estados
  const formatStatusReasons = (statuses?: string[]) => {
    if (!statuses || statuses.length === 0) return '—'
    const map: Record<string, string> = {
      PRESENT: 'Jornada completa a tiempo',
      LATE: 'Retardo en entrada',
      EARLY_DEPARTURE: 'Salida antes de horario',
      INCOMPLETE: 'Falta checada de salida',
      ABSENT: 'Falta injustificada',
      EXCUSED: 'Permiso / Justificado',
      REST: 'Día de descanso',
    }
    return statuses.map((s) => map[s] || s).join(' • ')
  }

  // Exportar reporte Individual a CSV
  const exportIndividualCSV = () => {
    if (!result) return

    const headers = [
      'Fecha',
      'Dia',
      'Empleado_ID',
      'Empleado_Nombre',
      'Estado',
      'Horario_Entrada',
      'Horario_Salida',
      'Primera_Entrada',
      'Ultima_Salida',
      'Minutos_Trabajados',
      'Horas_Trabajadas',
      'Numero_Checadas',
      'Detalle_Checadas',
      'Observaciones_Excepcion',
    ]

    const rows = result.days.map((d) => {
      const { weekday, display } = formatDateFriendly(d.date)
      const punchesStr = d.punches.join(' | ')
      const obs =
        d.exception?.name ||
        (d.reason === 'NO_SCHEDULE'
          ? 'Sin turno asignado'
          : d.reason === 'SCHEDULE_REST'
          ? 'Descanso por horario'
          : d.reason === 'NO_PUNCHES'
          ? 'Sin registros'
          : formatStatusReasons(d.statuses))

      return [
        `"${d.date}"`,
        `"${weekday} ${display}"`,
        `"${result.employee.deviceUserId}"`,
        `"${result.employee.name}"`,
        `"${d.status}"`,
        `"${d.rule?.entryTime || ''}"`,
        `"${d.rule?.exitTime || ''}"`,
        `"${d.firstEntry || ''}"`,
        `"${d.lastExit || ''}"`,
        d.workedMinutes || 0,
        `"${formatMinutes(d.workedMinutes)}"`,
        d.punches.length,
        `"${punchesStr}"`,
        `"${obs}"`,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `PreNomina_${result.employee.deviceUserId}_${result.from}_al_${result.to}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar Resumen Masivo de Pre-Nómina a CSV (1 fila por empleado)
  const exportBatchSummaryCSV = () => {
    if (!batchResult) return

    const headers = [
      'ID_Checador',
      'Nombre_Empleado',
      'Departamento',
      'Puesto',
      'Area',
      'Dias_Evaluados',
      'Asistencias',
      'Faltas',
      'Retardos',
      'Salidas_Anticipadas',
      'Incompletos',
      'Justificados',
      'Descansos',
      'Minutos_Laborados',
      'Horas_Laboradas',
    ]

    const rows = batchResult.employees.map((item) => {
      return [
        `"${item.employee.deviceUserId}"`,
        `"${item.employee.name}"`,
        `"${item.employee.department?.name || 'Sin departamento'}"`,
        `"${item.employee.position?.name || '—'}"`,
        `"${item.employee.area?.name || '—'}"`,
        item.summary.totalDays,
        item.summary.present,
        item.summary.absent,
        item.summary.late,
        item.summary.earlyDeparture,
        item.summary.incomplete,
        item.summary.excused,
        item.summary.rest,
        item.summary.workedMinutes,
        `"${item.summary.workedHoursFormatted}"`,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    const scopeLabel =
      batchResult.scope === 'DEPARTMENT'
        ? batchResult.department?.name?.replace(/\s+/g, '_') || 'Departamento'
        : 'Toda_Empresa'
    link.setAttribute('download', `PreNomina_Resumen_${scopeLabel}_${batchResult.from}_al_${batchResult.to}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Exportar Detalle Completo de Todos los Empleados a CSV
  const exportBatchDetailCSV = () => {
    if (!batchResult) return

    const headers = [
      'Fecha',
      'Dia',
      'ID_Checador',
      'Empleado_Nombre',
      'Departamento',
      'Puesto',
      'Estado',
      'Horario_Entrada',
      'Horario_Salida',
      'Primera_Entrada',
      'Ultima_Salida',
      'Minutos_Trabajados',
      'Horas_Trabajadas',
      'Numero_Checadas',
      'Detalle_Checadas',
      'Observaciones',
    ]

    const rows: string[] = []
    batchResult.employees.forEach((item) => {
      item.days.forEach((d) => {
        const { weekday, display } = formatDateFriendly(d.date)
        const punchesStr = d.punches.join(' | ')
        const obs =
          d.exception?.name ||
          (d.reason === 'NO_SCHEDULE'
            ? 'Sin turno asignado'
            : d.reason === 'SCHEDULE_REST'
            ? 'Descanso por horario'
            : d.reason === 'NO_PUNCHES'
            ? 'Sin registros'
            : formatStatusReasons(d.statuses))

        rows.push(
          [
            `"${d.date}"`,
            `"${weekday} ${display}"`,
            `"${item.employee.deviceUserId}"`,
            `"${item.employee.name}"`,
            `"${item.employee.department?.name || 'Sin departamento'}"`,
            `"${item.employee.position?.name || '—'}"`,
            `"${d.status}"`,
            `"${d.rule?.entryTime || ''}"`,
            `"${d.rule?.exitTime || ''}"`,
            `"${d.firstEntry || ''}"`,
            `"${d.lastExit || ''}"`,
            d.workedMinutes || 0,
            `"${formatMinutes(d.workedMinutes)}"`,
            d.punches.length,
            `"${punchesStr}"`,
            `"${obs}"`,
          ].join(',')
        )
      })
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    const scopeLabel =
      batchResult.scope === 'DEPARTMENT'
        ? batchResult.department?.name?.replace(/\s+/g, '_') || 'Departamento'
        : 'Toda_Empresa'
    link.setAttribute('download', `PreNomina_Detallada_${scopeLabel}_${batchResult.from}_al_${batchResult.to}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper para badge de estado
  const getStatusBadge = (status: DayCalculation['status'], statuses?: string[]) => {
    const list = statuses && statuses.length > 0 ? statuses : [status]

    return (
      <div className="flex flex-wrap items-center gap-1">
        {list.map((st, i) => {
          switch (st) {
            case 'PRESENT':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                >
                  <UserCheck className="w-3 h-3" />
                  Presente
                </span>
              )
            case 'ABSENT':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"
                >
                  <UserX className="w-3 h-3" />
                  Falta
                </span>
              )
            case 'LATE':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                >
                  <Clock className="w-3 h-3" />
                  Retardo
                </span>
              )
            case 'EARLY_DEPARTURE':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Salida Anticipada
                </span>
              )
            case 'INCOMPLETE':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30"
                >
                  <AlertCircle className="w-3 h-3" />
                  Incompleto
                </span>
              )
            case 'EXCUSED':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Justificado
                </span>
              )
            case 'REST':
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                >
                  <Coffee className="w-3 h-3" />
                  Descanso
                </span>
              )
            default:
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700"
                >
                  {st}
                </span>
              )
          }
        })}
      </div>
    )
  }

  // Minutos totales trabajados para modo individual
  const totalWorkedMinutesCalc =
    result?.days.reduce((acc, curr) => acc + (curr.workedMinutes || 0), 0) || 0

  // Empleados filtrados en la tabla masiva
  const filteredBatchEmployees = useMemo(() => {
    if (!batchResult) return []
    if (!batchSearch.trim()) return batchResult.employees
    const q = batchSearch.toLowerCase()
    return batchResult.employees.filter((item) => {
      const nameMatch = item.employee.name.toLowerCase().includes(q)
      const idMatch = item.employee.deviceUserId.toLowerCase().includes(q)
      const deptMatch = item.employee.department?.name?.toLowerCase().includes(q) || false
      const posMatch = item.employee.position?.name?.toLowerCase().includes(q) || false
      return nameMatch || idMatch || deptMatch || posMatch
    })
  }, [batchResult, batchSearch])

  // Matriz de Almanaque Mensual para el Desglose Individual de Asistencias
  const attendanceAlmanacGrid = useMemo(() => {
    if (!result || !result.days || result.days.length === 0) return []
    const sampleDate = new Date(result.days[0].date + 'T00:00:00')
    const year = sampleDate.getFullYear()
    const month = sampleDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const firstDayIndex = (firstDay.getDay() + 6) % 7 // Lunes = 0, Domingo = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const daysMap = new Map<string, DayCalculation>()
    for (const d of result.days) {
      daysMap.set(d.date, d)
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const cells: {
      dateStr: string
      dayNum: number
      isCurrentMonth: boolean
      isToday: boolean
      isWeekend: boolean
      dayCalc: DayCalculation | null
    }[] = []

    // Relleno mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevDate = new Date(year, month - 1, dayNum)
      const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: prevDate.getDay() === 0 || prevDate.getDay() === 6,
        dayCalc: daysMap.get(dateStr) || null,
      })
    }

    // Días del mes en curso
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      const dayOfWeek = new Date(year, month, dayNum).getDay()
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        dayCalc: daysMap.get(dateStr) || null,
      })
    }

    // Relleno mes posterior (35 o 42 celdas)
    const totalCells = cells.length > 35 ? 42 : 35
    const remaining = totalCells - cells.length
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextDate = new Date(year, month + 1, dayNum)
      const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isWeekend: nextDate.getDay() === 0 || nextDate.getDay() === 6,
        dayCalc: daysMap.get(dateStr) || null,
      })
    }

    return cells
  }, [result])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calculator className="w-6 h-6 text-amber-400" />
            <span>Cálculo de Asistencias / Pre-Nómina</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Evaluación automatizada de asistencias, faltas, retardos y horas trabajadas por colaborador o masivo
          </p>
        </div>

        {/* Botones de Acción y Exportar */}
        <div className="flex items-center gap-2 flex-wrap">
          {canWriteAttendance && (
            <button
              type="button"
              onClick={handleOpenGeneralManualPunch}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/60 text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
              title="Registrar una checada olvidada manualmente para cualquier colaborador"
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>+ Checada Olvidada</span>
            </button>
          )}

          {result && (
            <button
              onClick={exportIndividualCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              title="Descargar reporte en formato Excel / CSV"
            >
              <Download className="w-4 h-4" />
              <span>Exportar a CSV</span>
            </button>
          )}

          {batchResult && (
            <>
              <button
                onClick={exportBatchSummaryCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                title="Descargar tabla resumen de todos los empleados en CSV"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Resumen (Excel)</span>
              </button>
              <button
                onClick={exportBatchDetailCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer"
                title="Descargar todas las jornadas diarias de todos los empleados"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>Detalle Completo</span>
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

      {/* Selector & Range Form */}
      <form
        onSubmit={handleCalculate}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
      >
        {/* Selector de Modo de Cálculo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Alcance del Cálculo:
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setCalcMode('INDIVIDUAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                calcMode === 'INDIVIDUAL'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Empleado Individual</span>
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('COMPANY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                calcMode === 'COMPANY'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Toda la Empresa</span>
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('DEPARTMENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                calcMode === 'DEPARTMENT'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Por Departamento</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* Condicional según Modo */}
          {calcMode === 'INDIVIDUAL' && (
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Empleado para cálculo</span>
              </label>
              <div className="relative">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={loadingEmployees}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50 h-10"
                >
                  {loadingEmployees ? (
                    <option value="">Cargando empleados...</option>
                  ) : employees.length === 0 ? (
                    <option value="">No hay empleados registrados</option>
                  ) : (
                    employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        [{emp.deviceUserId}] {emp.name} {emp.active === false ? '(Inactivo)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}

          {calcMode === 'COMPANY' && (
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Cobertura Global</span>
              </label>
              <div className="h-10 px-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-200">
                <span className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Todos los colaboradores activos
                </span>
                <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-[11px] font-bold text-amber-300">
                  Según período laboral
                </span>
              </div>
            </div>
          )}

          {calcMode === 'DEPARTMENT' && (
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>Seleccionar Departamento</span>
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                disabled={loadingDepartments}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50 h-10"
              >
                {loadingDepartments ? (
                  <option value="">Cargando departamentos...</option>
                ) : departments.length === 0 ? (
                  <option value="">No hay departamentos registrados</option>
                ) : (
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Fecha Desde */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <CustomDatePicker
              label="Fecha Desde"
              value={from}
              onChange={setFrom}
              accentColor="amber"
              required
            />
          </div>

          {/* Fecha Hasta */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <CustomDatePicker
              label="Fecha Hasta"
              value={to}
              onChange={setTo}
              accentColor="amber"
              required
            />
          </div>

          {/* Botón Calcular */}
          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={loading || (calcMode === 'INDIVIDUAL' && !selectedEmployeeId)}
              className="w-full h-10 flex items-center justify-center gap-1.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:cursor-not-allowed"
              title="Calcular asistencia y pre-nómina"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              <span className="hidden md:inline lg:hidden">Calcular</span>
              <span className="md:hidden lg:inline">Calcular</span>
            </button>
          </div>
        </div>

        {/* Botones de Preajuste Rápido */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Períodos rápidos:</span>
          <button
            type="button"
            onClick={() => applyPreset('current-fortnight')}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            Esta Quincena
          </button>
          <button
            type="button"
            onClick={() => applyPreset('prev-fortnight')}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            Quincena Anterior
          </button>
          <button
            type="button"
            onClick={() => applyPreset('current-month')}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            Mes Completo
          </button>
          <button
            type="button"
            onClick={() => applyPreset('last-7')}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            Últimos 7 Días
          </button>
          <span className="text-[10px] text-slate-500 ml-auto">Máximo permitido: 31 días por cálculo</span>
        </div>
      </form>

      {/* Initial / Empty State */}
      {!result && !batchResult && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Listo para calcular</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Elige el alcance arriba (Empleado, Toda la Empresa o Departamento), selecciona el período y haz clic en{' '}
            <strong className="text-amber-300 font-semibold">"Calcular"</strong> para evaluar asistencias y generar la pre-nómina.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p className="text-sm font-medium text-slate-200">
            Procesando checadas y calculando pre-nómina...
          </p>
          <p className="text-xs text-slate-500">Evaluando reglas de turnos, tolerancias e incidencias</p>
        </div>
      )}

      {/* RESULTADO MODO INDIVIDUAL */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Employee Header Capsule */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {/* Avatar con Iniciales */}
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 shadow-inner">
                {result.employee.name
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'EM'}
              </div>

              {/* Nombre e ID Checador Responsive */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight break-words">
                    {result.employee.name}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold whitespace-nowrap shadow-sm">
                    ID Checador: {result.employee.deviceUserId}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Período: <strong className="text-slate-200 font-mono">{result.from}</strong> al{' '}
                    <strong className="text-slate-200 font-mono">{result.to}</strong>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-slate-400">
                    Zona: <strong className="text-slate-300 font-normal">{result.timeZone}</strong>
                  </span>
                </p>
              </div>
            </div>

            {/* Total Tiempo Trabajado */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
              <div className="w-full sm:w-auto px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-left sm:text-right shadow-inner">
                <span className="text-[10px] text-slate-400 block uppercase font-medium tracking-wider">
                  Total Tiempo Trabajado
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                  {formatMinutes(totalWorkedMinutesCalc)}
                </span>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {/* Total Días */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Días
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {result.summary.totalDays}
                </span>
                <Calendar className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Asistencias */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                Asistencias
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {result.summary.present}
                </span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Faltas */}
            <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                Faltas
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-rose-400">
                  {result.summary.absent}
                </span>
                <UserX className="w-4 h-4 text-rose-400" />
              </div>
            </div>

            {/* Retardos */}
            <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                Retardos
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-amber-400">
                  {result.summary.late}
                </span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            {/* Salida Anticipada */}
            <div className="bg-orange-950/20 border border-orange-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
                Salida Ant.
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-orange-400">
                  {result.summary.earlyDeparture}
                </span>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
            </div>

            {/* Incompletas */}
            <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                Incompleto
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-purple-400">
                  {result.summary.incomplete}
                </span>
                <AlertCircle className="w-4 h-4 text-purple-400" />
              </div>
            </div>

            {/* Descansos */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Descanso
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-300">
                  {result.summary.rest}
                </span>
                <Coffee className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Justificados */}
            <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                Justificados
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-blue-400">
                  {result.summary.excused}
                </span>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Daily Table Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-amber-400" />
                  <span>Desglose Diario de Asistencias</span>
                </h4>
                <span className="text-xs text-slate-400">
                  {result.days.length} jornadas evaluadas
                </span>
              </div>

              {/* Selector de Modo: Tabla Tradicional vs Almanaque Mensual */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDailyViewMode('TABLE')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dailyViewMode === 'TABLE'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Tabla</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDailyViewMode('CALENDAR')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dailyViewMode === 'CALENDAR'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Almanaque</span>
                </button>
              </div>
            </div>

            {dailyViewMode === 'TABLE' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Fecha</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Estado</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Horario Regla</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Entrada</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Salida</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Laborado</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Checadas</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4">Observaciones / Motivo</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {result.days.map((day) => {
                    const { weekday, display } = formatDateFriendly(day.date)
                    const isWeekendOrRest = day.status === 'REST'
                    const isAbsent = day.status === 'ABSENT'

                    return (
                      <tr
                        key={day.date}
                        className={`group hover:bg-slate-800/40 transition-colors ${
                          isAbsent
                            ? 'bg-rose-950/10'
                            : isWeekendOrRest
                              ? 'bg-slate-950/30 text-slate-400'
                              : ''
                        }`}
                      >
                        {/* Fecha */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                              {weekday}
                            </span>
                            <span className="font-semibold text-slate-100">{display}</span>
                            <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                              ({day.date})
                            </span>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {getStatusBadge(day.status, day.statuses)}
                        </td>

                        {/* Horario Programado */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                          {day.rule?.entryTime && day.rule?.exitTime ? (
                            <span className="text-slate-300">
                              {day.rule.entryTime.slice(0, 5)} - {day.rule.exitTime.slice(0, 5)}
                            </span>
                          ) : day.reason === 'NO_SCHEDULE' ? (
                            <span className="text-amber-500/80 italic text-[11px]">Sin turno asignado</span>
                          ) : day.status === 'REST' || day.reason === 'SCHEDULE_REST' ? (
                            <span className="text-slate-500">Descanso</span>
                          ) : (
                            <span className="text-slate-500 italic">Sin horario</span>
                          )}
                        </td>

                        {/* Entrada */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                          {day.firstEntry ? (
                            <span
                              className={
                                day.statuses?.includes('LATE')
                                   ? 'text-amber-400 font-bold'
                                   : 'text-emerald-400'
                              }
                            >
                              {day.firstEntry}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Salida */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                          {day.lastExit ? (
                            <span
                              className={
                                day.statuses?.includes('EARLY_DEPARTURE')
                                  ? 'text-orange-400 font-bold'
                                  : 'text-indigo-400'
                              }
                            >
                              {day.lastExit}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Minutos trabajados */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-semibold">
                          {day.workedMinutes > 0 ? (
                            <span className="text-slate-200">
                              {formatMinutes(day.workedMinutes)}
                            </span>
                          ) : (
                            <span className="text-slate-600">0 min</span>
                          )}
                        </td>

                        {/* Checadas */}
                        <td className="py-3 px-4">
                          {day.punches.length === 0 ? (
                            <span className="text-slate-600 italic text-[11px]">Sin marcas</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {day.punches.map((p, idx) => {
                                const detail = day.punchDetails?.find(
                                  (d) => d.time === p || d.time?.startsWith(p)
                                )
                                const isManual = detail?.source === 'MANUAL'

                                return isManual ? (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-sm"
                                    title="Checada registrada manualmente"
                                  >
                                    <span>{p}</span>
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/25 px-1 rounded">
                                      Manual
                                    </span>
                                    {detail?.id && canWriteAttendance && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteManualPunch(detail.id!, result.employee)
                                        }
                                        disabled={deletingManualPunchId === detail.id}
                                        className="text-amber-400/80 hover:text-rose-400 hover:bg-rose-500/20 rounded px-0.5 transition-colors cursor-pointer"
                                        title="Eliminar checada manual"
                                      >
                                        {deletingManualPunchId === detail.id ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin text-rose-400" />
                                        ) : (
                                          '×'
                                        )}
                                      </button>
                                    )}
                                  </span>
                                ) : (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300"
                                  >
                                    {p}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>

                        {/* Observaciones */}
                        <td className="py-3 px-4 text-xs">
                          {day.exception ? (
                            <div className="flex items-center gap-1.5 text-blue-300">
                              <span className="font-semibold">{day.exception.name}</span>
                              <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-400">
                                {day.exception.type}
                              </span>
                            </div>
                          ) : day.reason === 'NO_PUNCHES' ? (
                            <span className="text-rose-400/80">Sin registros de checada</span>
                          ) : day.reason === 'SCHEDULE_REST' ? (
                            <span className="text-slate-500">Día de descanso por horario</span>
                          ) : day.reason === 'NO_SCHEDULE' ? (
                            <span className="text-amber-500/70">Sin turno asignado</span>
                          ) : day.statuses && day.statuses.length > 0 ? (
                            <span className="text-slate-300 font-medium">
                              {formatStatusReasons(day.statuses)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Acción Contextual Limpia y Compacta */}
                        <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap text-center">
                          {day.status === 'EXCUSED' || day.exception ? (
                            <div className="inline-flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                <ShieldCheck className="w-3 h-3 text-blue-400" />
                                <span>Justificado</span>
                              </span>
                              {day.exception?.id && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveJustification(day, result.employee)}
                                  disabled={removingJustifyId === day.exception.id}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Quitar justificación"
                                >
                                  {removingJustifyId === day.exception.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                                  ) : (
                                    <Trash2 className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : day.status === 'INCOMPLETE' ? (
                            <div className="inline-flex items-center gap-1">
                              {canWriteAttendance ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenManualPunch(day, result.employee)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                    title="Registrar checada de entrada o salida faltante"
                                  >
                                    <Clock className="w-3 h-3 text-emerald-400" />
                                    <span>+ Checada</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenJustify(day, result.employee)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                    title="O justificar jornada"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenJustify(day, result.employee)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                  title="Justificar jornada incompleta"
                                >
                                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                                  <span>Justificar</span>
                                </button>
                              )}
                            </div>
                          ) : day.status === 'ABSENT' || day.statuses?.includes('LATE') || day.statuses?.includes('EARLY_DEPARTURE') ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenJustify(day, result.employee)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                title="Justificar incidencia (falta, retardo, etc.)"
                              >
                                <ShieldCheck className="w-3 h-3 text-blue-400" />
                                <span>Justificar</span>
                              </button>
                              {canWriteAttendance && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenManualPunch(day, result.employee)}
                                  className="p-1 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                  title="O agregar checada manual"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-1 text-slate-600">
                              <span className="text-xs group-hover:hidden">—</span>
                              <div className="hidden group-hover:inline-flex items-center gap-1">
                                {canWriteAttendance && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenManualPunch(day, result.employee)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                    title="Registrar checada manual"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenJustify(day, result.employee)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer"
                                  title="Justificar día"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Vista Almanaque Mensual de Asistencias */
            <div className="p-3 sm:p-5 space-y-3">
              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <div className="min-w-[760px]">
                  {/* Encabezado de los días de la semana (Lunes a Domingo) */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-bold uppercase tracking-wider">
                    {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d, idx) => (
                      <div
                        key={d}
                        className={`py-2 px-1 rounded-xl border ${
                          idx >= 5
                            ? 'bg-slate-950/70 border-slate-800/60 text-slate-500'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Matriz de Celdas del Calendario */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {attendanceAlmanacGrid.map((cell) => {
                      const day = cell.dayCalc
                      const isRest = day?.status === 'REST'
                      const isAbsent = day?.status === 'ABSENT'

                      return (
                        <div
                          key={cell.dateStr}
                          className={`flex flex-col p-2.5 rounded-xl border transition-all duration-150 min-h-[145px] ${
                            !cell.isCurrentMonth
                              ? 'bg-slate-950/40 border-slate-900/60 opacity-30'
                              : !day
                              ? 'bg-slate-950/50 border-slate-800/40 opacity-45'
                              : cell.isToday
                              ? 'bg-amber-950/15 border-amber-500/50 shadow-sm shadow-amber-500/10'
                              : isAbsent
                              ? 'bg-rose-950/20 border-rose-500/30'
                              : isRest
                              ? 'bg-slate-950/60 border-slate-800/60'
                              : 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          {/* Header Celda: Día y Estado */}
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span
                              className={`text-xs font-mono font-bold ${
                                cell.isToday
                                  ? 'w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm'
                                  : cell.isCurrentMonth
                                  ? 'text-slate-200'
                                  : 'text-slate-600'
                              }`}
                            >
                              {cell.dayNum}
                            </span>

                            {day ? (
                              <div className="scale-90 origin-right">
                                {getStatusBadge(day.status, day.statuses)}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600 italic">
                                Fuera de período
                              </span>
                            )}
                          </div>

                          {/* Contenido si el día fue evaluado */}
                          {day ? (
                            <div className="flex-1 flex flex-col justify-between gap-1.5">
                              <div className="space-y-1 text-[11px] font-mono">
                                {/* Horas de Entrada / Salida */}
                                <div className="flex items-center justify-between text-slate-300">
                                  <span className="text-[10px] text-slate-400">Entrada:</span>
                                  <span
                                    className={
                                      day.statuses?.includes('LATE')
                                        ? 'text-amber-400 font-bold'
                                        : day.firstEntry
                                        ? 'text-emerald-400'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {day.firstEntry || '—'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300">
                                  <span className="text-[10px] text-slate-400">Salida:</span>
                                  <span
                                    className={
                                      day.statuses?.includes('EARLY_DEPARTURE')
                                        ? 'text-orange-400 font-bold'
                                        : day.lastExit
                                        ? 'text-indigo-400'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {day.lastExit || '—'}
                                  </span>
                                </div>

                                {/* Tiempo laborado */}
                                <div className="flex items-center justify-between pt-0.5 border-t border-slate-800">
                                  <span className="text-[10px] text-slate-500">Laborado:</span>
                                  <span className="text-[11px] font-bold text-slate-200">
                                    {formatMinutes(day.workedMinutes)}
                                  </span>
                                </div>

                                {/* Checadas si existen */}
                                {day.punches.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {day.punches.slice(0, 3).map((p, idx) => {
                                      const detail = day.punchDetails?.find(
                                        (d) => d.time === p || d.time?.startsWith(p)
                                      )
                                      const isManual = detail?.source === 'MANUAL'
                                      return (
                                        <span
                                          key={idx}
                                          className={`px-1 py-0.2 rounded text-[9px] ${
                                            isManual
                                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                                          }`}
                                        >
                                          {p.slice(0, 5)}
                                        </span>
                                      )
                                    })}
                                    {day.punches.length > 3 && (
                                      <span className="text-[9px] text-slate-500 font-mono">
                                        +{day.punches.length - 3}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Botones Rápidos de Acción en la Celda */}
                              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1 flex-wrap">
                                {canWriteAttendance && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenManualPunch(day, result.employee)}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
                                    title="Registrar checada manual"
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>+ Checada</span>
                                  </button>
                                )}

                                {day.status === 'EXCUSED' || day.exception ? (
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                      <ShieldCheck className="w-2.5 h-2.5" />
                                      <span>Justif.</span>
                                    </span>
                                    {day.exception?.id && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveJustification(day, result.employee)}
                                        disabled={removingJustifyId === day.exception.id}
                                        className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                        title="Quitar justificación"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenJustify(day, result.employee)}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 transition-all cursor-pointer"
                                    title="Justificar este día"
                                  >
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    <span>Justificar</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-[11px] text-slate-600 italic">
                              Fuera de período
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* RESULTADO MODO MASIVO (TODA LA EMPRESA O POR DEPARTAMENTO) */}
      {batchResult && !loading && (
        <div className="space-y-6">
          {/* Header Capsule Masivo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm sm:text-base flex-shrink-0 shadow-inner">
                {batchResult.scope === 'DEPARTMENT' ? (
                  <Briefcase className="w-6 h-6" />
                ) : (
                  <Building2 className="w-6 h-6" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                    {batchResult.scope === 'DEPARTMENT'
                      ? `Pre-Nómina: ${batchResult.department?.name || 'Departamento'}`
                      : 'Pre-Nómina Consolidada: Toda la Empresa'}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold whitespace-nowrap shadow-sm">
                    {batchResult.totalEmployees} colaboradores evaluados
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Período: <strong className="text-slate-200 font-mono">{batchResult.from}</strong> al{' '}
                    <strong className="text-slate-200 font-mono">{batchResult.to}</strong>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span>
                    Jornadas totales evaluadas:{' '}
                    <strong className="text-slate-300">{batchResult.companySummary.totalDaysEvaluated}</strong>
                  </span>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-slate-400">
                    Zona: <strong className="text-slate-300 font-normal">{batchResult.timeZone}</strong>
                  </span>
                </p>
              </div>
            </div>

            {/* Total Horas Acumuladas */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-shrink-0">
              <div className="w-full sm:w-auto px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-left sm:text-right shadow-inner">
                <span className="text-[10px] text-slate-400 block uppercase font-medium tracking-wider">
                  Horas Totales Trabajadas
                </span>
                <span className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5 block">
                  {batchResult.companySummary.totalWorkedHoursFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards Grid Masivo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {/* Total Empleados */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Colaboradores
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-white">
                  {batchResult.totalEmployees}
                </span>
                <User className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Asistencias */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                Asistencias
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {batchResult.companySummary.present}
                </span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Faltas */}
            <div className="bg-rose-950/20 border border-rose-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
                Faltas
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-rose-400">
                  {batchResult.companySummary.absent}
                </span>
                <UserX className="w-4 h-4 text-rose-400" />
              </div>
            </div>

            {/* Retardos */}
            <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                Retardos
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-amber-400">
                  {batchResult.companySummary.late}
                </span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
            </div>

            {/* Salida Anticipada */}
            <div className="bg-orange-950/20 border border-orange-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
                Salida Ant.
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-orange-400">
                  {batchResult.companySummary.earlyDeparture}
                </span>
                <AlertTriangle className="w-4 h-4 text-orange-400" />
              </div>
            </div>

            {/* Incompletas */}
            <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">
                Incompleto
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-purple-400">
                  {batchResult.companySummary.incomplete}
                </span>
                <AlertCircle className="w-4 h-4 text-purple-400" />
              </div>
            </div>

            {/* Descansos */}
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Descanso
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-slate-300">
                  {batchResult.companySummary.rest}
                </span>
                <Coffee className="w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Justificados */}
            <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                Justificados
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold font-mono text-blue-400">
                  {batchResult.companySummary.excused}
                </span>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Tabla Resumen de Colaboradores */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white">
                  Resumen de Pre-Nómina por Empleado
                </h4>
                <span className="text-xs text-slate-400">
                  ({filteredBatchEmployees.length} de {batchResult.totalEmployees})
                </span>
              </div>

              {/* Buscador en la tabla */}
              <div className="w-full sm:w-72 flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 rounded-xl h-9 focus-within:border-amber-500/70">
                <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder="Buscar colaborador, ID o depto..."
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none placeholder-slate-500"
                />
                {batchSearch && (
                  <button
                    onClick={() => setBatchSearch('')}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-3 px-4">Empleado</th>
                    <th className="py-3 px-4">Departamento / Puesto</th>
                    <th className="py-3 px-3 text-center text-emerald-400">Asist.</th>
                    <th className="py-3 px-3 text-center text-rose-400">Faltas</th>
                    <th className="py-3 px-3 text-center text-amber-400">Retardos</th>
                    <th className="py-3 px-3 text-center text-orange-400">Sal. Ant.</th>
                    <th className="py-3 px-3 text-center text-purple-400">Incomp.</th>
                    <th className="py-3 px-3 text-center text-blue-400">Justif.</th>
                    <th className="py-3 px-3 text-center text-slate-400">Desc.</th>
                    <th className="py-3 px-4 text-right">Horas Laboradas</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {filteredBatchEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No se encontraron colaboradores que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredBatchEmployees.map((item) => (
                      <tr
                        key={item.employee.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Empleado con avatar */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {item.employee.name
                                .split(' ')
                                .map((n) => n[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join('')
                                .toUpperCase() || 'EM'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100">
                                {item.employee.name}
                              </div>
                              <div className="text-[11px] font-mono text-amber-400/90">
                                ID: {item.employee.deviceUserId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Departamento / Puesto */}
                        <td className="py-3 px-4 whitespace-nowrap text-xs">
                          <div className="text-slate-300 font-medium">
                            {item.employee.department?.name || (
                              <span className="text-slate-500 italic">Sin departamento</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.employee.position?.name || '—'}
                          </div>
                        </td>

                        {/* Asistencias */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                          {item.summary.present}
                        </td>

                        {/* Faltas */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {item.summary.absent > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              {item.summary.absent}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Retardos */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {item.summary.late > 0 ? (
                            <span className="text-amber-400">{item.summary.late}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Salida Anticipada */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {item.summary.earlyDeparture > 0 ? (
                            <span className="text-orange-400">{item.summary.earlyDeparture}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Incompletas */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {item.summary.incomplete > 0 ? (
                            <span className="text-purple-400">{item.summary.incomplete}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Justificados */}
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {item.summary.excused > 0 ? (
                            <span className="text-blue-400">{item.summary.excused}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>

                        {/* Descansos */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          {item.summary.rest}
                        </td>

                        {/* Horas Laboradas */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                          {item.summary.workedHoursFormatted}
                        </td>

                        {/* Botón Ver Detalle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setActiveDetailEmployee(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            title="Ver desglose día por día de este empleado"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Detalle</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DIARIO DEL EMPLEADO EN CÁLCULO MASIVO */}
      {activeDetailEmployee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-sm shadow-inner flex-shrink-0">
                  {activeDetailEmployee.employee.name
                    .split(' ')
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'EM'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white leading-tight">
                      {activeDetailEmployee.employee.name}
                    </h3>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      ID: {activeDetailEmployee.employee.deviceUserId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeDetailEmployee.employee.department?.name || 'Sin departamento'} •{' '}
                    {activeDetailEmployee.employee.position?.name || 'Puesto no asignado'} • Período:{' '}
                    <strong className="text-slate-200 font-mono">{batchResult?.from}</strong> al{' '}
                    <strong className="text-slate-200 font-mono">{batchResult?.to}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailEmployee(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Metrics & Days Table */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Mini Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Días</span>
                  <span className="text-base font-bold text-white font-mono">{activeDetailEmployee.summary.totalDays}</span>
                </div>
                <div className="bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Asist.</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">{activeDetailEmployee.summary.present}</span>
                </div>
                <div className="bg-rose-950/20 p-2.5 rounded-xl border border-rose-500/20 text-center">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold block">Faltas</span>
                  <span className="text-base font-bold text-rose-400 font-mono">{activeDetailEmployee.summary.absent}</span>
                </div>
                <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-500/20 text-center">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold block">Retardos</span>
                  <span className="text-base font-bold text-amber-400 font-mono">{activeDetailEmployee.summary.late}</span>
                </div>
                <div className="bg-orange-950/20 p-2.5 rounded-xl border border-orange-500/20 text-center">
                  <span className="text-[10px] text-orange-400 uppercase font-semibold block">Sal. Ant.</span>
                  <span className="text-base font-bold text-orange-400 font-mono">{activeDetailEmployee.summary.earlyDeparture}</span>
                </div>
                <div className="bg-purple-950/20 p-2.5 rounded-xl border border-purple-500/20 text-center">
                  <span className="text-[10px] text-purple-400 uppercase font-semibold block">Incomp.</span>
                  <span className="text-base font-bold text-purple-400 font-mono">{activeDetailEmployee.summary.incomplete}</span>
                </div>
                <div className="bg-blue-950/20 p-2.5 rounded-xl border border-blue-500/20 text-center">
                  <span className="text-[10px] text-blue-400 uppercase font-semibold block">Justif.</span>
                  <span className="text-base font-bold text-blue-400 font-mono">{activeDetailEmployee.summary.excused}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Horas</span>
                  <span className="text-base font-bold text-slate-100 font-mono">{activeDetailEmployee.summary.workedHoursFormatted}</span>
                </div>
              </div>

              {/* Days Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Horario Regla</th>
                        <th className="py-2.5 px-3">Entrada</th>
                        <th className="py-2.5 px-3">Salida</th>
                        <th className="py-2.5 px-3">Laborado</th>
                        <th className="py-2.5 px-3">Checadas</th>
                        <th className="py-2.5 px-3">Observaciones</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {activeDetailEmployee.days.map((day) => {
                        const { weekday, display } = formatDateFriendly(day.date)
                        const isWeekendOrRest = day.status === 'REST'
                        const isAbsent = day.status === 'ABSENT'

                        return (
                          <tr
                            key={day.date}
                            className={`group hover:bg-slate-800/30 transition-colors ${
                              isAbsent
                                ? 'bg-rose-950/10'
                                : isWeekendOrRest
                                ? 'bg-slate-950/40 text-slate-400'
                                : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                              <span className="font-mono text-slate-400 mr-1.5 font-bold">[{weekday}]</span>
                              <span>{display}</span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {getStatusBadge(day.status, day.statuses)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                              {day.rule?.entryTime && day.rule?.exitTime ? (
                                `${day.rule.entryTime.slice(0, 5)} - ${day.rule.exitTime.slice(0, 5)}`
                              ) : day.reason === 'NO_SCHEDULE' ? (
                                <span className="text-amber-500/80 italic text-[11px]">Sin turno asignado</span>
                              ) : day.status === 'REST' || day.reason === 'SCHEDULE_REST' ? (
                                'Descanso'
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {day.firstEntry ? (
                                <span className={day.statuses?.includes('LATE') ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                  {day.firstEntry}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {day.lastExit ? (
                                <span className={day.statuses?.includes('EARLY_DEPARTURE') ? 'text-orange-400 font-bold' : 'text-indigo-400'}>
                                  {day.lastExit}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-200">
                              {formatMinutes(day.workedMinutes)}
                            </td>
                            <td className="py-2.5 px-3">
                              {day.punches.length === 0 ? (
                                <span className="text-slate-600 italic text-[11px]">Sin marcas</span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {day.punches.map((p, idx) => {
                                    const detail = day.punchDetails?.find(
                                      (d) => d.time === p || d.time?.startsWith(p)
                                    )
                                    const isManual = detail?.source === 'MANUAL'

                                    return isManual ? (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-sm"
                                        title="Checada registrada manualmente"
                                      >
                                        <span>{p}</span>
                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/25 px-1 rounded">
                                          Manual
                                        </span>
                                        {detail?.id && canWriteAttendance && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteManualPunch(
                                                detail.id!,
                                                activeDetailEmployee.employee
                                              )
                                            }
                                            disabled={deletingManualPunchId === detail.id}
                                            className="text-amber-400/80 hover:text-rose-400 hover:bg-rose-500/20 rounded px-0.5 transition-colors cursor-pointer"
                                            title="Eliminar checada manual"
                                          >
                                            {deletingManualPunchId === detail.id ? (
                                              <Loader2 className="w-2.5 h-2.5 animate-spin text-rose-400" />
                                            ) : (
                                              '×'
                                            )}
                                          </button>
                                        )}
                                      </span>
                                    ) : (
                                      <span
                                        key={idx}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-300"
                                      >
                                        {p}
                                      </span>
                                    )
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-xs">
                              {day.exception ? (
                                <span className="text-blue-300 font-semibold">{day.exception.name}</span>
                              ) : day.reason === 'NO_PUNCHES' ? (
                                <span className="text-rose-400/80">Sin registros</span>
                              ) : day.reason === 'SCHEDULE_REST' ? (
                                <span className="text-slate-500">Descanso por horario</span>
                              ) : day.reason === 'NO_SCHEDULE' ? (
                                <span className="text-amber-500/70">Sin turno asignado</span>
                              ) : (
                                <span className="text-slate-300">{formatStatusReasons(day.statuses)}</span>
                              )}
                            </td>
                            {/* Acción Contextual Limpia y Compacta */}
                            <td className="py-2 px-3 whitespace-nowrap text-center">
                              {day.status === 'EXCUSED' || day.exception ? (
                                <div className="inline-flex items-center gap-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                                    <span>Justificado</span>
                                  </span>
                                  {day.exception?.id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveJustification(
                                          day,
                                          activeDetailEmployee.employee
                                        )
                                      }
                                      disabled={removingJustifyId === day.exception.id}
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Quitar justificación"
                                    >
                                      {removingJustifyId === day.exception.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                                      ) : (
                                        <Trash2 className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : day.status === 'INCOMPLETE' ? (
                                <div className="inline-flex items-center gap-1">
                                  {canWriteAttendance ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenManualPunch(day, activeDetailEmployee.employee)
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                        title="Registrar checada olvidada (entrada o salida)"
                                      >
                                        <Clock className="w-3 h-3 text-emerald-400" />
                                        <span>+ Checada</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenJustify(day, activeDetailEmployee.employee)
                                        }
                                        className="p-1 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                        title="O justificar jornada"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenJustify(day, activeDetailEmployee.employee)
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                      title="Justificar jornada incompleta"
                                    >
                                      <ShieldCheck className="w-3 h-3 text-blue-400" />
                                      <span>Justificar</span>
                                    </button>
                                  )}
                                </div>
                              ) : day.status === 'ABSENT' || day.statuses?.includes('LATE') || day.statuses?.includes('EARLY_DEPARTURE') ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenJustify(day, activeDetailEmployee.employee)
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                                    title="Justificar falta o incidencia"
                                  >
                                    <ShieldCheck className="w-3 h-3 text-blue-400" />
                                    <span>Justificar</span>
                                  </button>
                                  {canWriteAttendance && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenManualPunch(day, activeDetailEmployee.employee)
                                      }
                                      className="p-1 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                      title="O agregar checada manual"
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center gap-1 text-slate-600">
                                  <span className="text-xs group-hover:hidden">—</span>
                                  <div className="hidden group-hover:inline-flex items-center gap-1">
                                    {canWriteAttendance && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenManualPunch(day, activeDetailEmployee.employee)
                                        }
                                        className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                                        title="Registrar checada manual"
                                      >
                                        <Clock className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenJustify(day, activeDetailEmployee.employee)
                                      }
                                      className="p-1 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-500/15 transition-colors cursor-pointer"
                                      title="Justificar día"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
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

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveDetailEmployee(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÁPIDO DE JUSTIFICACIÓN DE JORNADA / INCIDENCIA */}
      {justifyTarget && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Header del Modal */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Justificar Jornada / Incidencia
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {justifyTarget.employeeName} •{' '}
                    <span className="font-mono text-amber-300">ID: {justifyTarget.deviceUserId}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setJustifyTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario de Justificación */}
            <form onSubmit={handleSaveJustification} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Tarjeta de Resumen del Día */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-medium">Fecha:</span>
                    <span className="font-semibold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                      {justifyTarget.date}
                    </span>
                    <span className="text-slate-300 font-medium">
                      ({formatDateFriendly(justifyTarget.date).weekday} {formatDateFriendly(justifyTarget.date).display})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Estado actual:</span>
                    {getStatusBadge(justifyTarget.currentStatus as any, justifyTarget.currentStatuses)}
                  </div>
                </div>

                {justifyTarget.workedMinutes !== undefined && justifyTarget.workedMinutes > 0 && (
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Checadas:{' '}
                      <strong className="text-slate-300 font-mono">
                        {justifyTarget.firstEntry || '—'} a {justifyTarget.lastExit || '—'}
                      </strong>
                    </span>
                    <span>
                      Tiempo trabajado:{' '}
                      <strong className="text-emerald-400 font-mono">
                        {formatMinutes(justifyTarget.workedMinutes)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Botones de Preajustes Rápidos */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Preajustes rápidos (1 clic):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {JUSTIFY_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setJustifyType(preset.type)
                        setJustifyName(preset.name)
                        setJustifyDescription(preset.description)
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer ${
                        justifyType === preset.type && justifyName === preset.name
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-200 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="text-sm">{preset.icon}</span>
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de Tipo de Justificación */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Tipo de Excepción / Justificante <span className="text-rose-400">*</span>
                </label>
                <select
                  value={justifyType}
                  onChange={(e) =>
                    setJustifyType(
                      e.target.value as 'PERMISSION' | 'SICK_LEAVE' | 'VACATION' | 'SPECIAL_REST'
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-10"
                >
                  <option value="PERMISSION">Permiso Justificado (Personal o Laboral)</option>
                  <option value="SICK_LEAVE">Incapacidad Médica / Salud / IMSS</option>
                  <option value="VACATION">Vacaciones Autorizadas</option>
                  <option value="SPECIAL_REST">Descanso Especial / Asueto Extraordinario</option>
                </select>
              </div>

              {/* Título o Motivo */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Título o Motivo de la Justificación <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={justifyName}
                  onChange={(e) => setJustifyName(e.target.value)}
                  placeholder="Ej: Permiso médico con goce de sueldo..."
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 h-10"
                />
              </div>

              {/* Rango de Fechas (Inicio y Fin opcional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Fecha a Justificar
                  </label>
                  <input
                    type="date"
                    value={justifyTarget.date}
                    disabled
                    className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Aplicar hasta (Opcional)
                  </label>
                  <input
                    type="date"
                    value={justifyEndDate}
                    min={justifyTarget.date}
                    onChange={(e) => setJustifyEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-9"
                    title="Si el permiso abarca varios días consecutivos (ej. incapacidad de 3 días)"
                  />
                </div>
              </div>

              {/* Observaciones o Notas */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Observaciones / Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={justifyDescription}
                  onChange={(e) => setJustifyDescription(e.target.value)}
                  rows={2}
                  placeholder="Detalles de la justificación, folio de incapacidad, ticket de autorización..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Botones de Acción del Modal */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setJustifyTarget(null)}
                  disabled={savingJustify}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingJustify || !justifyName.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {savingJustify ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Guardar Justificación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO MANUAL DE CHECADA OLVIDADA */}
      {manualPunchTarget && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Header del Modal */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Registro Manual de Checada Olvidada
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {manualPunchTarget.isGlobal ? (
                      'Alta manual para cualquier colaborador'
                    ) : (
                      <>
                        {manualPunchTarget.employeeName} •{' '}
                        <span className="font-mono text-amber-300">
                          ID: {manualPunchTarget.deviceUserId}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualPunchTarget(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveManualPunch} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Contexto del Día (si se abrió desde fila específica) */}
              {!manualPunchTarget.isGlobal && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-medium">Jornada:</span>
                      <span className="font-semibold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded">
                        {manualPunchTarget.date}
                      </span>
                      <span className="text-slate-300 font-medium">
                        ({formatDateFriendly(manualPunchTarget.date).weekday}{' '}
                        {formatDateFriendly(manualPunchTarget.date).display})
                      </span>
                    </div>
                    {manualPunchTarget.currentStatus && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Estado:</span>
                        {getStatusBadge(
                          manualPunchTarget.currentStatus as any,
                          manualPunchTarget.currentStatuses
                        )}
                      </div>
                    )}
                  </div>

                  {/* Resumen de Checadas y Turno */}
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Horario programado:</span>
                      <span className="font-mono text-slate-200">
                        {manualPunchTarget.rule?.entryTime && manualPunchTarget.rule?.exitTime
                          ? `${manualPunchTarget.rule.entryTime.slice(0, 5)} - ${manualPunchTarget.rule.exitTime.slice(0, 5)}`
                          : 'Sin horario oficial'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Checadas en sistema:</span>
                      <div className="flex items-center gap-1">
                        {manualPunchTarget.punches && manualPunchTarget.punches.length > 0 ? (
                          manualPunchTarget.punches.map((p, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 rounded font-mono bg-slate-900 border border-slate-800 text-[11px] text-slate-200"
                            >
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic">Sin registros</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Diagnóstico inteligente */}
                  {manualPunchTarget.firstEntry && !manualPunchTarget.lastExit && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        Falta checada de <strong>salida</strong>. El turno concluye a las{' '}
                        <strong className="font-mono text-white">
                          {manualPunchTarget.rule?.exitTime?.slice(0, 5) || '17:00'}
                        </strong>
                        .
                      </span>
                    </div>
                  )}
                  {!manualPunchTarget.firstEntry && manualPunchTarget.lastExit && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        Falta checada de <strong>entrada</strong>. El turno inicia a las{' '}
                        <strong className="font-mono text-white">
                          {manualPunchTarget.rule?.entryTime?.slice(0, 5) || '09:00'}
                        </strong>
                        .
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Selector de Empleado (Solo si es general) */}
              {manualPunchTarget.isGlobal && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Colaborador <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={manualPunchEmployeeId}
                    onChange={(e) => setManualPunchEmployeeId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer h-10"
                  >
                    <option value="">Selecciona un colaborador...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        [{emp.deviceUserId}] {emp.name} {emp.active === false ? '(Inactivo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fecha y Hora de la Checada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Fecha de la Checada <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={manualPunchDate}
                    onChange={(e) => setManualPunchDate(e.target.value)}
                    disabled={!manualPunchTarget.isGlobal}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 disabled:bg-slate-950/60 disabled:text-slate-400 rounded-xl text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Hora de la Checada <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="time"
                    step="1"
                    value={manualPunchTime}
                    onChange={(e) => setManualPunchTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 h-10"
                  />
                </div>
              </div>

              {/* Atajos Rápidos de Hora (1 Clic) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Atajos rápidos de hora:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {manualPunchTarget.rule?.exitTime && (
                    <button
                      type="button"
                      onClick={() =>
                        setManualPunchTime(manualPunchTarget.rule?.exitTime?.slice(0, 5) || '17:00')
                      }
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                    >
                      Salida oficial ({manualPunchTarget.rule.exitTime.slice(0, 5)})
                    </button>
                  )}
                  {manualPunchTarget.rule?.entryTime && (
                    <button
                      type="button"
                      onClick={() =>
                        setManualPunchTime(manualPunchTarget.rule?.entryTime?.slice(0, 5) || '09:00')
                      }
                      className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                    >
                      Entrada oficial ({manualPunchTarget.rule.entryTime.slice(0, 5)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date()
                      const hh = String(now.getHours()).padStart(2, '0')
                      const mm = String(now.getMinutes()).padStart(2, '0')
                      setManualPunchTime(`${hh}:${mm}`)
                    }}
                    className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                  >
                    Hora actual
                  </button>
                </div>
              </div>

              {/* Motivo del Registro */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Motivo de la Checada Manual
                </label>
                <input
                  type="text"
                  value={manualPunchNote}
                  onChange={(e) => setManualPunchNote(e.target.value)}
                  placeholder="Ej: Olvido de checada al retirarse..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-10"
                />
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <span className="text-[10px] text-slate-500">Comunes:</span>
                  {[
                    'Olvido de checada al retirarse',
                    'Olvido de checada al ingresar',
                    'Falla momentánea de reloj checador',
                    'Comisión laboral externa autorizada',
                  ].map((presetNote, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setManualPunchNote(presetNote)}
                      className="text-[11px] text-slate-400 hover:text-emerald-300 hover:underline cursor-pointer"
                    >
                      • {presetNote}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones del Modal */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setManualPunchTarget(null)}
                  disabled={savingManualPunch}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManualPunch || !manualPunchTime}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {savingManualPunch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                  <span>Guardar Checada</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
