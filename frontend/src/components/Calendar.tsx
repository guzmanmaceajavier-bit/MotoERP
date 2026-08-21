import { useEffect, useState } from 'react'

export interface DayEvents {
  date: string
  day_name: string
  appointments: number
  orders: number
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function Calendar({
  loadMonth,
  onSelect,
  selected,
  today,
  variant = 'default',
}: {
  loadMonth: (ym: string) => Promise<DayEvents[]>
  onSelect?: (date: string) => void
  selected?: string | null
  today?: string
  variant?: 'default' | 'brand'
}) {
  const [ym, setYm] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  })
  const [events, setEvents] = useState<Map<string, DayEvents>>(new Map())
  const [loading, setLoading] = useState(true)

  const todayStr = today || new Date().toISOString().slice(0, 10)
  const brand = variant === 'brand'

  useEffect(() => {
    let active = true
    setLoading(true)
    loadMonth(ym)
      .then((rows) => {
        if (!active) return
        const map = new Map<string, DayEvents>()
        rows.forEach((r) => map.set(r.date, r))
        setEvents(map)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [ym, loadMonth])

  const [year, monthIdx] = ym.split('-').map(Number)
  const firstDow = new Date(year, monthIdx - 1, 1).getDay()
  const offset = (firstDow + 6) % 7
  const daysInMonth = new Date(year, monthIdx, 0).getDate()

  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const go = (delta: number) => {
    const next = new Date(year, monthIdx - 1 + delta, 1)
    setYm(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`)
  }

  return (
    <div
      className={`rounded-2xl border bg-white p-4 ${
        brand ? 'border-brand-300 shadow-[0_1px_0_0_rgba(239,68,68,0.15)]' : 'border-carbon-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className={`rounded-lg border px-3 py-1 text-sm transition ${brand ? 'border-brand-300 text-carbon-900 hover:bg-brand-50' : 'border-carbon-300 text-carbon-600 hover:bg-carbon-50'}`}>
          ‹
        </button>
        <div className={`font-bold ${brand ? 'text-carbon-950' : 'font-semibold text-carbon-900'}`}>
          {MONTHS[monthIdx - 1]} {year}
          {loading && <span className="ml-2 text-xs font-normal text-carbon-400">Cargando...</span>}
        </div>
        <button type="button" onClick={() => go(1)} className={`rounded-lg border px-3 py-1 text-sm transition ${brand ? 'border-brand-300 text-carbon-900 hover:bg-brand-50' : 'border-carbon-300 text-carbon-600 hover:bg-carbon-50'}`}>
          ›
        </button>
      </div>

      <div className={`mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium ${brand ? 'text-carbon-500' : 'text-carbon-500'}`}>
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />
          const date = `${ym}-${pad(day)}`
          const ev = events.get(date)
          const isToday = date === todayStr
          const isSelected = date === selected
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect?.(date)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-lg border text-sm transition ${
                isSelected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : isToday
                    ? brand
                      ? 'border-brand-400 bg-brand-50 text-carbon-950'
                      : 'border-brand-300 bg-brand-50 text-carbon-900'
                    : brand
                      ? 'border-transparent text-carbon-800 hover:border-brand-300 hover:bg-brand-50'
                      : 'border-transparent text-carbon-700 hover:bg-carbon-50'
              }`}
            >
              <span className={isSelected && !isToday ? 'font-bold' : isToday ? 'font-bold' : ''}>{day}</span>
              {ev && (ev.appointments > 0 || ev.orders > 0) && (
                <span className="mt-0.5 flex gap-1">
                  {ev.appointments > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${isSelected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>
                      {ev.appointments} cita{ev.appointments > 1 ? 's' : ''}
                    </span>
                  )}
                  {ev.orders > 0 && (
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${isSelected ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'}`}>
                      {ev.orders} orden{ev.orders > 1 ? 'es' : ''}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className={`mt-3 flex flex-wrap gap-4 text-xs ${brand ? 'text-carbon-600' : 'text-carbon-500'}`}>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Citas</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Órdenes con entrega</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-200" /> Hoy</span>
      </div>
    </div>
  )
}