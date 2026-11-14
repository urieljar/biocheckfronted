import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { can, roleLabel, type Capability } from '../lib/permissions'
import {
  Fingerprint,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Clock,
  Building2,
  ShieldCheck,
  ShieldAlert,
  UserCircle,
  LogOut,
  Calculator,
  CalendarHeart,
  Briefcase,
  MapPin,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Server,
  Layers,
  Settings,
  FileCheck2,
  Radio,
  ClipboardList,
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

type TopModuleId = 'personal' | 'asistencia' | 'dispositivo' | 'sistema' | 'dashboard' | 'root'

interface SubMenuItem {
  label: string
  to: string
  icon: typeof Users
  badge?: string
  exact?: boolean
  capability?: Capability
  isActive: (path: string, tabParam: string | null) => boolean
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const role = user?.role
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const path = location.pathname
  const tabParam = searchParams.get('tab')

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('biocheck_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Collapsible groups in sidebar
  const [approvalsOpen, setApprovalsOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(true)

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('biocheck_sidebar_collapsed', String(next))
      } catch {
        // fallback
      }
      return next
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Detectar módulo superior activo según la ruta actual
  const getActiveTopModule = (): TopModuleId => {
    if (path.startsWith('/panel-root')) return 'root'
    if (path.startsWith('/empleado') || path.startsWith('/departamento')) return 'personal'
    if (
      path.startsWith('/asistencia') ||
      path.startsWith('/horario') ||
      path.startsWith('/calculo') ||
      path.startsWith('/incidencia') ||
      path.startsWith('/reporte')
    )
      return 'asistencia'
    if (path.startsWith('/usuario') || path.startsWith('/perfil') || path.startsWith('/auditoria')) return 'sistema'
    if (path === '/') return 'dashboard'
    return 'personal'
  }

  const activeTopModule = getActiveTopModule()

  // Módulos de la barra superior (Estructura tipo BioTime PRO con paleta original)
  const topModules = [
    {
      id: 'personal' as TopModuleId,
      label: 'Personal',
      icon: Users,
      defaultRoute: can(role, 'catalog.write') ? '/departamentos?tab=departments' : '/empleados',
    },
    {
      id: 'asistencia' as TopModuleId,
      label: 'Asistencia',
      icon: CalendarCheck,
      defaultRoute: '/asistencias',
    },
    {
      id: 'dispositivo' as TopModuleId,
      label: 'Dispositivo',
      icon: Server,
      defaultRoute: '/asistencias',
    },
    {
      id: 'sistema' as TopModuleId,
      label: 'Sistema',
      icon: Settings,
      defaultRoute: can(role, 'user.manage') ? '/usuarios' : '/perfil',
    },
    ...(can(role, 'system.rootControl')
      ? [
          {
            id: 'root' as TopModuleId,
            label: 'Control ROOT',
            icon: ShieldAlert,
            defaultRoute: '/panel-root',
          },
        ]
      : []),
    {
      id: 'dashboard' as TopModuleId,
      label: 'Dashboard',
      icon: LayoutDashboard,
      defaultRoute: '/',
    },
  ]

  // Sub-opciones de la barra lateral para Personal
  const personalMenuItems: SubMenuItem[] = [
    {
      label: 'Departamento',
      to: '/departamentos?tab=departments',
      icon: Building2,
      capability: 'catalog.write',
      isActive: (p, tab) => p === '/departamentos' && (!tab || tab === 'departments'),
    },
    {
      label: 'Cargo',
      to: '/departamentos?tab=positions',
      icon: Briefcase,
      capability: 'catalog.write',
      isActive: (p, tab) => p === '/departamentos' && tab === 'positions',
    },
    {
      label: 'Área',
      to: '/departamentos?tab=areas',
      icon: MapPin,
      capability: 'catalog.write',
      isActive: (p, tab) => p === '/departamentos' && tab === 'areas',
    },
    {
      label: 'Empleado',
      to: '/empleados',
      icon: Users,
      isActive: (p) => p === '/empleados',
    },
  ]

  // Sub-opciones de la barra lateral para Asistencia
  const asistenciaMenuItems: SubMenuItem[] = [
    {
      label: 'Eventos',
      to: '/asistencias',
      icon: CalendarCheck,
      isActive: (p) => p === '/asistencias',
    },
    {
      label: 'Horarios Laborales',
      to: '/horarios',
      icon: Clock,
      capability: 'schedule.write',
      isActive: (p) => p === '/horarios',
    },
    {
      label: 'Cálculo / Pre-Nómina',
      to: '/calculo-asistencias',
      icon: Calculator,
      isActive: (p) => p === '/calculo-asistencias',
    },
    {
      label: 'Incidencias y Festivos',
      to: '/incidencias',
      icon: CalendarHeart,
      capability: 'exception.write',
      isActive: (p) => p === '/incidencias',
    },
    {
      label: 'Reportes importantes',
      to: '/reportes',
      icon: FileCheck2,
      isActive: (p) => p === '/reportes',
    },
  ]

  // Sub-opciones de la barra lateral para Sistema
  const sistemaMenuItems: SubMenuItem[] = [
    ...(can(role, 'system.rootControl')
      ? [
          {
            label: 'Control Maestro ROOT',
            to: '/panel-root',
            icon: ShieldAlert,
            capability: 'system.rootControl' as Capability,
            badge: 'ROOT',
            isActive: (p: string) => p === '/panel-root',
          },
        ]
      : []),
    {
      label: 'Usuarios del Sistema',
      to: '/usuarios',
      icon: ShieldCheck,
      capability: 'user.manage',
      isActive: (p) => p === '/usuarios',
    },
    {
      label: 'Auditoría',
      to: '/auditoria',
      icon: ClipboardList,
      capability: 'audit.read',
      isActive: (p) => p === '/auditoria',
    },
    {
      label: 'Mi Perfil',
      to: '/perfil',
      icon: UserCircle,
      isActive: (p) => p === '/perfil',
    },
  ]

  // Sub-opciones de la barra lateral para Control ROOT
  const rootMenuItems: SubMenuItem[] = [
    {
      label: 'Matriz de Permisos',
      to: '/panel-root',
      icon: ShieldCheck,
      capability: 'system.rootControl',
      isActive: (p) => p === '/panel-root',
    },
    {
      label: 'Usuarios del Sistema',
      to: '/usuarios',
      icon: Users,
      capability: 'user.manage',
      isActive: (p) => p === '/usuarios',
    },
    {
      label: 'Mi Perfil',
      to: '/perfil',
      icon: UserCircle,
      isActive: (p) => p === '/perfil',
    },
  ]

  // Sub-opciones de la barra lateral para Dashboard
  const dashboardMenuItems: SubMenuItem[] = [
    {
      label: 'Resumen General',
      to: '/',
      icon: LayoutDashboard,
      isActive: (p) => p === '/',
    },
  ]

  // El menú muestra solo lo que el rol puede abrir; la ruta además está protegida
  // con RequireCapability, así que escribir la URL tampoco da acceso.
  const visibleItems = (items: SubMenuItem[]) =>
    items.filter((item) => !item.capability || can(role, item.capability))

  // Obtener items principales de la barra lateral según la categoría activa
  const getCurrentSidebarItems = (): { title: string; items: SubMenuItem[] } => {
    switch (activeTopModule) {
      case 'root':
        return { title: 'Control Maestro ROOT', items: visibleItems(rootMenuItems) }
      case 'personal':
        return { title: 'Personal y Estructura', items: visibleItems(personalMenuItems) }
      case 'asistencia':
        return { title: 'Gestión de Asistencia', items: visibleItems(asistenciaMenuItems) }
      case 'dispositivo':
        return { title: 'Reloj Checador (ZKTeco)', items: visibleItems(asistenciaMenuItems) }
      case 'sistema':
        return {
          title: can(role, 'user.manage') ? 'Configuración del Sistema' : 'Mi Cuenta',
          items: visibleItems(sistemaMenuItems),
        }
      case 'dashboard':
        return { title: 'Panel de Control', items: dashboardMenuItems }
      default:
        return { title: 'Personal', items: visibleItems(personalMenuItems) }
    }
  }

  const currentSection = getCurrentSidebarItems()

  const handleTopModuleClick = (mod: (typeof topModules)[0]) => {
    navigate(mod.defaultRoute)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ======================================================== */}
      {/* 1. TOP NAVBAR - Paleta Original Slate 900 con Azul       */}
      {/* ======================================================== */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="w-full px-3 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo y Botón de Toggle Sidebar */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileDrawerOpen(true)
                } else {
                  toggleSidebar()
                }
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Menú lateral"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-105 transition-transform flex-shrink-0">
                <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="truncate">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                  BioCheck
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:block">Sistema ZKTeco MB160</p>
              </div>
            </Link>
          </div>

          {/* Módulos Principales de la Barra Superior */}
          <nav className="hidden md:flex items-center gap-1.5">
            {topModules.map((mod) => {
              const isActive = activeTopModule === mod.id
              const Icon = mod.icon
              return (
                <button
                  key={mod.id}
                  onClick={() => handleTopModuleClick(mod)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{mod.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Perfil de usuario y Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {can(role, 'system.rootControl') && (
              <NavLink
                to="/panel-root"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                    isActive
                      ? 'bg-amber-500/25 border-amber-500/50 text-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-gradient-to-r from-amber-500/10 to-purple-500/10 hover:from-amber-500/20 hover:to-purple-500/20 border-amber-500/35 text-amber-300 hover:text-white'
                  }`
                }
                title="Panel de Control Maestro ROOT (Nivel 0)"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Panel ROOT</span>
              </NavLink>
            )}

            <NavLink
              to="/perfil"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm transition-all border ${
                  isActive
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`
              }
              title="Ver mi perfil"
            >
              <UserCircle className="w-5 h-5 text-blue-400" />
              <div className="text-left hidden lg:block">
                <p className="text-xs font-semibold text-slate-200 leading-tight">
                  {user?.name || 'Administrador'}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {roleLabel(user?.role)}
                </p>
              </div>
            </NavLink>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Sub-barra superior para pantallas móviles */}
        <div className="md:hidden border-t border-slate-800/80 px-2 py-1.5 flex items-center bg-slate-900/95 overflow-x-auto gap-1">
          {topModules.map((mod) => {
            const isActive = activeTopModule === mod.id
            const Icon = mod.icon
            return (
              <button
                key={mod.id}
                onClick={() => handleTopModuleClick(mod)}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mod.label}</span>
              </button>
            )
          })}
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN LAYOUT: SIDEBAR IZQUIERDA + CONTENIDO PRINCIPAL */}
      {/* ======================================================== */}
      <div className="flex-1 flex w-full relative">
        {/* BARRA LATERAL IZQUIERDA (Desktop) */}
        <aside
          className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 flex-shrink-0 transition-all duration-200 ${
            sidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          {/* Header del módulo activo en la barra lateral */}
          {!sidebarCollapsed && (
            <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider truncate">
                  {currentSection.title}
                </span>
              </div>
            </div>
          )}

          {/* Lista de sub-opciones principales (Departamento, Cargo, Área, Empleado, etc.) */}
          <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            <div className="space-y-1">
              {currentSection.items.map((item) => {
                const Icon = item.icon
                const active = item.isActive(path, tabParam)

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                      active
                        ? 'bg-blue-500/15 text-blue-300 border-l-4 border-blue-500 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        active
                          ? 'text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>

            {/* Grupos Colapsables adicionales estilo BioTime Pro con Paleta Original */}
            {!sidebarCollapsed && (
              <div className="pt-4 mt-3 border-t border-slate-800 space-y-3">
                {/* Flujo de Aprobaciones / Nómina */}
                <div>
                  <button
                    onClick={() => setApprovalsOpen(!approvalsOpen)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Flujo de Aprobaciones</span>
                    </div>
                    {approvalsOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                    )}
                  </button>

                  {approvalsOpen && (
                    <div className="mt-1 space-y-0.5 pl-2 animate-in fade-in duration-100">
                      <NavLink
                        to="/calculo-asistencias"
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isActive
                              ? 'text-blue-300 bg-blue-500/15 font-semibold border-l-2 border-blue-500'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`
                        }
                      >
                        <Calculator className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pre-Nómina y Cálculo</span>
                      </NavLink>

                      {can(role, 'exception.write') && (
                        <NavLink
                          to="/incidencias"
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isActive
                                ? 'text-blue-300 bg-blue-500/15 font-semibold border-l-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`
                          }
                        >
                          <CalendarHeart className="w-3.5 h-3.5 text-rose-400" />
                          <span>Vacaciones y Festivos</span>
                        </NavLink>
                      )}
                    </div>
                  )}
                </div>

                {/* Configuraciones: solo roles con catalog.write */}
                {can(role, 'catalog.write') && (
                  <div>
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-amber-400" />
                        <span>Configuraciones</span>
                      </div>
                      {settingsOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      )}
                    </button>

                    {settingsOpen && (
                      <div className="mt-1 space-y-0.5 pl-2 animate-in fade-in duration-100">
                        <NavLink
                          to="/horarios"
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isActive
                                ? 'text-blue-300 bg-blue-500/15 font-semibold border-l-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`
                          }
                        >
                          <Clock className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Horarios Laborales</span>
                        </NavLink>

                        <NavLink
                          to="/departamentos?tab=departments"
                          className={() =>
                            `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              path === '/departamentos'
                                ? 'text-blue-300 bg-blue-500/15 font-semibold border-l-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`
                          }
                        >
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Estructura de Empresa</span>
                        </NavLink>

                        <NavLink
                          to="/usuarios"
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isActive
                                ? 'text-blue-300 bg-blue-500/15 font-semibold border-l-2 border-blue-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`
                          }
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                          <span>Usuarios Administradores</span>
                        </NavLink>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer del sidebar con estado de ZKTeco */}
          {!sidebarCollapsed && (
            <div className="p-3 border-t border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <div className="text-[11px] leading-tight">
                  <span className="text-slate-200 font-medium block">ZKTeco MB160</span>
                  <span className="text-emerald-400 text-[10px] font-semibold">ADMS En Línea</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ======================================================== */}
        {/* 3. CONTENIDO PRINCIPAL */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-y-auto">
          {children}
        </main>

        {/* Drawer móvil completo en pantallas pequeñas */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex animate-in fade-in duration-150">
            <aside className="w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
              {/* Header del Drawer */}
              <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white tracking-tight block leading-none">
                      BioCheck
                    </span>
                    <span className="text-[10px] text-slate-400">ZKTeco MB160</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="Cerrar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Usuario activo */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate">
                  <UserCircle className="w-8 h-8 text-blue-400 flex-shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {user?.name || 'Administrador'}
                    </p>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20 uppercase font-semibold">
                      {roleLabel(user?.role)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileDrawerOpen(false)
                    handleLogout()
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Lista completa de navegación móvil */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Resumen */}
                <div>
                  <NavLink
                    to="/"
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      path === '/'
                        ? 'bg-blue-500/15 text-blue-300 border-l-4 border-blue-500 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 text-blue-400" />
                    <span>Panel de Control</span>
                  </NavLink>
                </div>

                {/* Personal */}
                <div>
                  <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span>Personal</span>
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems(personalMenuItems).map((item) => {
                      const Icon = item.icon
                      const active = item.isActive(path, tabParam)
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            active
                              ? 'bg-blue-500/15 text-blue-300 border-l-4 border-blue-500 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-slate-400" />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>

                {/* Asistencia */}
                <div>
                  <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarCheck className="w-3 h-3 text-indigo-400" />
                    <span>Asistencia y Horarios</span>
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems(asistenciaMenuItems).map((item) => {
                      const Icon = item.icon
                      const active = item.isActive(path, tabParam)
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            active
                              ? 'bg-blue-500/15 text-blue-300 border-l-4 border-blue-500 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-slate-400" />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>

                {/* Sistema */}
                <div>
                  <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-3 h-3 text-amber-400" />
                    <span>Sistema</span>
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems(sistemaMenuItems).map((item) => {
                      const Icon = item.icon
                      const active = item.isActive(path, tabParam)
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            active
                              ? 'bg-blue-500/15 text-blue-300 border-l-4 border-blue-500 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-slate-400" />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Estado del Checador al fondo del drawer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/80">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
                  <div className="text-[11px] leading-tight">
                    <span className="text-slate-200 font-medium block">ZKTeco MB160</span>
                    <span className="text-emerald-400 text-[10px] font-semibold">ADMS En Línea</span>
                  </div>
                </div>
              </div>
            </aside>
            <div
              className="flex-1"
              onClick={() => setMobileDrawerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
