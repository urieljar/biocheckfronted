// Espejo del catálogo del backend (backend/src/security/roles.js).
// Escalera: CONSULTA < SUPERVISOR < ADMIN < ROOT.
export type Role = 'ROOT' | 'ADMIN' | 'SUPERVISOR' | 'CONSULTA'

export type Capability =
  | 'employee.write'
  | 'employee.pin.read'
  | 'employee.status'
  | 'employee.delete'
  | 'attendance.sync'
  | 'attendance.write'
  | 'schedule.write'
  | 'catalog.write'
  | 'exception.write'
  | 'device.import'
  | 'user.manage'
  | 'user.managePrivileged'
  | 'system.rootControl'
  | 'audit.read'
  | 'payroll.close'
  | 'payroll.reopen'

const OPERATIONAL: Role[] = ['ROOT', 'ADMIN', 'SUPERVISOR']
const MANAGEMENT: Role[] = ['ROOT', 'ADMIN']

const CAPABILITIES: Record<Capability, Role[]> = {
  'employee.write': OPERATIONAL,
  'employee.pin.read': MANAGEMENT,
  'employee.status': OPERATIONAL,
  'employee.delete': MANAGEMENT,
  'attendance.sync': OPERATIONAL,
  'attendance.write': ['ROOT'],
  'schedule.write': OPERATIONAL,
  'catalog.write': OPERATIONAL,
  'exception.write': OPERATIONAL,
  'device.import': MANAGEMENT,
  'user.manage': MANAGEMENT,
  'user.managePrivileged': ['ROOT'],
  'system.rootControl': ['ROOT'],
  'audit.read': MANAGEMENT,
  'payroll.close': MANAGEMENT,
  'payroll.reopen': ['ROOT'],
}

export const CAPABILITY_METADATA: Record<
  Capability,
  { name: string; category: string; description: string; readOnly?: boolean }
> = {
  'employee.delete': { name: 'Eliminar y recuperar empleados', category: 'Personal', description: 'Eliminar de forma recuperable registros sin historial y restaurarlos.' },
  'attendance.write': {
    name: 'Checadas Manuales',
    category: 'Asistencias',
    description: 'Registrar y eliminar checadas de colaboradores manualmente por olvido.',
  },
  'attendance.sync': {
    name: 'Sincronización de Asistencias',
    category: 'Asistencias',
    description: 'Forzar sincronización inmediata de marcas con los relojes checadores.',
  },
  'employee.write': {
    name: 'Gestión de Empleados',
    category: 'Personal',
    description: 'Crear, editar perfiles y actualizar información general de colaboradores.',
  },
  'employee.pin.read': {
    name: 'Consulta de PINs',
    category: 'Personal',
    description: 'Visualizar contraseñas o PINs asignados en el reloj a cada empleado.',
  },
  'employee.status': {
    name: 'Estado de Empleados',
    category: 'Personal',
    description: 'Activar o desactivar colaboradores (afecta sincronización en reloj).',
  },
  'schedule.write': {
    name: 'Gestión de Horarios',
    category: 'Horarios',
    description: 'Crear, editar y asignar turnos semanales y rotativos a colaboradores.',
  },
  'exception.write': {
    name: 'Justificaciones e Incidencias',
    category: 'Horarios',
    description: 'Autorizar permisos, vacaciones, incapacidades y justificar faltas.',
  },
  'catalog.write': {
    name: 'Catálogos de Empresa',
    category: 'Estructura',
    description: 'Administrar áreas, departamentos y puestos de trabajo.',
  },
  'device.import': {
    name: 'Importación desde Reloj',
    category: 'Dispositivos',
    description: 'Importar usuarios directamente desde el dispositivo ZKTeco MB160.',
  },
  'user.manage': {
    name: 'Administración de Cuentas',
    category: 'Sistema',
    description: 'Crear usuarios, restablecer contraseñas y desactivar cuentas operativas.',
  },
  'user.managePrivileged': {
    name: 'Gestión de Cuentas Privilegiadas',
    category: 'Seguridad',
    description: 'Crear o editar administradores (ADMIN) y propietarios (ROOT). Exclusivo de ROOT.',
    readOnly: true,
  },
  'system.rootControl': {
    name: 'Control Maestro ROOT',
    category: 'Seguridad',
    description: 'Acceso total al panel de administración de permisos y funciones del sistema.',
    readOnly: true,
  },
  'audit.read': { name: 'Consulta de auditoría', category: 'Seguridad', description: 'Consultar cambios, acciones sensibles y errores del API.' },
  'payroll.close': { name: 'Cerrar pre-nómina', category: 'Asistencias', description: 'Cerrar un periodo para impedir cambios manuales.' },
  'payroll.reopen': { name: 'Reabrir pre-nómina', category: 'Seguridad', description: 'Reabrir un periodo cerrado con motivo obligatorio.' },
}

export const ROLE_LABELS: Record<Role, string> = {
  ROOT: 'ROOT · propietario',
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  CONSULTA: 'Consulta',
}

export const ALL_ROLES: Role[] = ['ROOT', 'ADMIN', 'SUPERVISOR', 'CONSULTA']

// Las cuentas anteriores al catálogo de cuatro roles conservan "USER".
export const normalizeRole = (role?: string | null): Role | null => {
  if (!role) return null
  if (role === 'USER') return 'SUPERVISOR'
  return ALL_ROLES.includes(role as Role) ? (role as Role) : null
}

export const isRoot = (role?: string | null): boolean => normalizeRole(role) === 'ROOT'

export const can = (role: string | undefined | null, capability: Capability) => {
  const normalized = normalizeRole(role)
  return normalized ? CAPABILITIES[capability]?.includes(normalized) : false
}

export const isPrivilegedRole = (role: string | undefined | null) => {
  const normalized = normalizeRole(role)
  return normalized === 'ROOT' || normalized === 'ADMIN'
}

// Qué roles puede asignar quien está usando el panel.
export const assignableRoles = (actorRole: string | undefined | null): Role[] =>
  normalizeRole(actorRole) === 'ROOT' ? ALL_ROLES : ['SUPERVISOR', 'CONSULTA']

// Un ADMIN gestiona SUPERVISOR y CONSULTA; solo ROOT toca cuentas ADMIN o ROOT.
export const canManageUser = (actorRole: string | undefined | null, targetRole: string) =>
  normalizeRole(actorRole) === 'ROOT' || !isPrivilegedRole(targetRole)

export const roleLabel = (role?: string | null) => {
  const normalized = normalizeRole(role)
  return normalized ? ROLE_LABELS[normalized] : 'Sin rol'
}
