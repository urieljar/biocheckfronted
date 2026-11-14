import { useState, useEffect, type FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { assignableRoles, canManageUser, normalizeRole, roleLabel } from '../lib/permissions'
import {
  ShieldCheck,
  Search,
  UserPlus,
  Edit2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  RefreshCw,
  Power,
} from 'lucide-react'

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

interface UsersResponse {
  ok: boolean
  data: UserItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function UsersPage() {
  const { user: actor } = useAuth()
  const roleOptions = assignableRoles(actor?.role)
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('CONSULTA')

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

  const loadUsers = async (pageNum = page, searchQuery = search) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: String(pageNum),
        limit: '15',
        ...(searchQuery ? { search: searchQuery } : {}),
      })
      const res = await api.get<UsersResponse>(`/users?${queryParams.toString()}`)
      setUsers(res.data)
      setTotalPages(res.pagination.totalPages || 1)
      setTotal(res.pagination.total || 0)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cargar usuarios',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers(page, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers(1, search)
  }

  const handleOpenCreate = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRole('CONSULTA')
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user)
    setName(user.name)
    setEmail(user.email)
    setRole(normalizeRole(user.role) ?? 'CONSULTA')
    setIsEditOpen(true)
  }

  const handleOpenPassword = (user: UserItem) => {
    setSelectedUser(user)
    setPassword('')
    setIsPasswordOpen(true)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setActionLoading('create')
    setFeedback(null)
    try {
      await api.post('/users', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      })
      setFeedback({
        type: 'success',
        message: 'Usuario creado exitosamente',
      })
      setIsCreateOpen(false)
      loadUsers(1, '')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible crear el usuario',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setActionLoading('edit')
    setFeedback(null)
    try {
      await api.patch(`/users/${selectedUser.id}`, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      })
      setFeedback({
        type: 'success',
        message: 'Usuario actualizado correctamente',
      })
      setIsEditOpen(false)
      loadUsers(page, search)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No fue posible actualizar el usuario',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setActionLoading('password')
    setFeedback(null)
    try {
      await api.patch(`/users/${selectedUser.id}/password`, {
        password,
      })
      setFeedback({
        type: 'success',
        message: `Contraseña restablecida correctamente para ${selectedUser.name}`,
      })
      setIsPasswordOpen(false)
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'No fue posible cambiar la contraseña',
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = !user.active
    setActionLoading(`status-${user.id}`)
    setFeedback(null)
    try {
      await api.patch(`/users/${user.id}/status`, {
        active: newStatus,
      })
      setFeedback({
        type: 'success',
        message: `Usuario ${user.name} ${newStatus ? 'activado' : 'desactivado'} correctamente`,
      })
      loadUsers(page, search)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al cambiar estado',
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <span>Usuarios del Sistema</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cuentas con acceso al panel BioCheck, con permisos según su rol
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-medium rounded-xl transition-all shadow-md shadow-purple-600/20 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Nuevo Usuario</span>
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

      {/* Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </form>

        <button
          onClick={() => loadUsers(page, search)}
          disabled={loading}
          className="p-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          title="Recargar listado"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Usuario</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Correo</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Rol</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Estado</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4">Último Acceso</th>
                <th className="py-3 px-3 sm:py-3.5 sm:px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
                    <span>Cargando usuarios...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 font-medium text-slate-100">{u.name}</td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-slate-300 text-xs">{u.email}</td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium">
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Activo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span>Inactivo</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-xs text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}
                    </td>
                    <td className="py-2.5 px-3 sm:py-3.5 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {canManageUser(actor?.role, u.role) ? (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={actionLoading === `status-${u.id}`}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                u.active
                                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-500 border-slate-700'
                              }`}
                              title={u.active ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenPassword(u)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Restablecer contraseña"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Editar datos"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span
                            className="text-[11px] text-slate-500 px-2"
                            title="Solo ROOT puede administrar cuentas ADMIN o ROOT"
                          >
                            Solo ROOT
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-3 sm:px-4 py-3 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              Página {page} de {totalPages} ({total} usuarios)
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

      {/* Modal Crear Usuario */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <span>Nuevo Usuario</span>
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
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Administrador General"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Contraseña (mínimo 10 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Rol del Usuario
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>{roleLabel(option)}</option>
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
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

      {/* Modal Editar Datos */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <span>Editar Usuario</span>
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
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Rol del Usuario
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                >
                  {roleOptions.map((option) => (
                    <option key={option} value={option}>{roleLabel(option)}</option>
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
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

      {/* Modal Cambiar Contraseña */}
      {isPasswordOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Restablecer Contraseña ({selectedUser.name})</span>
              </h3>
              <button
                onClick={() => setIsPasswordOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Nueva Contraseña (mínimo 10 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasswordOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'password'}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'password' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>Actualizar Contraseña</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
