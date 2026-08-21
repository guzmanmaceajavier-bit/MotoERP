import { useMemo, useState } from 'react'

export interface ServiceCalendarEvent {
  id: number
  order_number: string
  status: string
  quotation_status: string
  service_type?: string
  motorcycle?: { nickname?: string; brand?: string } | null
  created_at?: string
  started_at?: string
  finished_at?: string
  estimated_delivery?: string
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function iso(ym: string, day: number) {
  return `${ym}-${pad(day)}`
}
function yearMonth(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function statusDotClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-500'
    case 'delivered': return 'bg-teal-500'
    case 'in_progress': return 'bg-sky-500'
    case 'approved': return 'bg-emerald-500'
    case 'pending': return 'bg-amber-500'
    case 'awaiting_approval': return 'bg-orange-500'
    case 'cancelled': return 'bg-rose-500'
    default: return 'bg-brand-500'
  }
}

export default function ServiceCalendar({
  events,
  selectedDate,
  onSelect,
}: {
  events: ServiceCalendarEvent[]
  selectedDate: string | null
  onSelect: (date: string | null) => void
}) {
  const today = new Date()
  const [ym, setYm] = useState(() => yearMonth(today))

  // Agrupar eventos por cada fecha clave (creado/iniciado/finalizado/entrega)
  const byDate = useMemo(() => {
    const map = new Map<string, ServiceCalendarEvent[]>()
    const push = (date?: string, ev?: ServiceCalendarEvent) => {
      if (!date || !ev) return
      const arr = map.get(date) ?? []
      arr.push(ev)
      map.set(date, arr)
    }
    events.forEach((e) => {
      push(e.created_at, e)
      push(e.started_at, e)
      push(e.finished_at && e.status !== 'cancelled' ? e.finished_at : undefined, e)
      push(e.estimated_delivery && e.status !== 'cancelled' ? e.estimated_delivery : undefined, e)
    })
    map.forEach((arr, date) => {
      map.set(date, arr.filter((ev, idx) => arr.findIndex((x) => x.id === ev.id) === idx))
    })
    return map
  }, [events])

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
    setYm(yearMonth(next))
  }
  const todayStr = iso(yearMonth(today), today.getDate())

  return (
    <div className="overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
      {/* Header con degradado */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => go(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Mes anterior"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <p className="text-base font-bold tracking-wide">{MONTHS[monthIdx - 1]} {year}</p>
          <button
            type="button"
            onClick={() => go(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Mes siguiente"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 pt-3 text-center text-[11px] font-bold uppercase tracking-wide text-carbon-400">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 py-2">
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />
          const date = iso(ym, day)
          const dayEvents = byDate.get(date)
          const count = dayEvents?.length ?? 0
          const isToday = date === todayStr
          const isSelected = date === selectedDate

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(isSelected ? null : date)}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm transition ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-md'
                  : isToday
                    ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500/60 dark:bg-brand-500/20 dark:text-brand-200'
                    : 'text-carbon-700 hover:bg-carbon-50 dark:text-carbon-500 dark:hover:bg-carbon-200'
              }`}
            >
              <span className={count > 0 ? 'font-bold' : ''}>{day}</span>
              {count > 0 && (
                <span className="flex flex-wrap items-center justify-center gap-0.5 px-1">
                  {(dayEvents ?? []).slice(0, 3).map((ev) => (
                    <span key={ev.id} className={`h-1.5 w-1.5 rounded-full ${statusDotClass(ev.status)}`} />
                  ))}
                </span>
              )}
              {isToday && (
                <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-carbon-100 px-5 py-3 text-[11px] text-carbon-500 dark:border-carbon-200">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> En curso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> Cotización
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="ml-auto font-semibold text-brand-600 hover:text-brand-700"
        >
          Ver todas
        </button>
      </div>
    </div>
  )
}