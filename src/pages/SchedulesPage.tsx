import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { api } from '../lib/api'
import TimePickerModal from '../components/TimePickerModal'
import CustomDatePicker from '../components/CustomDatePicker'
import {
  Clock,
  Plus,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Edit2,
  Trash2,
  Sun,
  Moon,
  Sparkles,
  Users,
  Search,
  Check,
} from 'lucide-react'

interface ScheduleDay {
  id?: string
  scheduleId?: string
  dayOfWeek: number
  isWorkDay: boolean
  entryTime: string | null
  exitTime: string | null
  crossesMidnight: boolean
}

interface WorkSchedule {
  id: string
  name: string
  description: string | null
  timeZone: string
  toleranceMinutes: number
  active: boolean
  days: ScheduleDay[]
  employeeAssignments?: { id: string; employeeId: string }[]
}

interface EmployeeScheduleAssignment {
  id: string
  employeeId: string
  scheduleId: string
  validFrom: string
  validTo: string | null
  active: boolean
  employee?: {
    id: string
    deviceUserId: string
    name: string
    active: boolean
  }
}

interface EmployeeOption {
  id: string
  deviceUserId: string
  name: string
  profile?: { employmentStatus?: string | null }
  deletedAt?: string | null
}

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

const DEFAULT_DAYS: ScheduleDay[] = [
  { dayOfWeek: 0, isWorkDay: false, entryTime: null, exitTime: null, crossesMidnight: false },
  { dayOfWeek: 1, isWorkDay: true, entryTime: '08:00', exitTime: '17:00', crossesMidnight: false },
  { dayOfWeek: 2, isWorkDay: true, entryTime: '08:00', exitTime: '17:00', crossesMidnight: false },
  { dayOfWeek: 3, isWorkDay: true, entryTime: '08:00', exitTime: '17:00', crossesMidnight: false },
  { dayOfWeek: 4, isWorkDay: true, entryTime: '08:00', exitTime: '17:00', crossesMidnight: false },
  { dayOfWeek: 5, isWorkDay: true, entryTime: '08:00', exitTime: '17:00', crossesMidnight: false },
  { dayOfWeek: 6, isWorkDay: false, entryTime: null, exitTime: null, crossesMidnight: false },
]

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<WorkSchedule | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [toleranceMinutes, setToleranceMinutes] = useState(10)
  const [days, setDays] = useState<ScheduleDay[]>(DEFAULT_DAYS)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editToleranceMinutes, setEditToleranceMinutes] = useState(10)
  const [editDays, setEditDays] = useState<ScheduleDay[]>(DEFAULT_DAYS)

  // Assign form state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [assignSearch, setAssignSearch] = useState('')
  const [assignValidFrom, setAssignValidFrom] = useState(() => getTodayString())
  const [assignError, setAssignError] = useState('')

  // View Assigned Employees Modal State
  const [isViewAssignmentsOpen, setIsViewAssignmentsOpen] = useState(false)
  const [assignments, setAssignments] = useState<EmployeeScheduleAssignment[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  const [assignmentSearch, setAssignmentSearch] = useState('')

  // Edit Assignment Modal State
  const [editingAssignment, setEditingAssignment] = useState<EmployeeScheduleAssignment | null>(null)
  const [editAssignScheduleId, setEditAssignScheduleId] = useState('')
  const [editAssignValidFrom, setEditAssignValidFrom] = useState('')
  const [editAssignIsIndefinite, setEditAssignIsIndefinite] = useState(true)
  const [editAssignValidTo, setEditAssignValidTo] = useState('')

  // Custom Time Picker Modal State
  const [timePickerTarget, setTimePickerTarget] = useState<{
    modal: 'create' | 'edit'
    dayIndex: number
    dayOfWeek: number
    field: 'entryTime' | 'exitTime'
    currentTime: string
  } | null>(null)

  const formatTimeDisplay = (timeStr: string | null) => {
    if (!timeStr) return '--:--'
    const [hStr, mStr] = timeStr.slice(0, 5).split(':')
    const h = parseInt(hStr, 10)
    if (isNaN(h)) return timeStr
    const period = h >= 12 ? 'p. m.' : 'a. m.'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${String(h12).padStart(2, '0')}:${mStr || '00'} ${period}`
  }

  const handleConfirmCustomTime = (newTime: string) => {
    if (!timePickerTarget) return
    if (timePickerTarget.modal === 'create') {
      handleDayChange(timePickerTarget.dayIndex, timePickerTarget.field, newTime)
    } else {
      handleEditDayChange(timePickerTarget.dayIndex, timePickerTarget.field, newTime)
    }
    setTimePickerTarget(null)
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

  const loadSchedules = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ ok: boolean; data: WorkSchedule[] }>('/schedules')
      setSchedules(res.data)
      if (selectedSchedule) {
        const updated = res.data.find((s) => s.id === selectedSchedule.id)
        if (updated) setSelectedSchedule(updated)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar horarios',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    const fetchAll = async () => {
      try {
        const [schRes, empRes] = await Promise.allSettled([
          api.get<{ ok: boolean; data: WorkSchedule[] }>('/schedules'),
          api.get<{ ok: boolean; data: EmployeeOption[] }>('/employees?limit=100'),
        ])

        if (!ignore) {
          if (schRes.status === 'fulfilled') {
            setSchedules(schRes.value.data)
          }
          if (empRes.status === 'fulfilled') {
            setEmployees(empRes.value.data)
          }
          setLoading(false)
        }
      } catch {
        if (!ignore) setLoading(false)
      }
    }

    fetchAll()

    return () => {
      ignore = true
    }
  }, [])

  const handleOpenCreate = () => {
    setName('')
    setDescription('')
    setToleranceMinutes(10)
    setDays(JSON.parse(JSON.stringify(DEFAULT_DAYS)))
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (sch: WorkSchedule) => {
    setSelectedSchedule(sch)
    setEditName(sch.name)
    setEditDescription(sch.description || '')
    setEditToleranceMinutes(sch.toleranceMinutes)

    const currentDaysMap = new Map(sch.days?.map((d) => [d.dayOfWeek, d]))
    const filledDays: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => {
      const existing = currentDaysMap.get(i)
      if (existing) {
        return {
          dayOfWeek: i,
          isWorkDay: existing.isWorkDay,
          entryTime: existing.entryTime ? existing.entryTime.slice(0, 5) : '08:00',
          exitTime: existing.exitTime ? existing.exitTime.slice(0, 5) : '17:00',
          crossesMidnight: existing.crossesMidnight || false,
        }
      }
      return {
        dayOfWeek: i,
        isWorkDay: false,
        entryTime: null,
        exitTime: null,
        crossesMidnight: false,
      }
    })

    setEditDays(filledDays)
    setIsEditOpen(true)
  }

  const handleOpenAssign = (sch: WorkSchedule) => {
    setSelectedSchedule(sch)

    // Regla de negocio: 1 empleado = máximo 1 horario activo en todo el sistema.
    // Excluir a todos los empleados que ya tienen asignado CUALQUIER horario.
    const alreadyAssigned = new Set<string>()
    schedules.forEach((s) => {
      s.employeeAssignments?.forEach((a) => {
        if (a.employeeId) alreadyAssigned.add(a.employeeId)
      })
    })
    assignments.forEach((a) => {
      if (a.active !== false && a.employeeId) alreadyAssigned.add(a.employeeId)
    })

    const available = employees.filter((emp) => !alreadyAssigned.has(emp.id))
    setSelectedEmployeeIds(available[0] ? [available[0].id] : [])
    setAssignSearch('')
    setAssignError('')
    setAssignValidFrom(getTodayString())
    setIsAssignOpen(true)
  }

  const handleDayChange = (
    index: number,
    field: keyof ScheduleDay,
    value: string | boolean | number | null
  ) => {
    setDays((prev) => {
      const updated = [...prev]
      const current = { ...updated[index] }

      if (field === 'isWorkDay') {
        current.isWorkDay = Boolean(value)
        if (current.isWorkDay && !current.entryTime) {
          current.entryTime = '08:00'
          current.exitTime = '17:00'
        }
      } else if (field === 'entryTime') {
        current.entryTime = value as string
      } else if (field === 'exitTime') {
        current.exitTime = value as string
      } else if (field === 'crossesMidnight') {
        current.crossesMidnight = Boolean(value)
      }

      updated[index] = current
      return updated
    })
  }

  const handleEditDayChange = (
    index: number,
    field: keyof ScheduleDay,
    value: string | boolean | number | null
  ) => {
    setEditDays((prev) => {
      const updated = [...prev]
      const current = { ...updated[index] }

      if (field === 'isWorkDay') {
        current.isWorkDay = Boolean(value)
        if (current.isWorkDay && !current.entryTime) {
          current.entryTime = '08:00'
          current.exitTime = '17:00'
        }
      } else if (field === 'entryTime') {
        current.entryTime = value as string
      } else if (field === 'exitTime') {
        current.exitTime = value as string
      } else if (field === 'crossesMidnight') {
        current.crossesMidnight = Boolean(value)
      }

      updated[index] = current
      return updated
    })
  }

  // Preajustes rápidos de días laborales
  const applyPresetToCreate = (type: 'mon-fri' | 'mon-sat' | 'all') => {
    setDays((prev) =>
      prev.map((d) => {
        const isWork =
          type === 'mon-fri'
            ? d.dayOfWeek >= 1 && d.dayOfWeek <= 5
            : type === 'mon-sat'
            ? d.dayOfWeek >= 1 && d.dayOfWeek <= 6
            : true
        return {
          ...d,
          isWorkDay: isWork,
          entryTime: isWork ? (d.entryTime || '08:00') : null,
          exitTime: isWork ? (d.exitTime || '17:00') : null,
        }
      })
    )
  }

  const applyPresetToEdit = (type: 'mon-fri' | 'mon-sat' | 'all') => {
    setEditDays((prev) =>
      prev.map((d) => {
        const isWork =
          type === 'mon-fri'
            ? d.dayOfWeek >= 1 && d.dayOfWeek <= 5
            : type === 'mon-sat'
            ? d.dayOfWeek >= 1 && d.dayOfWeek <= 6
            : true
        return {
          ...d,
          isWorkDay: isWork,
          entryTime: isWork ? (d.entryTime || '08:00') : null,
          exitTime: isWork ? (d.exitTime || '17:00') : null,
        }
      })
    )
  }

  const handleCreateSchedule = async (e: FormEvent) => {
    e.preventDefault()
    setActionLoading('create')
    setFeedback(null)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        toleranceMinutes: Number(toleranceMinutes),
        days: days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorkDay: d.isWorkDay,
          entryTime: d.isWorkDay ? (d.entryTime || '08:00') : null,
          exitTime: d.isWorkDay ? (d.exitTime || '17:00') : null,
          crossesMidnight: d.isWorkDay && d.crossesMidnight,
        })),
      }

      await api.post('/schedules', payload)
      setFeedback({
        type: 'success',
        message: `Horario "${payload.name}" creado correctamente`,
      })
      setIsCreateOpen(false)
      loadSchedules()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible crear el horario',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleUpdateSchedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSchedule) return
    setActionLoading('edit')
    setFeedback(null)
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        toleranceMinutes: Number(editToleranceMinutes),
        days: editDays.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorkDay: d.isWorkDay,
          entryTime: d.isWorkDay ? (d.entryTime || '08:00') : null,
          exitTime: d.isWorkDay ? (d.exitTime || '17:00') : null,
          crossesMidnight: d.isWorkDay && d.crossesMidnight,
        })),
      }

      await api.patch(`/schedules/${selectedSchedule.id}`, payload)
      setFeedback({
        type: 'success',
        message: `Horario "${payload.name}" actualizado correctamente`,
      })
      setIsEditOpen(false)
      loadSchedules()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible actualizar el horario',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteSchedule = async (sch: WorkSchedule) => {
    if (!confirm(`¿Estás seguro de desactivar/eliminar el horario "${sch.name}"?`)) {
      return
    }
    setActionLoading(`delete-${sch.id}`)
    setFeedback(null)
    try {
      await api.delete(`/schedules/${sch.id}`)
      setFeedback({
        type: 'success',
        message: `Horario "${sch.name}" eliminado correctamente`,
      })
      loadSchedules()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible eliminar el horario',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAssignSchedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSchedule || selectedEmployeeIds.length === 0) return
    setActionLoading('assign')
    setFeedback(null)
    setAssignError('')
    try {
      await api.post(`/schedules/${selectedSchedule.id}/assign`, {
        employeeIds: selectedEmployeeIds,
        validFrom: assignValidFrom,
      })

      const count = selectedEmployeeIds.length
      const assignedNames = employees
        .filter((x) => selectedEmployeeIds.includes(x.id))
        .map((x) => x.name)
        .slice(0, 3)
        .join(', ')

      const summaryText =
        count === 1
          ? assignedNames
          : `${count} empleados (${assignedNames}${count > 3 ? '...' : ''})`

      setFeedback({
        type: 'success',
        message: `Horario "${selectedSchedule.name}" asignado exitosamente a ${summaryText} desde ${assignValidFrom}`,
      })
      setIsAssignOpen(false)
      await loadSchedules()
      if (selectedSchedule) {
        await loadAssignments(selectedSchedule.id)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No fue posible asignar el horario'
      // Si el backend detectó una baja/eliminación que quedó seleccionada en
      // memoria, quítala de inmediato para que el siguiente intento sea limpio.
      setSelectedEmployeeIds((ids) => ids.filter((id) => availableEmployees.some((employee) => employee.id === id)))
      try {
        const refreshed = await api.get<{ ok: boolean; data: EmployeeOption[] }>('/employees?limit=100')
        setEmployees(refreshed.data)
      } catch {
        // Conservamos el error original de la asignación.
      }
      setAssignError(message)
      setFeedback({
        type: 'error',
        message,
      })
    } finally {
      setActionLoading(null)
    }
  }

  const loadAssignments = async (scheduleId: string) => {
    setLoadingAssignments(true)
    try {
      const res = await api.get<{ ok: boolean; data: EmployeeScheduleAssignment[] }>(
        `/employee-schedules?scheduleId=${scheduleId}&active=true`
      )
      setAssignments(res.data || [])
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar empleados asignados',
      })
      setAssignments([])
    } finally {
      setLoadingAssignments(false)
    }
  }

  const handleOpenViewAssignments = (sch: WorkSchedule) => {
    setSelectedSchedule(sch)
    setAssignmentSearch('')
    setIsViewAssignmentsOpen(true)
    loadAssignments(sch.id)
  }

  const handleDeleteAssignment = async (assignmentId: string, employeeName: string) => {
    setActionLoading(`delete-assignment-${assignmentId}`)
    try {
      await api.delete(`/employee-schedules/${assignmentId}`)
      setFeedback({
        type: 'success',
        message: `Asignación de horario eliminada para ${employeeName}`,
      })
      if (selectedSchedule) {
        await loadAssignments(selectedSchedule.id)
      }
      loadSchedules()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible eliminar la asignación',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenEditAssignment = (asg: EmployeeScheduleAssignment) => {
    setEditingAssignment(asg)
    setEditAssignScheduleId(asg.scheduleId || selectedSchedule?.id || '')
    setEditAssignValidFrom(asg.validFrom ? asg.validFrom.slice(0, 10) : getTodayString())
    if (asg.validTo) {
      setEditAssignIsIndefinite(false)
      setEditAssignValidTo(asg.validTo.slice(0, 10))
    } else {
      setEditAssignIsIndefinite(true)
      setEditAssignValidTo('')
    }
  }

  const handleUpdateAssignment = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingAssignment) return

    if (!editAssignIsIndefinite && editAssignValidTo && editAssignValidTo < editAssignValidFrom) {
      setFeedback({
        type: 'error',
        message: 'La fecha "Vigente hasta" no puede ser anterior a "Vigente desde"',
      })
      return
    }

    setActionLoading(`update-assignment-${editingAssignment.id}`)
    setFeedback(null)
    try {
      await api.patch(`/employee-schedules/${editingAssignment.id}`, {
        scheduleId: editAssignScheduleId,
        validFrom: editAssignValidFrom,
        validTo: editAssignIsIndefinite ? null : editAssignValidTo || null,
      })

      const empName = editingAssignment.employee?.name || 'empleado'
      setFeedback({
        type: 'success',
        message: `Asignación de ${empName} actualizada correctamente`,
      })
      setEditingAssignment(null)
      if (selectedSchedule) {
        await loadAssignments(selectedSchedule.id)
      }
      loadSchedules()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible actualizar la asignación',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const filteredAssignments = assignments.filter((asg) => {
    if (!assignmentSearch.trim()) return true
    const term = assignmentSearch.toLowerCase()
    const nameMatch = asg.employee?.name.toLowerCase().includes(term) || false
    const idMatch = asg.employee?.deviceUserId.toLowerCase().includes(term) || false
    return nameMatch || idMatch
  })

  // Mapeo para saber qué horario tiene asignado un empleado actualmente en el sistema
  const employeeScheduleMap = useMemo(() => {
    const map = new Map<string, string>()
    schedules.forEach((sch) => {
      sch.employeeAssignments?.forEach((asg) => {
        if (asg.employeeId) map.set(asg.employeeId, sch.name)
      })
    })
    assignments.forEach((asg) => {
      if (asg.active !== false && asg.employeeId && selectedSchedule) {
        map.set(asg.employeeId, selectedSchedule.name)
      }
    })
    return map
  }, [schedules, assignments, selectedSchedule])

  // Empleados que ya tienen un horario activo en TODO el sistema (regla: 1 empleado sólo en 1 horario)
  const allAssignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>()
    schedules.forEach((sch) => {
      sch.employeeAssignments?.forEach((asg) => {
        if (asg.employeeId) ids.add(asg.employeeId)
      })
    })
    assignments.forEach((asg) => {
      if (asg.active !== false && asg.employeeId) ids.add(asg.employeeId)
    })
    return ids
  }, [schedules, assignments])

  // Empleados disponibles para asignar:
  // Solo los que NO tienen ningún horario asignado actualmente
  const availableEmployees = useMemo(() => {
    return employees.filter((emp) => emp.profile?.employmentStatus !== 'TERMINATED' && !emp.deletedAt && !allAssignedEmployeeIds.has(emp.id))
  }, [employees, allAssignedEmployeeIds])

  useEffect(() => {
    if (!isAssignOpen) return
    setSelectedEmployeeIds((ids) => ids.filter((id) => availableEmployees.some((employee) => employee.id === id)))
  }, [isAssignOpen, availableEmployees])

  // Filtrado de empleados disponibles por el término de búsqueda
  const searchedAvailableEmployees = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return availableEmployees
    return availableEmployees.filter((emp) => {
      const name = emp.name.toLowerCase()
      const deviceId = (emp.deviceUserId || '').toLowerCase()
      return name.includes(q) || deviceId.includes(q)
    })
  }, [availableEmployees, assignSearch])

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    const visibleIds = searchedAvailableEmployees.map((e) => e.id)
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedEmployeeIds.includes(id))

    if (allSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-amber-400" />
            <span>Horarios y Turnos Laborales</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configuración de jornadas semanales, tolerancias y asignación de personal
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-amber-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Horario</span>
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

      {/* Schedules List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
          <span>Cargando horarios...</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">No hay horarios creados</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Crea tu primer horario laboral para definir los turnos de entrada y salida de tus
            empleados.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Horario</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className={`bg-slate-900 border rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-sm transition-all ${
                sch.active ? 'border-slate-800' : 'border-slate-800/50 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3
                        className="text-base sm:text-lg font-bold text-white tracking-tight truncate"
                        title={sch.name}
                      >
                        {sch.name}
                      </h3>
                      <button
                        onClick={() => handleOpenViewAssignments(sch)}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                        title="Ver empleados que tienen asignado este horario"
                      >
                        <Users className="w-3 h-3" />
                        <span>
                          {sch.employeeAssignments ? sch.employeeAssignments.length : 0} asignado(s)
                        </span>
                      </button>
                      {!sch.active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap flex-shrink-0">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {sch.description && (
                      <p className="text-xs text-slate-400 mt-1 truncate" title={sch.description}>
                        {sch.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                      Tolerancia: {sch.toleranceMinutes} min
                    </span>
                    <button
                      onClick={() => handleOpenEdit(sch)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Editar horario"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(sch)}
                      disabled={actionLoading === `delete-${sch.id}`}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Eliminar horario"
                    >
                      {actionLoading === `delete-${sch.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Days matrix */}
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                    Días y Turnos
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {sch.days?.map((d) => (
                      <div
                        key={d.dayOfWeek}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          d.isWorkDay
                            ? 'bg-slate-950 border-slate-800 text-slate-200'
                            : 'bg-slate-900/40 border-slate-800/40 text-slate-500'
                        }`}
                      >
                        <span className="font-medium">{DAY_NAMES[d.dayOfWeek]}</span>
                        {d.isWorkDay ? (
                          <span className="font-mono text-amber-300 flex items-center gap-1">
                            <span>{d.entryTime?.slice(0, 5)}</span>
                            <span className="text-slate-500">→</span>
                            <span>{d.exitTime?.slice(0, 5)}</span>
                            {d.crossesMidnight ? (
                              <span className="text-[10px] text-indigo-400 font-sans ml-1">(+1d)</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="italic">Descanso</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Zona: {sch.timeZone}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenViewAssignments(sch)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                    title="Ver los empleados que tienen asignado este horario"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>
                      Ver Empleados ({sch.employeeAssignments ? sch.employeeAssignments.length : 0})
                    </span>
                  </button>
                  <button
                    onClick={() => handleOpenAssign(sch)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Asignar</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal CREAR HORARIO - Diseño Compacto y Ergonómico */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Fijo */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Nuevo Horario Laboral
                  </h3>
                  <p className="text-xs text-slate-400">Configuración de turnos semanales y tolerancias</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con scroll elegante */}
            <form id="create-schedule-form" onSubmit={handleCreateSchedule} className="p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Nombre del Horario *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Turno Matutino 8 a 5"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Tolerancia (Min) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    required
                    value={toleranceMinutes}
                    onChange={(e) => setToleranceMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles sobre este turno de trabajo..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Configuración de los 7 Días de la Semana
                    </label>
                    <span className="text-[11px] text-slate-500">Define qué días se trabaja y el horario de entrada/salida</span>
                  </div>

                  {/* Preajustes rápidos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Preajuste:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPresetToCreate('mon-fri')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Lun-Vie
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetToCreate('mon-sat')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Lun-Sáb
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetToCreate('all')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950">
                  {days.map((d, idx) => (
                    <div
                      key={d.dayOfWeek}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        d.isWorkDay
                          ? 'bg-slate-900 border-slate-750 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      {/* Nombre y Checkbox del día */}
                      <div className="flex items-center gap-2.5 min-w-[110px]">
                        <input
                          type="checkbox"
                          id={`create-day-${d.dayOfWeek}`}
                          checked={d.isWorkDay}
                          onChange={(e) => handleDayChange(idx, 'isWorkDay', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <label
                          htmlFor={`create-day-${d.dayOfWeek}`}
                          className={`text-sm font-semibold cursor-pointer ${
                            d.isWorkDay ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {DAY_NAMES[d.dayOfWeek]}
                        </label>
                      </div>

                      {/* Controles de Horario con apertura directa y colores refinados */}
                      {d.isWorkDay ? (
                        <div className="flex flex-col sm:items-end gap-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Entrada con selector personalizado */}
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                modal: 'create',
                                dayIndex: idx,
                                dayOfWeek: d.dayOfWeek,
                                field: 'entryTime',
                                currentTime: d.entryTime || '08:00',
                              })}
                              className="flex items-center gap-1.5 bg-amber-950/25 hover:bg-amber-900/40 border border-amber-500/30 hover:border-amber-400 active:scale-95 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer group shadow-sm shadow-amber-950/20"
                              title="Clic para definir hora de entrada"
                            >
                              <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-[11px] text-amber-300 font-semibold select-none">Entrada:</span>
                              <span className="text-xs font-mono font-bold text-amber-100">{formatTimeDisplay(d.entryTime || '08:00')}</span>
                            </button>

                            {/* Salida con selector personalizado */}
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                modal: 'create',
                                dayIndex: idx,
                                dayOfWeek: d.dayOfWeek,
                                field: 'exitTime',
                                currentTime: d.exitTime || '17:00',
                              })}
                              className="flex items-center gap-1.5 bg-indigo-950/25 hover:bg-indigo-900/40 border border-indigo-500/30 hover:border-indigo-400 active:scale-95 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer group shadow-sm shadow-indigo-950/20"
                              title="Clic para definir hora de salida"
                            >
                              <Moon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-[11px] text-indigo-300 font-semibold select-none">Salida:</span>
                              <span className="text-xs font-mono font-bold text-indigo-100">{formatTimeDisplay(d.exitTime || '17:00')}</span>
                            </button>
                          </div>

                          {/* Cruza medianoche escalonado con diseño interactivo */}
                          <div className="flex items-center">
                            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none transition-colors">
                              <input
                                type="checkbox"
                                checked={d.crossesMidnight}
                                onChange={(e) => handleDayChange(idx, 'crossesMidnight', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                              />
                              <span className={`text-[11px] ${d.crossesMidnight ? 'text-amber-300 font-medium' : 'text-slate-400 hover:text-slate-200'}`}>
                                Cruza medianoche {d.crossesMidnight ? <span className="text-[10px] text-amber-400/80">(termina al día siguiente)</span> : null}
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-1 flex items-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                            Día de descanso
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer Fijo */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="create-schedule-form"
                disabled={actionLoading === 'create'}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-amber-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Guardar Horario</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal EDITAR HORARIO - Diseño Compacto y Ergonómico */}
      {isEditOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header Fijo */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Editar Horario: {selectedSchedule.name}
                  </h3>
                  <p className="text-xs text-slate-400">Modifica turnos, días y parámetros de tolerancia</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con scroll elegante */}
            <form id="edit-schedule-form" onSubmit={handleUpdateSchedule} className="p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Nombre del Horario *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Tolerancia (Min) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={180}
                    required
                    value={editToleranceMinutes}
                    onChange={(e) => setEditToleranceMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Descripción
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalles sobre este turno de trabajo..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Configuración de los 7 Días de la Semana
                    </label>
                    <span className="text-[11px] text-slate-500">Define qué días se trabaja y el horario de entrada/salida</span>
                  </div>

                  {/* Preajustes rápidos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Preajuste:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPresetToEdit('mon-fri')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Lun-Vie
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetToEdit('mon-sat')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Lun-Sáb
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetToEdit('all')}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border border-slate-800 rounded-2xl p-3 bg-slate-950">
                  {editDays.map((d, idx) => (
                    <div
                      key={d.dayOfWeek}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        d.isWorkDay
                          ? 'bg-slate-900 border-slate-750 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      {/* Nombre y Checkbox del día */}
                      <div className="flex items-center gap-2.5 min-w-[110px]">
                        <input
                          type="checkbox"
                          id={`edit-day-${d.dayOfWeek}`}
                          checked={d.isWorkDay}
                          onChange={(e) => handleEditDayChange(idx, 'isWorkDay', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <label
                          htmlFor={`edit-day-${d.dayOfWeek}`}
                          className={`text-sm font-semibold cursor-pointer ${
                            d.isWorkDay ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          {DAY_NAMES[d.dayOfWeek]}
                        </label>
                      </div>

                      {/* Controles de Horario con apertura directa y colores refinados */}
                      {d.isWorkDay ? (
                        <div className="flex flex-col sm:items-end gap-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Entrada con selector personalizado */}
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                modal: 'edit',
                                dayIndex: idx,
                                dayOfWeek: d.dayOfWeek,
                                field: 'entryTime',
                                currentTime: d.entryTime || '08:00',
                              })}
                              className="flex items-center gap-1.5 bg-amber-950/25 hover:bg-amber-900/40 border border-amber-500/30 hover:border-amber-400 active:scale-95 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer group shadow-sm shadow-amber-950/20"
                              title="Clic para definir hora de entrada"
                            >
                              <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-[11px] text-amber-300 font-semibold select-none">Entrada:</span>
                              <span className="text-xs font-mono font-bold text-amber-100">{formatTimeDisplay(d.entryTime || '08:00')}</span>
                            </button>

                            {/* Salida con selector personalizado */}
                            <button
                              type="button"
                              onClick={() => setTimePickerTarget({
                                modal: 'edit',
                                dayIndex: idx,
                                dayOfWeek: d.dayOfWeek,
                                field: 'exitTime',
                                currentTime: d.exitTime || '17:00',
                              })}
                              className="flex items-center gap-1.5 bg-indigo-950/25 hover:bg-indigo-900/40 border border-indigo-500/30 hover:border-indigo-400 active:scale-95 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer group shadow-sm shadow-indigo-950/20"
                              title="Clic para definir hora de salida"
                            >
                              <Moon className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                              <span className="text-[11px] text-indigo-300 font-semibold select-none">Salida:</span>
                              <span className="text-xs font-mono font-bold text-indigo-100">{formatTimeDisplay(d.exitTime || '17:00')}</span>
                            </button>
                          </div>

                          {/* Cruza medianoche escalonado con diseño interactivo */}
                          <div className="flex items-center">
                            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none transition-colors">
                              <input
                                type="checkbox"
                                checked={d.crossesMidnight}
                                onChange={(e) => handleEditDayChange(idx, 'crossesMidnight', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                              />
                              <span className={`text-[11px] ${d.crossesMidnight ? 'text-amber-300 font-medium' : 'text-slate-400 hover:text-slate-200'}`}>
                                Cruza medianoche {d.crossesMidnight ? <span className="text-[10px] text-amber-400/80">(termina al día siguiente)</span> : null}
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-1 flex items-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                            Día de descanso
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer Fijo */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-schedule-form"
                disabled={actionLoading === 'edit'}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-amber-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'edit' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ASIGNAR HORARIO */}
      {isAssignOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner flex-shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Asignar Empleados
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecciona uno o varios trabajadores para este turno
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSchedule} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {assignError && (
                  <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                    {assignError}
                  </div>
                )}
                {/* Info del horario seleccionado */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Horario destino
                    </p>
                    <p className="text-sm font-bold text-amber-300 mt-0.5">
                      {selectedSchedule.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Tolerancia</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {selectedSchedule.toleranceMinutes} min
                    </span>
                  </div>
                </div>

                {/* Sección de Selección de Empleados */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Seleccionar Personal
                    </label>
                    {availableEmployees.length > 0 && (
                      <span className="text-xs text-slate-400 font-medium">
                        {selectedEmployeeIds.length} de {availableEmployees.length} seleccionados
                      </span>
                    )}
                  </div>

                  {availableEmployees.length === 0 ? (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-white">
                          No hay empleados disponibles para asignar
                        </p>
                        <p className="text-slate-300 leading-relaxed">
                          Todos los empleados registrados ({employees.length}) ya cuentan con un horario asignado en el sistema. Cada empleado sólo puede tener 1 horario activo. Para asignarlo a este turno, primero debes desasignarlo de su horario actual.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {/* Resumen de disponibilidad */}
                      <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-[11px] flex items-center justify-between text-slate-300">
                        <span>Personal disponible (sin turno): <strong className="text-emerald-400 font-semibold">{availableEmployees.length}</strong></span>
                        <span className="text-slate-400">Ya con horario asignado: <strong className="text-slate-200 font-semibold">{allAssignedEmployeeIds.size}</strong></span>
                      </div>
                      {/* Barra de Búsqueda */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          placeholder="Buscar por nombre o ID checador..."
                          className="w-full h-10 pl-9 pr-8 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                        {assignSearch && (
                          <button
                            type="button"
                            onClick={() => setAssignSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Botón rápido seleccionar / desmarcar todos */}
                      <div className="flex items-center justify-between px-1 text-xs">
                        <span className="text-slate-400">
                          {searchedAvailableEmployees.length}{' '}
                          {searchedAvailableEmployees.length === 1 ? 'coincidencia' : 'coincidencias'}
                        </span>
                        {searchedAvailableEmployees.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition-colors"
                          >
                            {searchedAvailableEmployees.every((e) =>
                              selectedEmployeeIds.includes(e.id)
                            )
                              ? 'Desmarcar todos'
                              : 'Seleccionar todos'}
                          </button>
                        )}
                      </div>

                      {/* Lista de Tarjetas de Empleados */}
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-slate-800/80 rounded-xl p-1.5 bg-slate-950/40">
                        {searchedAvailableEmployees.length === 0 ? (
                          <div className="py-8 text-center text-xs text-slate-500">
                            No se encontraron empleados que coincidan con "{assignSearch}"
                          </div>
                        ) : (
                          searchedAvailableEmployees.map((emp) => {
                            const isSelected = selectedEmployeeIds.includes(emp.id)
                            const currentSchedule = employeeScheduleMap.get(emp.id)
                            const initials = emp.name
                              .split(' ')
                              .map((n) => n[0])
                              .filter(Boolean)
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()

                            return (
                              <div
                                key={emp.id}
                                onClick={() => toggleSelectEmployee(emp.id)}
                                className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm shadow-amber-500/5'
                                    : 'bg-slate-900/60 border-slate-800/60 hover:bg-slate-800/40 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Checkbox Visual */}
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                                      isSelected
                                        ? 'bg-amber-500 border-amber-500 text-slate-950'
                                        : 'border-slate-600 bg-slate-950'
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>

                                  {/* Avatar Iniciales */}
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                                    {initials || 'U'}
                                  </div>

                                  {/* Información Empleado */}
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white truncate">
                                      {emp.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                                        ID Checador: {emp.deviceUserId}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Badge de Estado Actual */}
                                <div className="flex-shrink-0">
                                  {currentSchedule ? (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 max-w-[150px] truncate"
                                      title={`Actualmente en horario: ${currentSchedule}`}
                                    >
                                      En: {currentSchedule}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      Sin horario
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fecha a partir de la cual aplica */}
                <div>
                  <CustomDatePicker
                    label="Válido a partir de *"
                    value={assignValidFrom}
                    onChange={setAssignValidFrom}
                    required
                    accentColor="amber"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Si un empleado ya tenía otro horario, se cerrará automáticamente el día anterior.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    actionLoading === 'assign' ||
                    selectedEmployeeIds.length === 0 ||
                    availableEmployees.length === 0
                  }
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-amber-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'assign' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>
                    Asignar{' '}
                    {selectedEmployeeIds.length > 0
                      ? `(${selectedEmployeeIds.length} ${
                          selectedEmployeeIds.length === 1 ? 'empleado' : 'empleados'
                        })`
                      : ''}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal VER EMPLEADOS ASIGNADOS AL HORARIO */}
      {isViewAssignmentsOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl min-w-0 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 gap-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Empleados Asignados
                  </h3>
                  <p className="text-xs text-slate-400">
                    Horario:{' '}
                    <span className="text-amber-300 font-semibold break-all">{selectedSchedule.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewAssignmentsOpen(false)}
                aria-label="Cerrar empleados asignados" className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Listado de Empleados */}
            <div className="p-4 sm:p-6 min-h-0 overflow-y-auto flex-1 space-y-3">
              {loadingAssignments ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                  <p className="text-xs">Cargando asignaciones del horario...</p>
                </div>
              ) : filteredAssignments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200">
                    {assignmentSearch
                      ? 'No hay empleados que coincidan con la búsqueda'
                      : 'Sin empleados asignados a este horario'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {assignmentSearch
                      ? 'Prueba con otro término de búsqueda'
                      : 'Actualmente ningún empleado tiene activo este horario semanal.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1">
                    <span>
                      Total:{' '}
                      <strong className="text-slate-200">
                        {filteredAssignments.length}
                      </strong>{' '}
                      empleado(s) asignado(s)
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                    {filteredAssignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="min-w-0 break-words text-sm font-semibold text-white [overflow-wrap:anywhere]">
                                {asg.employee?.name || 'Empleado no encontrado'}
                              </span>
                              {asg.employee?.active === false && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <div className="mt-1 min-w-0 text-xs text-slate-400">
                              ID: <span className="font-mono font-semibold text-amber-400 break-all">{asg.employee?.deviceUserId || '—'}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-x-2.5 text-xs text-slate-400 mt-1 break-words">
                              <span>
                                Vigente desde:{' '}
                                <strong className="text-slate-300 font-mono">
                                  {asg.validFrom}
                                </strong>
                              </span>
                              <span className="hidden sm:inline" aria-hidden="true">•</span>
                              <span>
                                Hasta:{' '}
                                {asg.validTo ? (
                                  <strong className="text-slate-300 font-mono">
                                    {asg.validTo}
                                  </strong>
                                ) : (
                                  <span className="text-emerald-400 font-medium">
                                    Permanente / Indefinido
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full sm:w-auto shrink-0 items-center gap-2 sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAssignment(asg)}
                            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            title="Editar vigencia u horario de este empleado"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteAssignment(asg.id, asg.employee?.name || 'empleado')
                            }
                            disabled={actionLoading === `delete-assignment-${asg.id}`}
                            className="w-full sm:w-auto justify-center flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/20 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                            title="Desasignar horario de este empleado"
                          >
                            {actionLoading === `delete-assignment-${asg.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Desasignar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
              <span className="min-w-0 text-xs text-slate-500 break-words">
                Al desasignar, el empleado quedará sin este turno para cálculos futuros.
              </span>
              <button
                type="button"
                onClick={() => setIsViewAssignmentsOpen(false)}
                className="w-full sm:w-auto shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer ml-auto"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal EDITAR ASIGNACIÓN DE EMPLEADO */}
      {editingAssignment && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150 overflow-x-hidden">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner flex-shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Editar Asignación
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modifica el turno o fechas de vigencia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAssignment(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAssignment} className="p-5 sm:p-6 space-y-4">
              {/* Info del Empleado */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                  {editingAssignment.employee?.name
                    ? editingAssignment.employee.name
                        .split(' ')
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {editingAssignment.employee?.name || 'Empleado'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    ID Checador: {editingAssignment.employee?.deviceUserId || '—'}
                  </p>
                </div>
              </div>

              {/* Horario Destino */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Horario Asignado *
                </label>
                <select
                  required
                  value={editAssignScheduleId}
                  onChange={(e) => setEditAssignScheduleId(e.target.value)}
                  className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 cursor-pointer"
                >
                  {schedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.name} {sch.id === selectedSchedule?.id ? '(Actual)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Puedes transferir al empleado a otro horario directamente.
                </p>
              </div>

              {/* Válido a partir de */}
              <CustomDatePicker
                label="Válido a partir de (Fecha) *"
                value={editAssignValidFrom}
                onChange={setEditAssignValidFrom}
                required
                accentColor="blue"
              />

              {/* Válido hasta */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Vigencia de Fin
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAssignIsIndefinite}
                      onChange={(e) => {
                        setEditAssignIsIndefinite(e.target.checked)
                        if (e.target.checked) setEditAssignValidTo('')
                      }}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Permanente / Indefinido</span>
                  </label>
                </div>

                {!editAssignIsIndefinite && (
                  <CustomDatePicker
                    value={editAssignValidTo}
                    onChange={setEditAssignValidTo}
                    placeholder="Seleccionar fecha límite"
                    minDate={editAssignValidFrom}
                    required={!editAssignIsIndefinite}
                    accentColor="blue"
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `update-assignment-${editingAssignment.id}`}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-blue-600/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === `update-assignment-${editingAssignment.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Personalizado de Ajuste de Hora (Sustituye al selector nativo del navegador) */}
      {timePickerTarget && (
        <TimePickerModal
          isOpen={Boolean(timePickerTarget)}
          title={timePickerTarget.field === 'entryTime' ? 'Hora de Entrada' : 'Hora de Salida'}
          dayName={DAY_NAMES[timePickerTarget.dayOfWeek]}
          type={timePickerTarget.field === 'entryTime' ? 'entry' : 'exit'}
          initialTime={timePickerTarget.currentTime}
          onConfirm={handleConfirmCustomTime}
          onClose={() => setTimePickerTarget(null)}
        />
      )}
    </div>
  )
}
