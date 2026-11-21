import { useEffect, useState, type FormEvent } from 'react'
import { X, Loader2, Contact, Clock } from 'lucide-react'
import { api } from '../lib/api'
import CustomDatePicker from './CustomDatePicker'

import { type EmployeeProfileData, EMPTY_EMPLOYEE_PROFILE } from '../lib/employee-profile'

interface Option { id: string; code: string; name: string }
interface Assignment {
  id: string; validFrom: string; validTo: string | null; active: boolean
  schedule?: { name: string; type: string; days?: { dayOfWeek: number; isWorkDay: boolean; entryTime: string | null; exitTime: string | null; workMinutes: number | null }[] }
}
interface Props {
  employee: { id: string; name: string; deviceUserId: string }
  value: EmployeeProfileData
  onChange: (value: EmployeeProfileData) => void
  onSubmit: (event: FormEvent) => void
  onClose: () => void
  saving: boolean
  error: string
  departments: Option[]; positions: Option[]; areas: Option[]
}
const tabs = ['Perfil y organización', 'Información personal', 'Información laboral', 'Asistencia']
const inputClass = 'w-full min-w-0 h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
const dateLabel = (value: string | null) => value ? value.split('-').reverse().join('/') : 'Sin fecha final'

export default function EmployeeProfileForm({ employee, value, onChange, onSubmit, onClose, saving, error, departments, positions, areas }: Props) {
  const [tab, setTab] = useState(0)
  const [today] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mazatlan' }).format(new Date()))
  const [hasLaborHistory, setHasLaborHistory] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState('')
  useEffect(() => {
    let cancelled = false
    api.get<{ data: { id: string }[] }>(`/employees/${employee.id}/employment-history`)
      .then((response) => { if (!cancelled) setHasLaborHistory(response.data.length > 0) })
      .catch(() => { if (!cancelled) setHasLaborHistory(true) })
    api.get<{ data: Assignment[] }>(`/employee-schedules?employeeId=${employee.id}&all=true`)
      .then((response) => { if (!cancelled) setAssignments(response.data) })
      .catch((error) => { if (!cancelled) setScheduleError(error instanceof Error ? error.message : 'No fue posible consultar los horarios') })
      .finally(() => { if (!cancelled) setScheduleLoading(false) })
    return () => { cancelled = true }
  }, [employee.id])
  const field = (key: keyof typeof EMPTY_EMPLOYEE_PROFILE, label: string, type = 'text', readOnly = false) => (
    <label key={key} className="block min-w-0 text-sm text-slate-300">
      <span className="mb-1.5 block">{label}</span>
      <input type={type} maxLength={255} value={value[key]} readOnly={readOnly} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={`${inputClass}${readOnly ? ' cursor-not-allowed text-slate-400 bg-slate-900' : ''}`} />
    </label>
  )
  const catalog = (key: 'departmentId' | 'positionId' | 'areaId', label: string, options: Option[]) => (
    <label key={key} className="block min-w-0 text-sm text-slate-300">
      <span className="mb-1.5 block">{label}</span>
      <select value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={inputClass}>
        <option value="">Sin asignar</option>
        {value[key] && !options.some((option) => option.id === value[key]) && <option value={value[key]}>Asignación actual (catálogo no disponible)</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.code ? ` (${option.code})` : ''}</option>)}
      </select>
    </label>
  )
  const dateField = (key: 'hireDate' | 'birthDate' | 'terminationDate', label: string) => (
    <div key={key} className="min-w-0"><CustomDatePicker label={label} disabled={key === 'hireDate' && hasLaborHistory} value={value[key]} onChange={(date) => onChange({ ...value, [key]: date })} maxDate={key === 'birthDate' ? today : undefined} minDate={key === 'terminationDate' ? value.hireDate || undefined : undefined} accentColor="emerald" size="sm" clearable /></div>
  )
  // Todos los paneles conservan sus campos para validar también los que no se ven.
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const invalid = Array.from(form.elements).find((element) => element instanceof HTMLInputElement && !element.validity.valid) as HTMLInputElement | undefined
    if (invalid) {
      const panel = invalid.closest<HTMLElement>('[data-panel]')
      if (panel) setTab(Number(panel.dataset.panel))
      requestAnimationFrame(() => invalid.reportValidity())
      return
    }
    if (value.terminationDate && value.hireDate && value.terminationDate < value.hireDate) {
      setTab(2)
      return
    }
    onSubmit(event)
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="employee-profile-title" className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col shadow-2xl min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0"><h3 id="employee-profile-title" className="text-lg font-bold text-white flex gap-2 items-center"><Contact className="w-5 h-5 text-emerald-400 shrink-0" /><span className="truncate">Expediente: {employee.name}</span></h3><p className="text-xs text-slate-400 mt-1">ID del checador: {employee.deviceUserId}</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar expediente" className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </header>
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Secciones del expediente">
          {tabs.map((label, index) => <button key={label} id={`profile-tab-${index}`} type="button" role="tab" aria-selected={tab === index} aria-controls={`profile-panel-${index}`} onClick={() => setTab(index)} className={`rounded-lg px-2 py-2 text-xs sm:text-sm font-medium ${tab === index ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800 border border-transparent'}`}>{label}</button>)}
        </div>
        <form noValidate onSubmit={submit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto min-h-0 p-4 sm:p-6">
            {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            <fieldset disabled={saving} className="min-w-0">
              <section role="tabpanel" id="profile-panel-0" aria-labelledby="profile-tab-0" data-panel="0" hidden={tab !== 0}>
                <h4 className="font-semibold text-emerald-300 mb-4">Perfil y organización</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {field('firstName', 'Nombre(s)', 'text', true)}{field('lastName', 'Apellidos')}{field('employeeNumber', 'Número de empleado')}
                  {catalog('departmentId', 'Departamento', departments)}{catalog('positionId', 'Puesto', positions)}{catalog('areaId', 'Área', areas)}
                </div>
              </section>
              <section role="tabpanel" id="profile-panel-1" aria-labelledby="profile-tab-1" data-panel="1" hidden={tab !== 1}>
                <h4 className="font-semibold text-emerald-300 mb-4">Información personal</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {field('nationalId', 'CURP / Identificación')}{field('socialSecurityNumber', 'NSS (Seguridad Social)')}{dateField('birthDate', 'Fecha de nacimiento')}
                  {field('phone', 'Teléfono', 'tel')}{field('mobilePhone', 'Celular', 'tel')}{field('officePhone', 'Teléfono de oficina', 'tel')}
                  {field('email', 'Correo electrónico', 'email')}{field('address', 'Domicilio')}{field('city', 'Ciudad')}{field('postalCode', 'Código postal')}
                </div>
                <details className="mt-5 border-t border-slate-800 pt-4"><summary className="text-sm text-slate-300 cursor-pointer">Identificaciones adicionales (opcionales)</summary><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">{field('passportNumber', 'Pasaporte')}{field('driverLicenseVehicle', 'Licencia de conducir vehículos')}{field('driverLicenseMotorcycle', 'Licencia de conducir motocicletas')}</div></details>
              </section>
              <section role="tabpanel" id="profile-panel-2" aria-labelledby="profile-tab-2" data-panel="2" hidden={tab !== 2}>
                <h4 className="font-semibold text-emerald-300 mb-4">Información laboral</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {field('employmentType', 'Tipo de empleo')}{dateField('hireDate', 'Fecha de ingreso')}
                  <div className="text-sm text-slate-300"><span className="block mb-1.5">Estado laboral</span><p className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">{value.employmentStatus === 'TERMINATED' ? 'Baja' : value.employmentStatus === 'ACTIVE' ? 'En servicio' : 'Sin registrar'}</p></div>
                </div>
                <p className="text-xs text-slate-400 mt-4">Registra bajas y reingresos desde Más acciones en la lista de empleados. El historial conserva los períodos trabajados.</p>
                {value.employmentStatus === 'TERMINATED' && <div className="mt-4 p-4 rounded-xl border border-amber-500/30 text-sm text-amber-200"><p>Fecha de baja: {value.terminationDate || 'Sin registrar'}</p><p>Motivo: {value.terminationReason || 'Sin registrar'}</p></div>}
              </section>
              <section role="tabpanel" id="profile-panel-3" aria-labelledby="profile-tab-3" data-panel="3" hidden={tab !== 3}>
                <h4 className="font-semibold text-emerald-300 mb-2 flex items-center gap-2"><Clock className="w-4 h-4" />Horario asignado y vigencias</h4>
                <p className="text-sm text-slate-400 mb-4">Consulta las asignaciones registradas. Para asignar o cambiar un horario, utiliza Horarios Laborales.</p>
                {scheduleLoading ? <p className="text-slate-400 flex gap-2 items-center"><Loader2 className="w-4 h-4 animate-spin" />Cargando horarios...</p> : scheduleError ? <p role="alert" className="text-red-300">{scheduleError}</p> : assignments.length === 0 ? <p className="p-4 rounded-xl bg-slate-950 text-slate-400">No hay asignaciones de horario registradas.</p> : <div className="space-y-3">{assignments.map((assignment) => <article key={assignment.id} className="rounded-xl border border-slate-700 p-4"><div className="flex flex-wrap gap-2 justify-between"><h5 className="font-medium text-white">{assignment.schedule?.name || 'Horario no disponible'}</h5><span className={`text-xs ${assignment.active ? 'text-emerald-300' : 'text-slate-400'}`}>{!assignment.active ? 'Desactivada' : assignment.validFrom > today ? 'Programada' : assignment.validTo && assignment.validTo < today ? 'Finalizada' : 'Vigente'}</span></div><p className="text-sm text-slate-400 mt-2">Desde {dateLabel(assignment.validFrom)} · Hasta {dateLabel(assignment.validTo)}</p><p className="text-xs text-slate-500 mt-1">{({ NORMAL: 'Normal', FLEXIBLE: 'Flexible', MIXED: 'Mixto' } as Record<string, string>)[assignment.schedule?.type || ''] || assignment.schedule?.type}</p><div className="flex flex-wrap gap-2 mt-3">{assignment.schedule?.days?.map((day) => <span key={day.dayOfWeek} className="text-xs text-slate-300 bg-slate-800 rounded-lg px-2 py-1">{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][day.dayOfWeek]}: {!day.isWorkDay ? 'Descanso' : day.entryTime && day.exitTime ? `${day.entryTime.slice(0, 5)}–${day.exitTime.slice(0, 5)}` : day.workMinutes ? `${day.workMinutes} min` : 'Laboral'}</span>)}</div></article>)}</div>}
              </section>
            </fieldset>
          </div>
          <footer className="flex flex-wrap items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-800 shrink-0">
            <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm">Cancelar</button>
            <button type="submit" disabled={saving || (value.employmentStatus === 'TERMINATED' && (!value.terminationDate || !value.terminationReason.trim()))} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Guardar expediente</button>
          </footer>
        </form>
      </div>
    </div>
  )
}
