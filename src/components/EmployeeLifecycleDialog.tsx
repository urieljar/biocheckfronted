import { useEffect, useState, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

export type LaborAction = 'terminate' | 'rehire' | 'archive' | 'restore' | 'history' | 'remove-device'
interface Props {
  employee: { id: string; name: string; deviceUserId: string }
  action: LaborAction
  onClose: () => void
  onSaved: (message: string) => void
}
interface Period { id: string; validFrom: string | null; validTo: string | null; terminationReason: string | null; notes: string | null }
const titles: Record<LaborAction, string> = { terminate: 'Dar de baja', rehire: 'Registrar reingreso', archive: 'Eliminar registro', restore: 'Recuperar registro', history: 'Historial laboral', 'remove-device': 'Retirar del checador' }
const input = 'w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white'
export default function EmployeeLifecycleDialog({ employee, action, onClose, onSaved }: Props) {
  const [today] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mazatlan' }).format(new Date()))
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('Renuncia voluntaria')
  const [notes, setNotes] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [forceDelete, setForceDelete] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [syncToDevice, setSyncToDevice] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Period[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    api.get<{ data: Period[] }>(`/employees/${employee.id}/employment-history`)
      .then((response) => { if (!cancelled) setHistory(response.data) })
      .catch(() => { if (!cancelled) setError('No fue posible consultar el historial laboral') })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [employee.id])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      if (action === 'remove-device') await api.post(`/employees/${employee.id}/remove-from-device`, { confirmation })
      else if (action === 'archive') await api.delete(`/employees/${employee.id}`, { confirmation, force: forceDelete })
      else if (action === 'restore') await api.post(`/employees/${employee.id}/restore`, {})
      else {
        await api.post(`/employees/${employee.id}/${action === 'terminate' ? 'termination' : 'rehire'}`, { date, reason, notes })
        if (action === 'rehire' && syncToDevice) {
          const sync = await api.post<{ deviceResult?: { transport?: string; status?: string }; message?: string }>(`/employees/${employee.id}/sync-to-device`, {})
          onSaved(sync.deviceResult?.status === 'PENDING'
            ? 'Reingreso registrado. El empleado fue enviado por ADMS y queda pendiente de confirmación del checador.'
            : 'Reingreso registrado y empleado enviado al checador.')
          return
        }
      }
      onSaved(action === 'terminate' ? 'Baja laboral registrada. Se conservó el historial.' : action === 'rehire' ? 'Reingreso registrado; no se envió al checador.' : action === 'archive' ? (forceDelete ? 'Registro y datos de prueba eliminados definitivamente.' : 'Registro eliminado de forma recuperable.') : action === 'remove-device' ? 'Retiro solicitado al checador. El historial local se conserva.' : 'Registro recuperado en BioCheck.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No fue posible guardar la operación') }
    finally { setSaving(false) }
  }
  return <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
    <div role="dialog" aria-modal="true" aria-labelledby="labor-dialog-title" className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6">
      <header className="flex justify-between items-start gap-3"><div><h3 id="labor-dialog-title" className="font-bold text-lg text-white">{titles[action]}</h3><p className="text-sm text-slate-300 mt-1">{employee.name} · {employee.deviceUserId}</p></div><button aria-label="Cerrar" type="button" disabled={saving} onClick={onClose} className="text-slate-400 p-1"><X className="w-5 h-5" /></button></header>
      {error && <p role="alert" className="my-4 p-3 rounded-xl bg-red-500/10 text-red-300 text-sm">{error}</p>}
      <form onSubmit={submit} className="mt-5 space-y-4">
        {(action === 'terminate' || action === 'rehire') && <>
          <label className="block text-sm text-slate-300">{action === 'terminate' ? 'Último día laboral' : 'Fecha de reingreso'}<input type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} className={`${input} mt-1`} /></label>
          {action === 'terminate' && <label className="block text-sm text-slate-300">Motivo de baja<select value={reason} onChange={(event) => setReason(event.target.value)} className={`${input} mt-1`}>{['Renuncia voluntaria', 'Fin de contrato', 'Despido', 'Fallecimiento', 'Otro'].map((value) => <option key={value}>{value}</option>)}</select></label>}
          <label className="block text-sm text-slate-300">Observaciones (opcionales)<textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${input} mt-1`} /></label>
          {action === 'rehire' && <label className="flex gap-2 items-start text-sm text-slate-300"><input type="checkbox" checked={syncToDevice} onChange={(event) => setSyncToDevice(event.target.checked)} className="mt-1" />Enviar nuevamente al checador después del reingreso</label>}
          <p className="text-xs text-slate-400">{action === 'terminate' ? 'Se conserva el expediente, los horarios y las checadas. Los días posteriores a la baja se excluyen de la pre-nómina.' : 'Se conserva el período anterior y se registra uno nuevo en la misma ficha. Revisa el horario asignado antes de calcular asistencia.'} Esta acción no elimina ni envía usuarios al reloj.</p>
        </>}
        {action === 'archive' && <>
          <p className="text-sm text-amber-200">Solo se pueden eliminar registros sin historial. El sistema bloqueará la eliminación si existen checadas, horarios u otras operaciones relacionadas.</p>
          <p className="text-xs text-slate-400">El registro podrá recuperarse desde Eliminados si no se fuerza la eliminación permanente. Esta acción no elimina al usuario del reloj.</p>
          <label className="block text-sm text-slate-300">Escribe {employee.deviceUserId} para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`${input} mt-1`} autoComplete="off" required /></label>
          <label className="flex gap-2 items-start text-xs text-rose-300 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 cursor-pointer">
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(event) => setForceDelete(event.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500"
            />
            <span>
              <strong>Forzar eliminación definitiva (Registro de pruebas):</strong> Elimina permanentemente al empleado y purga todo su historial de pruebas (checadas, horarios y configuraciones).
            </span>
          </label>
        </>}
        {action === 'restore' && <p className="text-sm text-slate-300">El registro volverá a aparecer en BioCheck. Esto no lo envía al reloj ni registra un reingreso laboral.</p>}
        {action === 'remove-device' && <>
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            <strong>Esta acción elimina del checador al usuario y sus datos biométricos.</strong>
            <p className="mt-1">Se perderán las huellas y el rostro guardados en el dispositivo. BioCheck conservará el expediente y las asistencias, pero no puede restaurar los biométricos.</p>
          </div>
          <label className="block text-sm text-slate-300">Escribe {employee.deviceUserId} para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={`${input} mt-1`} autoComplete="off" required /></label>
        </>}
        {action === 'history' && <div className="space-y-3">{historyLoading ? <p className="text-slate-400">Cargando historial...</p> : !history.length ? <p className="text-slate-400 text-sm">No hay movimientos laborales registrados. La información inicial permanece en el expediente.</p> : history.map((period) => <article key={period.id} className="p-3 border border-slate-700 rounded-xl text-sm text-slate-300"><p>Ingreso: {period.validFrom || 'Sin fecha registrada'}</p><p>Baja: {period.validTo || 'Período abierto'}</p>{period.terminationReason && <p>Motivo: {period.terminationReason}</p>}{period.notes && <p className="mt-2 whitespace-pre-wrap break-words">{period.notes}</p>}</article>)}</div>}
        {action !== 'history' && <label className="flex gap-2 items-start text-sm text-slate-300"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" required />Confirmo la operación para {employee.name}.</label>}
        <footer className="flex flex-wrap justify-end gap-3 pt-3 border-t border-slate-800"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-300">{action === 'history' ? 'Cerrar' : 'Cancelar'}</button>{action !== 'history' && <button type="submit" disabled={saving || !accepted || ((action === 'archive' || action === 'remove-device') && confirmation !== employee.deviceUserId)} className={`rounded-xl px-4 py-2 text-sm text-white disabled:opacity-40 flex gap-2 items-center ${action === 'archive' || action === 'terminate' || action === 'remove-device' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}{titles[action]}</button>}</footer>
      </form>
    </div>
  </div>
}
