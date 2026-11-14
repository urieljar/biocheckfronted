import { useEffect, useState, type FormEvent } from 'react'
import { CalendarCheck, Download, RefreshCw, Search, Loader2, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import CustomDatePicker from '../components/CustomDatePicker'

interface Option { id: string; name: string }
interface EventRow {
  id: string | number
  deviceUserId: string
  employeeName: string
  departmentName: string
  positionName: string
  localDate: string
  localTime: string
  eventLabel: string
  deviceIp?: string
  device?: { name: string; ip?: string }
}
interface EventResponse {
  data: EventRow[]
  timeZone: string
  pagination: { total: number; totalPages: number }
}
interface Filters { from: string; to: string; search: string; departmentId: string; positionId: string; deviceId: string }
const emptyFilters: Filters = { from: '', to: '', search: '', departmentId: '', positionId: '', deviceId: '' }
const queryFor = (filters: Filters) => new URLSearchParams(Object.entries(filters).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]))
const inputClass = 'w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed'

export default function AttendancesPage() {
  const { user } = useAuth()
  const [draft, setDraft] = useState<Filters>({ ...emptyFilters })
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters })
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState<EventResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [catalogs, setCatalogs] = useState<{ departments: Option[]; positions: Option[]; devices: Option[] }>({ departments: [], positions: [], devices: [] })
  const [catalogError, setCatalogError] = useState('')

  useEffect(() => {
    let ignore = false
    api.get<{ data: typeof catalogs }>('/attendances/filters').then((response) => {
      if (!ignore) setCatalogs(response.data)
    }).catch(() => { if (!ignore) setCatalogError('No se pudieron cargar los catálogos. Puedes buscar por nombre o número y recargar la página para reintentar.') })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setLoading(true)
      setError('')
      const query = queryFor(filters)
      query.set('page', String(page))
      query.set('limit', String(limit))
      try {
        const response = await api.get<EventResponse>(`/attendances/events?${query}`)
        if (!ignore) setReport(response)
      } catch (err) {
        if (!ignore) { setError(err instanceof Error ? err.message : 'No fue posible cargar los eventos'); setReport(null) }
      } finally { if (!ignore) setLoading(false) }
    }
    void load()
    return () => { ignore = true }
  }, [filters, page, limit, revision])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setError('La fecha inicial no puede ser posterior a la final'); return }
    setFilters({ ...draft }); setPage(1)
  }
  const clearFilters = () => { setDraft({ ...emptyFilters }); setFilters({ ...emptyFilters }); setPage(1); setNotice('') }
  const exportCsv = async () => {
    setExporting(true); setError(''); setNotice('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/attendances/export.csv?${queryFor(filters)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message || 'No fue posible exportar los eventos')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'eventos.csv'
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Se exportaron todos los eventos de los filtros aplicados.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al exportar') }
    finally { setExporting(false) }
  }
  const exportExcel = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/attendances/export.xls?${queryFor(filters)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!response.ok) throw new Error('No fue posible exportar a Excel')
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'eventos.xls'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al exportar') }
  }
  const synchronize = async () => {
    setSyncing(true); setError(''); setNotice('')
    try {
      const response = await api.post<{ message: string }>('/devices/sync-attendances')
      setNotice(response.message || 'Checadas descargadas del reloj')
      setPage(1); setRevision((value) => value + 1)
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al sincronizar') }
    finally { setSyncing(false) }
  }

  const total = report?.pagination.total || 0
  const pages = Math.max(report?.pagination.totalPages || 0, 1)
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><CalendarCheck className="h-6 w-6 text-indigo-400" />Eventos</h2>
          <p className="mt-1 text-sm text-slate-400">Registro original de checadas · Zona horaria: {report?.timeZone || 'America/Mazatlan'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={exportCsv} disabled={exporting || loading || !report || total === 0} className={buttonClass}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? 'Exportando…' : 'Exportar todos a CSV'}
          </button>
          <button type="button" onClick={exportExcel} disabled={exporting || loading || !report || total === 0} className={buttonClass}><Download className="h-4 w-4" />Excel</button>
          <button type="button" onClick={() => window.print()} disabled={loading || !report || total === 0} className={buttonClass}><Printer className="h-4 w-4" />PDF / Imprimir</button>
          {can(user?.role, 'attendance.sync') && <button type="button" onClick={synchronize} disabled={syncing || exporting} className={buttonClass}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Sincronizando…' : 'Descargar del reloj'}
          </button>}
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}
      {catalogError && <div role="alert" className="text-sm text-amber-300">{catalogError}</div>}
      <form onSubmit={applyFilters} className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <CustomDatePicker innerLabel="Desde" value={draft.from} onChange={(from) => setDraft((value) => ({ ...value, from }))} accentColor="indigo" className="w-full min-w-0" />
        <CustomDatePicker innerLabel="Hasta" value={draft.to} onChange={(to) => setDraft((value) => ({ ...value, to }))} accentColor="indigo" className="w-full min-w-0" />
        <label className="min-w-0 text-xs text-slate-400">Empleado: nombre, apellido o número
          <input aria-label="Buscar empleado" className={`${inputClass} mt-1`} value={draft.search} maxLength={255} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="Buscar empleado…" />
        </label>
        {(['departments', 'positions', 'devices'] as const).map((catalog) => {
          const field = { departments: 'departmentId', positions: 'positionId', devices: 'deviceId' }[catalog] as keyof Filters
          const label = { departments: 'Departamento', positions: 'Cargo', devices: 'Dispositivo' }[catalog]
          return <label key={catalog} className="min-w-0 text-xs text-slate-400">{label}
            <select className={`${inputClass} mt-1`} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}>
              <option value="">Todos</option>{catalogs[catalog].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        })}
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">
          <button type="submit" disabled={loading || exporting} className={`${buttonClass} bg-indigo-600`}><Search className="h-4 w-4" />Consultar</button>
          <button type="button" onClick={clearFilters} disabled={exporting} className={buttonClass}>Limpiar</button>
          <button type="button" aria-label="Actualizar eventos" onClick={() => setRevision((value) => value + 1)} disabled={loading || exporting} className={buttonClass}><RefreshCw className="h-4 w-4" /></button>
        </div>
      </form>
      <p className="text-xs text-slate-400">Cada fila corresponde a una checada original. Entrada y salida aparecen como “Sin clasificar” porque ese estado aún no se captura. Departamento y cargo corresponden al perfil actual.</p>
      <section aria-label="Resultados de eventos" aria-busy={loading} className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 text-sm text-slate-400">
          <span aria-live="polite">{loading ? 'Cargando eventos…' : `${total} eventos encontrados`}</span>
          <label>Filas <select aria-label="Filas por página" value={limit} disabled={exporting} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1) }} className="ml-2 rounded-lg bg-slate-800 p-2 text-slate-100">{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Tabla de eventos con desplazamiento horizontal">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-950/50 text-xs uppercase text-slate-400"><tr>{['ID empleado', 'Empleado', 'Departamento', 'Cargo', 'Fecha', 'Hora', 'Evento', 'Dispositivo'].map((title) => <th key={title} scope="col" className="px-4 py-3">{title}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {loading ? <tr><td colSpan={8} className="p-10 text-center text-slate-400"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Cargando eventos…</td></tr>
                : !report?.data.length ? <tr><td colSpan={8} className="p-10 text-center text-slate-400">{error ? 'No fue posible obtener los eventos.' : 'No hay eventos con los filtros aplicados.'}</td></tr>
                : report.data.map((item) => <tr key={item.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-indigo-300">{item.deviceUserId}</td>
                  <td className="max-w-64 whitespace-normal break-words px-4 py-3 font-medium">{item.employeeName}</td>
                  <td className="px-4 py-3">{item.departmentName}</td><td className="px-4 py-3">{item.positionName}</td>
                  <td className="px-4 py-3 font-mono">{item.localDate}</td><td className="px-4 py-3 font-mono">{item.localTime}</td>
                  <td className="px-4 py-3"><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400">{item.eventLabel}</span></td>
                  <td className="px-4 py-3">{item.device?.name || 'Sin información'}<span className="block text-xs text-slate-500">{item.deviceIp || item.device?.ip || 'Sin información'}</span></td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 p-4 text-xs text-slate-400 sm:flex-row">
          <span>{!loading && total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} de ${total}` : '0 registros'} · Página {page} de {pages}</span>
          <div className="flex gap-2"><button type="button" onClick={() => setPage((value) => value - 1)} disabled={loading || exporting || page <= 1} className={buttonClass}>Anterior</button><button type="button" onClick={() => setPage((value) => value + 1)} disabled={loading || exporting || page >= pages} className={buttonClass}>Siguiente</button></div>
        </footer>
      </section>
    </div>
  )
}
