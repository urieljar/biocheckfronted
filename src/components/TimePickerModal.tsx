import { useState } from 'react'
import { Sun, Moon, X, Clock, Check } from 'lucide-react'

interface TimePickerModalProps {
  isOpen: boolean
  title: string
  dayName: string
  type: 'entry' | 'exit'
  initialTime: string // Formato HH:mm (24h)
  onConfirm: (time24h: string) => void
  onClose: () => void
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

const ENTRY_PRESETS = ['07:00', '08:00', '08:30', '09:00', '10:00']
const EXIT_PRESETS = ['15:00', '16:00', '17:00', '18:00', '19:00', '22:00']

export default function TimePickerModal({
  isOpen,
  title,
  dayName,
  type,
  initialTime,
  onConfirm,
  onClose,
}: TimePickerModalProps) {
  const [selectedHour, setSelectedHour] = useState(() => {
    const parts = (initialTime || '08:00').split(':')
    return parts[0] || '08'
  })
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const parts = (initialTime || '08:00').split(':')
    return parts[1] ? parts[1].slice(0, 2) : '00'
  })

  if (!isOpen) return null

  const isEntry = type === 'entry'
  const activeColor = isEntry ? 'amber' : 'indigo'

  // Formato 12 horas para la vista previa
  const hourNum = parseInt(selectedHour, 10)
  const isPM = hourNum >= 12
  const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12
  const formatted12 = `${String(hour12).padStart(2, '0')}:${selectedMinute} ${isPM ? 'p. m.' : 'a. m.'}`

  const handleApply = () => {
    const time24 = `${selectedHour}:${selectedMinute}`
    onConfirm(time24)
  }

  const handlePresetClick = (preset: string) => {
    const [h, m] = preset.split(':')
    setSelectedHour(h)
    setSelectedMinute(m)
  }

  const presets = isEntry ? ENTRY_PRESETS : EXIT_PRESETS

  return (
    <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-inner ${
                isEntry
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
              }`}
            >
              {isEntry ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">{title}</h4>
              <p className="text-[11px] text-slate-400 capitalize">{dayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Central */}
        <div className="p-4 bg-slate-950 border-b border-slate-800/80 text-center">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${
              isEntry
                ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <Clock className="w-4 h-4 opacity-75" />
            <span className="text-2xl font-mono font-bold tracking-wider">{formatted12}</span>
            <span className="text-[10px] uppercase font-sans tracking-wider opacity-70 ml-1">
              ({selectedHour}:{selectedMinute} 24h)
            </span>
          </div>

          {/* Botones de Preajuste Rápido */}
          <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 font-medium mr-0.5">Rápido:</span>
            {presets.map((p) => {
              const isSelected = selectedHour === p.split(':')[0] && selectedMinute === p.split(':')[1]
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetClick(p)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all cursor-pointer border ${
                    isSelected
                      ? isEntry
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-indigo-600 text-white border-indigo-500 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        {/* Columnas de Selección: Horas y Minutos */}
        <div className="p-4 grid grid-cols-2 gap-3 flex-1 bg-slate-900">
          {/* Horas */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
              Hora (00 - 23)
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              {HOURS_24.map((h) => {
                const isSelected = selectedHour === h
                const hNum = parseInt(h, 10)
                const isHpm = hNum >= 12
                const h12Display = hNum % 12 === 0 ? 12 : hNum % 12

                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? isEntry
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span>{h}:00</span>
                    <span className="text-[10px] opacity-75">
                      {h12Display} {isHpm ? 'PM' : 'AM'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Minutos */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 text-center">
              Minutos
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              {MINUTES.map((m) => {
                const isSelected = selectedMinute === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMinute(m)}
                    className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono text-center transition-all cursor-pointer ${
                      isSelected
                        ? isEntry
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    :{m}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
              activeColor === 'amber'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirmar Hora</span>
          </button>
        </div>
      </div>
    </div>
  )
}
