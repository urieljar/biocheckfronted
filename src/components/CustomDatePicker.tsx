import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface CustomDatePickerProps {
  value: string // Formato YYYY-MM-DD o cadena vacía ""
  onChange: (value: string) => void
  label?: string // Etiqueta superior exterior (para formularios estándar)
  innerLabel?: string // Etiqueta interna superior compacta (estilo toolbar: DESDE / HASTA)
  placeholder?: string
  required?: boolean
  disabled?: boolean
  accentColor?: 'blue' | 'indigo' | 'amber' | 'emerald' | 'purple'
  size?: 'sm' | 'md'
  minDate?: string // YYYY-MM-DD
  maxDate?: string // YYYY-MM-DD
  clearable?: boolean
  className?: string
  id?: string
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const WEEKDAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

// Helper para parsear fechas locales sin desfasar zona horaria
function parseLocalDate(str: string): { year: number; month: number; day: number } | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  const [y, m, d] = str.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

function formatLocalDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0')
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  }
}

export default function CustomDatePicker({
  value,
  onChange,
  label,
  innerLabel,
  placeholder = 'dd/mm/aaaa',
  required = false,
  disabled = false,
  accentColor = 'blue',
  size = 'md',
  minDate,
  maxDate,
  clearable = true,
  className = '',
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  })

  // Fecha actualmente seleccionada
  const parsedValue = useMemo(() => parseLocalDate(value), [value])

  // Mes y Año que se están viendo en el calendario
  const [viewYear, setViewYear] = useState(() => parsedValue?.year ?? getTodayParts().year)
  const [viewMonth, setViewMonth] = useState(() => parsedValue?.month ?? getTodayParts().month)

  // Selector de Año/Mes rápido
  const [isMonthSelectOpen, setIsMonthSelectOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Sincronizar vista con el valor cuando cambie desde afuera
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.year)
      setViewMonth(parsedValue.month)
    }
  }, [value])

  // Calcular posición del popover flotante
  const updateCoords = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = 310
    const popoverHeight = 360

    let left = rect.left
    // Si se sale por la derecha, pegarlo al borde derecho del viewport
    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popoverWidth - 12)
    }

    // Si se sale por abajo de la pantalla, mostrar arriba del trigger
    let top = rect.bottom + 6
    if (top + popoverHeight > window.innerHeight - 12 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 6
    }

    setCoords({
      top: Math.max(8, top),
      left: Math.max(8, left),
      width: rect.width,
    })
  }

  const handleOpen = () => {
    if (disabled) return
    if (parsedValue) {
      setViewYear(parsedValue.year)
      setViewMonth(parsedValue.month)
    }
    updateCoords()
    setIsOpen(true)
    setIsMonthSelectOpen(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMonthSelectOpen(false)
  }

  // Cerrar al hacer clic fuera o redimensionar
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      handleClose()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }

    const handleScrollResize = () => {
      updateCoords()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollResize, true)
    window.addEventListener('resize', handleScrollResize)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScrollResize, true)
      window.removeEventListener('resize', handleScrollResize)
    }
  }, [isOpen])

  // Navegación de mes
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  // Selección de fecha
  const handleSelectDay = (year: number, month: number, day: number) => {
    const formatted = formatLocalDate(year, month, day)
    onChange(formatted)
    handleClose()
  }

  const handleSelectToday = () => {
    const todayParts = getTodayParts()
    const formatted = formatLocalDate(todayParts.year, todayParts.month, todayParts.day)
    onChange(formatted)
    handleClose()
  }

  const handleClear = () => {
    onChange('')
    handleClose()
  }

  // Generación de la grilla de días
  const calendarDays = useMemo(() => {
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Domingo

    const days = []

    // Días del mes anterior para rellenar la primera semana
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const prevDay = daysInPrevMonth - i
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
      days.push({
        day: prevDay,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
      })
    }

    // Días del mes actual
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      days.push({
        day,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
      })
    }

    // Días del mes siguiente para completar la cuadrícula (hasta 35 o 42 celdas)
    const remaining = (7 - (days.length % 7)) % 7
    for (let day = 1; day <= remaining; day++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
      days.push({
        day,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
      })
    }

    return days
  }, [viewYear, viewMonth])

  // Color de acento según la prop
  const colorMap = {
    blue: {
      btn: 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25',
      focus: 'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25',
      badge: 'text-blue-400',
      label: 'text-blue-300/90',
      selected: 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30',
      today: 'border border-blue-500/50 text-blue-400 font-semibold',
    },
    indigo: {
      btn: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25',
      focus: 'focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20',
      badge: 'text-indigo-400',
      label: 'text-indigo-300/90',
      selected: 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30',
      today: 'border border-indigo-500/50 text-indigo-400 font-semibold',
    },
    amber: {
      btn: 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
      focus: 'focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/25',
      badge: 'text-amber-400',
      label: 'text-amber-300/90',
      selected: 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30',
      today: 'border border-amber-500/50 text-amber-400 font-semibold',
    },
    emerald: {
      btn: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
      focus: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25',
      badge: 'text-emerald-400',
      label: 'text-emerald-300/90',
      selected: 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30',
      today: 'border border-emerald-500/50 text-emerald-400 font-semibold',
    },
    purple: {
      btn: 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25',
      focus: 'focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/25',
      badge: 'text-purple-400',
      label: 'text-purple-300/90',
      selected: 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30',
      today: 'border border-purple-500/50 text-purple-400 font-semibold',
    },
  }

  const colors = colorMap[accentColor] || colorMap.blue
  const todayParts = getTodayParts()
  const isSm = size === 'sm'

  // Formato visual legible DD/MM/AAAA
  const displayFormatted = parsedValue
    ? `${String(parsedValue.day).padStart(2, '0')}/${String(parsedValue.month + 1).padStart(
        2,
        '0'
      )}/${parsedValue.year}`
    : ''

  return (
    <div ref={containerRef} className={`w-full ${className}`}>
      {/* Etiqueta superior estándar si fue provista */}
      {label && (
        <label className={`block font-semibold mb-1 ${
          isSm
            ? 'text-xs text-slate-400'
            : 'text-xs uppercase tracking-wider text-slate-300 mb-1.5'
        }`}>
          {label}
        </label>
      )}

      {/* Trigger Input Box */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        className={`w-full flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-xl transition-all cursor-pointer select-none ${
          isSm
            ? 'h-9 px-2 text-xs'
            : 'min-h-[46px] px-3 py-2 text-xs sm:text-sm'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-900/50' : 'hover:border-slate-600'
        } ${isOpen ? 'ring-2 border-slate-600 ' + colors.focus : ''}`}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className={`flex items-center justify-center border rounded-lg transition-all shadow-sm flex-shrink-0 cursor-pointer ${
            isSm ? 'w-6 h-6' : 'w-7 h-7'
          } ${colors.btn}`}
          title="Abrir calendario"
        >
          <Calendar className={isSm ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>

        {innerLabel ? (
          <div className="flex flex-col flex-1 min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.label}`}>
              {innerLabel}
            </span>
            <span
              className={`text-xs font-mono font-medium truncate ${
                displayFormatted ? 'text-slate-100' : 'text-slate-500'
              }`}
            >
              {displayFormatted || placeholder}
            </span>
          </div>
        ) : (
          <span
            className={`w-full font-medium truncate ${
              isSm ? 'text-xs' : 'text-xs sm:text-sm'
            } ${
              displayFormatted ? 'text-slate-100 font-mono' : 'text-slate-500'
            }`}
          >
            {displayFormatted || placeholder}
          </span>
        )}

        {/* Input invisible para validación HTML nativa */}
        <input
          type="text"
          value={value}
          required={required}
          readOnly
          tabIndex={-1}
          className="sr-only"
        />

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
            title="Borrar fecha"
          >
            <X className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          </button>
        )}
      </div>

      {/* Popover del Calendario (Renderizado en Portal con fondo slate-900 oscuro) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 100,
            }}
            className="bg-slate-900 border border-slate-700/90 rounded-2xl p-4 shadow-2xl w-[310px] text-slate-100 select-none animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          >
            {/* Header del Calendario: Mes, Año y Controles */}
            <div className="flex items-center justify-between gap-1 mb-3">
              <button
                type="button"
                onClick={() => setIsMonthSelectOpen((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-100 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-inner hover:border-slate-700"
              >
                <span>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                <span className="text-[10px] text-slate-400">▼</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Selector rápido de Mes/Año (cuando se hace clic en el título) */}
            {isMonthSelectOpen ? (
              <div className="space-y-3 py-1 animate-in fade-in duration-100">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase">Año:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y - 1)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      ◀
                    </button>
                    <span className="text-sm font-bold text-white font-mono">{viewYear}</span>
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y + 1)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {MONTH_NAMES.map((name, idx) => {
                    const isCurrent = idx === viewMonth
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setViewMonth(idx)
                          setIsMonthSelectOpen(false)
                        }}
                        className={`py-2 text-xs rounded-xl font-medium transition-all cursor-pointer ${
                          isCurrent
                            ? colors.selected
                            : 'bg-slate-950/60 hover:bg-slate-800 text-slate-200 border border-slate-800'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Días de la Semana */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 py-1.5 border-b border-slate-800/80 mb-2">
                  {WEEKDAY_NAMES.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>

                {/* Cuadrícula de Días */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((item, idx) => {
                    const isSelected =
                      parsedValue &&
                      parsedValue.year === item.year &&
                      parsedValue.month === item.month &&
                      parsedValue.day === item.day

                    const isToday =
                      todayParts.year === item.year &&
                      todayParts.month === item.month &&
                      todayParts.day === item.day

                    // Comprobar restricciones minDate y maxDate
                    const dateFormatted = formatLocalDate(item.year, item.month, item.day)
                    const isBeforeMin = minDate ? dateFormatted < minDate : false
                    const isAfterMax = maxDate ? dateFormatted > maxDate : false
                    const isDisabledDate = isBeforeMin || isAfterMax

                    return (
                      <button
                        key={`${item.year}-${item.month}-${item.day}-${idx}`}
                        type="button"
                        disabled={isDisabledDate}
                        onClick={() => handleSelectDay(item.year, item.month, item.day)}
                        className={`h-8 w-8 mx-auto text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          isDisabledDate
                            ? 'opacity-20 cursor-not-allowed'
                            : isSelected
                            ? colors.selected
                            : isToday
                            ? colors.today
                            : item.isCurrentMonth
                            ? 'text-slate-100 hover:bg-slate-800 font-medium'
                            : 'text-slate-600 hover:bg-slate-800/40 hover:text-slate-400'
                        }`}
                      >
                        {item.day}
                      </button>
                    )
                  })}
                </div>

                {/* Footer con Acciones Rápidas */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800 text-xs">
                  {clearable ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-slate-400 hover:text-rose-400 font-medium transition-colors cursor-pointer"
                    >
                      Borrar
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={handleSelectToday}
                    className="text-blue-400 hover:text-blue-300 font-semibold transition-colors cursor-pointer ml-auto"
                  >
                    Hoy
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
