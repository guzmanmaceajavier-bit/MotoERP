import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock, Users, Wrench } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import Calendar, { type DayEvents } from '../../components/Calendar'
import type { AppointmentRow } from '../../lib/types'
import { SectionHeader } from '../../components/ui'

interface AgendaData {
  mechanics: {
    id: number
    name: string
    active_orders: number
    in_progress: number
    orders: {
      id: number
      order_number: string
      status: string
      service_type?: string
      estimated_delivery?: string
      customer?: string
      motorcycle?: string
    }[]
  }[]
  today_appointments: AppointmentRow[]
  upcoming_appointments: AppointmentRow[]
  waiting: number
  in_reparation: number
}

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

const APPOINTMENT_STATUS: Record<string, { label: string; badge: string }> = {
  scheduled: { label: 'Agendada', badge: 'bg-sky-100 text-sky-700' },
  confirmed: { label: 'Confirmada', badge: 'bg-emerald-100 text-emerald-700' },
  arrived: { label: 'En taller', badge: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelada', badge: 'bg-carbon-100 text-carbon-500' },
}

const WORK_STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: 'Pendiente', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  assigned: { label: 'Asignada', badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  in_progress: { label: 'En taller', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  awaiting_approval: { label: 'Por aprobar', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  approved: { label: 'Aprobada', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  completed: { label: 'Completada', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  delivered: { label: 'Entregada', badge: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  cancelled: { label: 'Cancelada', badge: 'bg-carbon-100 text-carbon-500', dot: 'bg-carbon-400' },
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-brand-300 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">{label}</p>
          <p className="text-2xl font-black text-carbon-950">{value}</p>
        </div>
      </div>
    </div>
  )
}

function AppointmentCard({ a, showDate }: { a: AppointmentRow; showDate: boolean }) {
  const st = APPOINTMENT_STATUS[a.status] ?? APPOINTMENT_STATUS.scheduled
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white p-3">
      <div className="min-w-0">
        <p className="truncate font-bold text-carbon-950">{a.name}</p>
        <p className="text-xs text-carbon-600">
          {a.service_type || '—'}
          {a.motorcycle ? <span className="text-brand-600"> · {a.motorcycle}</span> : null}
          {a.mechanic_name ? <span className="text-carbon-400"> · {a.mechanic_name}</span> : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-carbon-900">
          {showDate && a.date ? <span className="font-medium text-carbon-500">{a.day_name} · </span> : null}
          {a.time}
        </p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${st.badge}`}>{st.label}</span>
      </div>
    </div>
  )
}

export default function Agenda() {
  const [data, setData] = useState<AgendaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayAppointments, setDayAppointments] = useState<AppointmentRow[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const loadMonth = useCallback(async (ym: string): Promise<DayEvents[]> => {
    const res = await api<{ days: DayEvents[] }>(`/staff/calendar?month=${ym}`)
    return res.days
  }, [])

  useEffect(() => {
    api<AgendaData>('/staff/agenda')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleCalendar() {
    setCalendarOpen((v) => !v)
    if (!calendarOpen) {
      // Al abrir, resalta hoy
      setSelectedDay(null)
    }
  }

  async function selectDay(date: string) {
    setSelectedDay(date)
    setDayLoading(true)
    try {
      const res = await api<{ appointments: AppointmentRow[] }>(`/staff/calendar?day=${date}`)
      setDayAppointments(res.appointments)
    } catch {
      setDayAppointments([])
    } finally {
      setDayLoading(false)
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-carbon-100" />
        <div className="mt-4 grid animate-pulse grid-cols-3 gap-4">
          <div className="h-24 rounded-2xl bg-carbon-100" />
          <div className="h-24 rounded-2xl bg-carbon-100" />
          <div className="h-24 rounded-2xl bg-carbon-100" />
        </div>
      </div>
    )
  if (error) return <div className="p-4 text-red-600">{error}</div>
  if (!data) return null

  const today = data.today_appointments
  const maxActive = Math.max(1, ...data.mechanics.map((m) => m.active_orders))

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Órdenes del día"
        subtitle="Carga de trabajo por mecánico, citas de hoy y entregas próximas en el taller."
        variant="brand"
        action={
          <button
            onClick={toggleCalendar}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
              calendarOpen
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-brand-300 bg-white text-carbon-950 hover:border-brand-500 hover:bg-brand-50'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {calendarOpen ? 'Ocultar calendario' : 'Ver calendario'}
          </button>
        }
      />

      {/* Resumen del día */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile icon={<Users className="h-5 w-5" />} label="Motos en espera" value={data.waiting} />
        <StatTile icon={<Wrench className="h-5 w-5" />} label="En reparación" value={data.in_reparation} />
        <StatTile icon={<Clock className="h-5 w-5" />} label="Citas de hoy" value={today.length} />
      </div>

      {/* Calendario opcional */}
      {calendarOpen && (
        <div className="mt-5 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Calendar loadMonth={loadMonth} onSelect={selectDay} selected={selectedDay} variant="brand" />
          <section>
            <h2 className="border-l-4 border-brand-500 pl-2 text-lg font-bold text-carbon-950">
              {selectedDay ? `Citas del ${fmtDate(selectedDay)}` : 'Citas de hoy'}
            </h2>
            <p className="mt-1 text-sm text-carbon-500">
              {selectedDay ? 'Toca otro día en el calendario para cambiar la vista.' : 'Selecciona un día del calendario para ver sus citas.'}
            </p>
            {selectedDay ? (
              dayLoading ? (
                <p className="mt-3 text-sm text-carbon-500">Cargando...</p>
              ) : dayAppointments.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 p-8 text-center text-sm text-carbon-500">
                  No hay citas para este día.
                </div>
              ) : (
                <div className="mt-3 space-y-2">{dayAppointments.map((a) => <AppointmentCard key={a.id} a={a} showDate />)}</div>
              )
            ) : today.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 p-8 text-center text-sm text-carbon-500">
                No hay citas agendadas para hoy.
              </div>
            ) : (
              <div className="mt-3 space-y-2">{today.map((a) => <AppointmentCard key={a.id} a={a} showDate={false} />)}</div>
            )}
          </section>
        </div>
      )}

      {/* Citas de hoy siempre visibles */}
      {!calendarOpen && (
        <section className="mt-5">
          <h2 className="border-l-4 border-brand-500 pl-2 text-lg font-bold text-carbon-950">
            Citas de hoy <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">{today.length}</span>
          </h2>
          {today.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 p-10 text-center text-sm text-carbon-500">
              No hay citas agendadas para hoy.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">{today.map((a) => <AppointmentCard key={a.id} a={a} showDate={false} />)}</div>
          )}
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Carga por mecánico */}
        <section>
          <h2 className="border-l-4 border-brand-500 pl-2 text-lg font-bold text-carbon-950">Carga por mecánico</h2>
          <div className="mt-3 space-y-3">
            {data.mechanics.map((m) => (
              <div key={m.id} className="rounded-2xl border border-brand-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-bold text-carbon-950">{m.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                    {m.active_orders} activa{m.active_orders !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Barra de carga */}
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-carbon-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${Math.round((m.active_orders / maxActive) * 100)}%` }}
                  />
                </div>
                {m.orders.length === 0 ? (
                  <p className="mt-3 text-sm text-carbon-500">Sin órdenes activas.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {m.orders.map((o) => {
                      const st = WORK_STATUS[o.status] ?? WORK_STATUS.pending
                      return (
                        <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-mono font-semibold text-carbon-900">{o.order_number}</span>
                          <span className="min-w-0 flex-1 truncate text-carbon-600">{o.service_type || 'Servicio'}</span>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Próximas citas */}
        <section>
          <h2 className="border-l-4 border-brand-500 pl-2 text-lg font-bold text-carbon-950">Próximas citas agendadas</h2>
          {data.upcoming_appointments.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 p-10 text-center text-sm text-carbon-500">
              No hay citas agendadas para fechas futuras.
            </div>
          ) : (
            <div className="mt-3 space-y-2">{data.upcoming_appointments.map((a) => <AppointmentCard key={a.id} a={a} showDate />)}</div>
          )}
        </section>
      </div>
    </div>
  )
}