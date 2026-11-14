import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireCapability } from './components/RequireCapability'
import { Layout } from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EmployeesPage from './pages/EmployeesPage'
import AttendancesPage from './pages/AttendancesPage'
import SchedulesPage from './pages/SchedulesPage'
import DepartmentsPage from './pages/DepartmentsPage'
import UsersPage from './pages/UsersPage'
import ProfilePage from './pages/ProfilePage'
import AttendanceCalcPage from './pages/AttendanceCalcPage'
import CalendarExceptionsPage from './pages/CalendarExceptionsPage'
import RootControlPage from './pages/RootControlPage'
import AuditLogsPage from './pages/AuditLogsPage'
import ReportsPage from './pages/ReportsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas protegidas con Layout común */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/empleados"
          element={
            <Layout>
              <EmployeesPage />
            </Layout>
          }
        />
        <Route
          path="/asistencias"
          element={
            <Layout>
              <AttendancesPage />
            </Layout>
          }
        />
        <Route path="/reportes" element={<Layout><ReportsPage /></Layout>} />
        <Route
          path="/calculo-asistencias"
          element={
            <Layout>
              <AttendanceCalcPage />
            </Layout>
          }
        />
        <Route
          path="/perfil"
          element={
            <Layout>
              <ProfilePage />
            </Layout>
          }
        />

        {/* Configuración: solo ROOT, ADMIN y SUPERVISOR */}
        <Route element={<RequireCapability capability="schedule.write" />}>
          <Route
            path="/horarios"
            element={
              <Layout>
                <SchedulesPage />
              </Layout>
            }
          />
        </Route>

        <Route element={<RequireCapability capability="catalog.write" />}>
          <Route
            path="/departamentos"
            element={
              <Layout>
                <DepartmentsPage />
              </Layout>
            }
          />
        </Route>

        <Route element={<RequireCapability capability="exception.write" />}>
          <Route
            path="/incidencias"
            element={
              <Layout>
                <CalendarExceptionsPage />
              </Layout>
            }
          />
        </Route>

        {/* Cuentas: ROOT y ADMIN */}
        <Route element={<RequireCapability capability="user.manage" />}>
          <Route
            path="/usuarios"
            element={
              <Layout>
                <UsersPage />
              </Layout>
            }
          />
        </Route>

        {/* Panel Maestro de Permisos y Sistema: Exclusivo ROOT */}
        <Route element={<RequireCapability capability="system.rootControl" />}>
          <Route
            path="/panel-root"
            element={
              <Layout>
                <RootControlPage />
              </Layout>
            }
          />
        </Route>
        <Route element={<RequireCapability capability="audit.read" />}>
          <Route path="/auditoria" element={<Layout><AuditLogsPage /></Layout>} />
        </Route>
      </Route>

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
