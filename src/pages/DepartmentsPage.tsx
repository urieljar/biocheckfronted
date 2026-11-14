import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import {
  Building2,
  Briefcase,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  RefreshCw,
  Users,
} from 'lucide-react'

type CatalogType = 'departments' | 'positions' | 'areas'

interface CatalogItem {
  id: string
  code: string
  name: string
  parentId: string | null
  active: boolean
  parent?: {
    id: string
    code: string
    name: string
  }
  employeeCount?: number
  resignedCount?: number
}

export default function DepartmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as CatalogType | null
  const currentTab: CatalogType =
    tabParam && ['departments', 'positions', 'areas'].includes(tabParam)
      ? tabParam
      : 'departments'

  const handleTabChange = (tabKey: CatalogType) => {
    setSearchParams({ tab: tabKey })
  }

  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form inputs
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')

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

  const tabLabels: Record<CatalogType, { title: string; singular: string; icon: typeof Building2 }> = {
    departments: { title: 'Departamentos', singular: 'Departamento', icon: Building2 },
    positions: { title: 'Puestos de Trabajo', singular: 'Puesto', icon: Briefcase },
    areas: { title: 'Áreas Físicas', singular: 'Área', icon: MapPin },
  }

  const loadItems = async (catalog = currentTab) => {
    setLoading(true)
    try {
      const res = await api.get<{ ok: boolean; data: CatalogItem[] }>(`/catalogs/${catalog}`)
      setItems(res.data)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : `Error al cargar ${catalog}`,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    const fetchCatalog = async () => {
      try {
        const res = await api.get<{ ok: boolean; data: CatalogItem[] }>(`/catalogs/${currentTab}`)
        if (!ignore) {
          setItems(res.data)
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          setFeedback({
            type: 'error',
            message: err instanceof Error ? err.message : `Error al cargar ${currentTab}`,
          })
          setLoading(false)
        }
      }
    }
    fetchCatalog()
    return () => {
      ignore = true
    }
  }, [currentTab])

  const handleOpenCreate = () => {
    setCode('')
    setName('')
    setParentId('')
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (item: CatalogItem) => {
    setSelectedItem(item)
    setCode(item.code)
    setName(item.name)
    setParentId(item.parentId || '')
    setIsEditOpen(true)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setActionLoading('create')
    setFeedback(null)
    try {
      await api.post(`/catalogs/${currentTab}`, {
        code: code.trim(),
        name: name.trim(),
        parentId: parentId || null,
      })
      setFeedback({
        type: 'success',
        message: `${tabLabels[currentTab].singular} creado correctamente`,
      })
      setIsCreateOpen(false)
      loadItems(currentTab)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al guardar',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    setActionLoading('edit')
    setFeedback(null)
    try {
      await api.patch(`/catalogs/${currentTab}/${selectedItem.id}`, {
        code: code.trim(),
        name: name.trim(),
        parentId: parentId || null,
      })
      setFeedback({
        type: 'success',
        message: `${tabLabels[currentTab].singular} actualizado correctamente`,
      })
      setIsEditOpen(false)
      loadItems(currentTab)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al actualizar',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (item: CatalogItem) => {
    if (!confirm(`¿Estás seguro de eliminar ${tabLabels[currentTab].singular.toLowerCase()} "${item.name}"?`)) {
      return
    }
    setActionLoading(`delete-${item.id}`)
    setFeedback(null)
    try {
      await api.delete(`/catalogs/${currentTab}/${item.id}`)
      setFeedback({
        type: 'success',
        message: `${tabLabels[currentTab].singular} eliminado correctamente`,
      })
      loadItems(currentTab)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al eliminar',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const CurrentIcon = tabLabels[currentTab].icon

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span>Estructura y Organización</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de departamentos, puestos y áreas de la empresa
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadItems(currentTab)}
            disabled={loading}
            className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Recargar listado"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo {tabLabels[currentTab].singular}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {(['departments', 'positions', 'areas'] as CatalogType[]).map((tabKey) => {
          const tab = tabLabels[tabKey]
          const Icon = tab.icon
          const isActive = currentTab === tabKey
          return (
            <button
              key={tabKey}
              onClick={() => handleTabChange(tabKey)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.title}</span>
            </button>
          )
        })}
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

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Código</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Nombre</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Superior (Padre)</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Personal Asignado</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    <span>Cargando {tabLabels[currentTab].title.toLowerCase()}...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No hay {tabLabels[currentTab].title.toLowerCase()} registrados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 font-mono text-xs font-semibold text-emerald-400">
                      {item.code}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 font-medium text-slate-100">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-xs text-slate-400">
                      {item.parent ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">
                          {item.parent.name} ({item.parent.code})
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Principal</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.employeeCount ?? 0} asignados</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={actionLoading === `delete-${item.id}`}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Eliminar"
                        >
                          {actionLoading === `delete-${item.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CurrentIcon className="w-5 h-5 text-emerald-400" />
                <span>Nuevo {tabLabels[currentTab].singular}</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Código Único *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: DEP-01, RH, SISTEMAS"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Nombre del ${tabLabels[currentTab].singular.toLowerCase()}`}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Superior (Opcional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Ninguno (Es principal) --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
                </select>
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'create' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {isEditOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                <span>Editar {tabLabels[currentTab].singular}</span>
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Código Único *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Superior (Opcional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Ninguno (Es principal) --</option>
                  {items
                    .filter((i) => i.id !== selectedItem.id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.code})
                      </option>
                    ))}
                </select>
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
