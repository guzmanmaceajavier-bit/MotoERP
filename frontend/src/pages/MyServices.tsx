import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import Pagination from '../components/Pagination'
import ServiceCalendar, { type ServiceCalendarEvent } from '../components/ServiceCalendar'
import NewServiceRequestModal from '../components/NewServiceRequestModal'
import { EmptyState, SectionHeader } from '../components/ui'
import type { Paginated } from '../lib/pagination'
import type { WorkOrderSummary } from '../lib/types'
import { useRefetchOnFocus } from '../lib/useRefetch'

const ITEMS_PER_PAGE = 8

type TabKey = 'all' | 'active' | 'awaiting_approval' | 'completed' | 'cancelled'

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  awaiting_approval: 'Cotización pendiente',
  approved: 'Aprobada',
  completed: 'Completado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const statusColor: Record<string, { bg: string; text: string; dot: string; border: string; solid: string; bar: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-l-amber-500', solid: 'bg-gradient-to-br from-amber-400 to-amber-600', bar: 'bg-gradient-to-r from-amber-400 to-amber-300' },
  in_progress: { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500', border: 'border-l-sky-500', solid: 'bg-gradient-to-br from-sky-400 to-blue-600', bar: 'bg-gradient-to-r from-sky-400 to-blue-500' },
  awaiting_approval: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', border: 'border-l-orange-500', solid: 'bg-gradient-to-br from-orange-400 to-amber-600', bar: 'bg-gradient-to-r from-orange-400 to-amber-500' },
  approved: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-l-emerald-500', solid: 'bg-gradient-to-br from-emerald-400 to-green-600', bar: 'bg-gradient-to-r from-emerald-400 to-green-500' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-l-emerald-500', solid: 'bg-gradient-to-br from-emerald-400 to-green-600', bar: 'bg-gradient-to-r from-emerald-400 to-green-500' },
  delivered: { bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500', border: 'border-l-teal-500', solid: 'bg-gradient-to-br from-teal-400 to-cyan-600', bar: 'bg-gradient-to-r from-teal-400 to-cyan-500' },
  cancelled: { bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-500', border: 'border-l-rose-500', solid: 'bg-gradient-to-br from-rose-400 to-red-600', bar: 'bg-gradient-to-r from-rose-400 to-red-400' },
}

// Prioridad de "seguimiento": primero lo que requiere acción del cliente
function statusKey(o: WorkOrderSummary): string {
  return o.quotation_status === 'awaiting_approval' ? 'awaiting_approval' : o.status
}

function priority(s: string): number {
  switch (s) {
    case 'awaiting_approval': return 0
    case 'pending': return 1
    case 'in_progress': return 2
    case 'approved': return 3
    case 'completed': return 4
    case 'delivered': return 5
    case 'cancelled': return 6
    default: return 7
  }
}

const progressPct: Record<string, number> = {
  pending: 15,
  awaiting_approval: 32,
  approved: 55,
  in_progress: 78,
  completed: 100,
  delivered: 100,
  cancelled: 100,
}

const progressLabel: Record<string, string> = {
  pending: 'Esperando iniciar',
  awaiting_approval: 'Esperando tu aprobación',
  approved: 'Agendado en el taller',
  in_progress: 'Servicio en ejecución',
  completed: 'Listo para la entrega',
  delivered: 'Entregado',
  cancelled: 'Servicio cancelado',
}

const TABS: { key: TabKey; label: string; match: string[] | null; active: string; inactiveDot: string; inactiveText: string }[] = [
  { key: 'all', label: 'Todos', match: null, active: 'from-brand-500 to-brand-600', inactiveDot: 'bg-brand-400', inactiveText: 'text-brand-600' },
  { key: 'active', label: 'En seguimiento', match: ['pending', 'awaiting_approval', 'in_progress', 'approved'], active: 'from-violet-500 to-purple-600', inactiveDot: 'bg-violet-400', inactiveText: 'text-violet-600' },
  { key: 'awaiting_approval', label: 'Cotización', match: ['awaiting_approval'], active: 'from-orange-400 to-amber-600', inactiveDot: 'bg-orange-400', inactiveText: 'text-orange-600' },
  { key: 'completed', label: 'Completados', match: ['completed', 'delivered'], active: 'from-emerald-500 to-green-600', inactiveDot: 'bg-emerald-400', inactiveText: 'text-emerald-600' },
  { key: 'cancelled', label: 'Cancelados', match: ['cancelled'], active: 'from-rose-500 to-red-600', inactiveDot: 'bg-rose-400', inactiveText: 'text-rose-600' },
]

export default function MyServices() {
  const [orders, setOrders] = useState<WorkOrderSummary[]>([])
  const [calendarEvents, setCalendarEvents] = useState<ServiceCalendarEvent[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [listPage, setListPage] = useState(1)

  const [reqOpen, setReqOpen] = useState(false)

  async function load(page = 1) {
    setLoading(page === 1)
    const params = new URLSearchParams({ page: String(page), per_page: '50' })
    try {
      const res = await api<Paginated<WorkOrderSummary>>(`/my-orders?${params.toString()}`)
      setOrders(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  // Todas las órdenes (sin paginar) para estadísticas y calendario
  const loadCalendar = useCallback(async () => {
    try {
      setCalendarEvents(await api<ServiceCalendarEvent[]>('/my-orders/calendar'))
    } catch {
      setCalendarEvents([])
    }
  }, [])

  useEffect(() => {
    loadCalendar()
    load()
  }, [loadCalendar])

  useRefetchOnFocus(() => load(meta.current_page))

  const stats = useMemo(() => {
    const total = calendarEvents.length
    const completed = calendarEvents.filter((o) => o.status === 'completed' || o.status === 'delivered').length
    const inProgress = calendarEvents.filter((o) => o.status === 'in_progress').length
    const awaiting = calendarEvents.filter((o) => statusKey(o as WorkOrderSummary) === 'awaiting_approval').length
    return { total, completed, inProgress, awaiting }
  }, [calendarEvents])

  const tabCounts = useMemo(() => {
    const mk = (match: string[]) => calendarEvents.filter((o) => match.includes(statusKey(o as WorkOrderSummary))).length
    return {
      all: calendarEvents.length,
      active: mk(['pending', 'awaiting_approval', 'in_progress', 'approved']),
      awaiting_approval: mk(['awaiting_approval']),
      completed: mk(['completed', 'delivered']),
      cancelled: mk(['cancelled']),
    }
  }, [calendarEvents])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = orders.filter((o) => {
      if (!q) return true
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.service_type && o.service_type.toLowerCase().includes(q)) ||
        (o.motorcycle?.nickname && o.motorcycle.nickname.toLowerCase().includes(q)) ||
        (o.motorcycle?.brand && o.motorcycle.brand.toLowerCase().includes(q))
      )
    })

    const tab = TABS.find((t) => t.key === activeTab)
    if (tab?.match) {
      list = list.filter((o) => tab.match!.includes(statusKey(o)))
    }

    if (selectedDate) {
      list = list.filter((o) => o.created_at?.slice(0, 10) === selectedDate)
    }

    list.sort((a, b) => {
      const p = priority(statusKey(a)) - priority(statusKey(b))
      return p !== 0 ? p : b.id - a.id
    })

    return list
  }, [orders, search, activeTab, selectedDate])

  // Reinicia la paginación local al cambiar filtros
  useEffect(() => { setListPage(1) }, [activeTab, search, selectedDate])

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const pageOrders = filtered.slice((listPage - 1) * ITEMS_PER_PAGE, listPage * ITEMS_PER_PAGE)

  async function onServiceCreated(_orderNumber: string) {
    setActiveTab('active')
    setSelectedDate(null)
    await loadCalendar()
    await load(meta.current_page)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-carbon-100 dark:bg-carbon-200" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Mis Servicios"
        subtitle="Sigue el estado de tus motos: primeras las que necesitan tu atención."
        action={
          <button onClick={() => setReqOpen(true)} className="btn-primary !text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva orden
          </button>
        }
      />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {/* Stats con datos reales */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Servicios totales"
          value={stats.total}
          sub="Todas tus órdenes"
          gradient="from-violet-500 to-purple-600"
          icon={<OrdersIcon />}
        />
        <StatCard
          label="Completados"
          value={stats.completed}
          sub="Entregados y listos"
          gradient="from-emerald-500 to-green-600"
          icon={<CheckIcon />}
        />
        <StatCard
          label="En curso"
          value={stats.inProgress}
          sub="Trabajando ahora"
          gradient="from-sky-500 to-blue-600"
          icon={<ClockIcon />}
        />
        <StatCard
          label="Requieren acción"
          value={stats.awaiting}
          sub="Cotizaciones pendientes"
          gradient="from-orange-500 to-amber-600"
          icon={<PendingIcon />}
        />
      </div>

      {/* Barra de búsqueda + toggle calendario */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, servicio, moto o marca..."
            className="w-full rounded-xl border border-carbon-200 bg-white py-2.5 pl-10 pr-4 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-700 dark:placeholder-carbon-400"
          />
        </div>
        <button
          onClick={() => setCalendarOpen((v) => !v)}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            calendarOpen
              ? 'bg-brand-600 text-white shadow-sm'
              : 'border border-carbon-200 bg-white text-carbon-600 hover:border-brand-300 hover:text-brand-600 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-500'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          {calendarOpen ? 'Ocultar calendario' : 'Ver calendario'}
        </button>
      </div>

      {/* Tabs grandes con contadores */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? `bg-gradient-to-r ${t.active} text-white shadow-md`
                  : 'border border-carbon-200 bg-white text-carbon-600 hover:-translate-y-0.5 hover:shadow-sm dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-500'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white/80' : t.inactiveDot}`} />
              {t.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-carbon-100 text-carbon-500 dark:bg-carbon-100'
              }`}>
                {tabCounts[t.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Calendario opcional */}
      {calendarOpen && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          <ServiceCalendar events={calendarEvents} selectedDate={selectedDate} onSelect={setSelectedDate} />
          <div className="hidden lg:block" />
        </div>
      )}

      {selectedDate && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-2.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700 dark:text-brand-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setSelectedDate(null)} className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-300">
            Mostrar todas las fechas
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-carbon-500">
        {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        {activeTab === 'active' ? ' · priorizando lo que necesita tu atención' : ''}
      </p>

      {/* Lista */}
      {pageOrders.length === 0 ? (
        <div className="mt-4 flex items-center rounded-2xl border border-dashed border-carbon-200 bg-white dark:bg-carbon-100 dark:border-carbon-200">
          <EmptyState
            title={
              search.trim() || selectedDate
                ? 'No se encontraron servicios'
                : activeTab === 'active'
                  ? 'No tienes servicios en seguimiento'
                  : 'No hay servicios en este estado'
            }
            subtitle={
              search.trim() || selectedDate
                ? 'Ajusta la búsqueda o quita el filtro de fecha.'
                : activeTab === 'active'
                  ? 'Cuando solicites un servicio verás aquí su avance en tiempo real.'
                  : 'Revisa la pestaña "Todos" para ver el resto de tus órdenes.'
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pageOrders.map((o) => {
            const sk = statusKey(o)
            const needsApproval = sk === 'awaiting_approval'
            const colors = statusColor[sk] ?? statusColor.pending
            const label = needsApproval ? 'Cotización pendiente' : statusLabels[o.status] || o.status
            const pct = progressPct[sk] ?? 0
            const stage = needsApproval ? 'Esperando tu aprobación' : progressLabel[o.status] || ''

            return (
              <Link
                key={o.id}
                to={`/panel/servicios/${o.id}`}
                className="group block overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-carbon-100 dark:border-carbon-200"
              >
                <div className={`border-l-4 ${colors.border} p-5`}>
                  {/* Fila superior */}
                  <div className="flex items-start gap-3.5">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${colors.solid}`}>
                      <WrenchIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-base font-bold text-carbon-900 dark:text-carbon-700">{o.order_number}</p>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${colors.bg} ${colors.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-carbon-700 dark:text-carbon-500">
                        {o.service_type || 'Servicio general'}
                      </p>
                      <p className="truncate text-xs text-carbon-400">
                        {o.motorcycle?.brand ? `${o.motorcycle.brand} ` : ''}
                        {o.motorcycle?.nickname ? `"${o.motorcycle.nickname}"` : ''}
                        {!o.motorcycle?.brand && !o.motorcycle?.nickname ? 'Moto registrada' : ''}
                        {o.motorcycle?.plate ? ` · ${o.motorcycle.plate}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Fechas */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-carbon-500">
                    {o.created_at && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                        Registrado: {new Date(o.created_at).toLocaleDateString('es-CO')}
                      </span>
                    )}
                    {o.estimated_delivery && o.status !== 'cancelled' && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                        Entrega estimada: {new Date(o.estimated_delivery).toLocaleDateString('es-CO')}
                      </span>
                    )}
                  </div>

                  {/* Progreso */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-carbon-100 dark:bg-carbon-200">
                      <div className={`h-full rounded-full ${colors.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-semibold text-carbon-500">{stage}</span>
                    <span className={`text-[11px] font-bold ${colors.text}`}>{pct}%</span>
                  </div>
                </div>

                {/* Acción */}
                <div className="flex items-center justify-between border-t border-carbon-100 bg-carbon-50/50 px-5 py-2.5 dark:border-carbon-200 dark:bg-carbon-200/40">
                  <span className="text-[11px] text-carbon-400">Toca para ver detalle y seguimiento</span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition group-hover:gap-2.5">
                    Ver detalle
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14m-6-6l6 6-6 6" /></svg>
                  </span>
                </div>
              </Link>
            )
          })}

          {/* Paginación local */}
          <div className="pt-2">
            <Pagination
              page={Math.min(listPage, pageCount)}
              lastPage={pageCount}
              total={filtered.length}
              onChange={setListPage}
            />
          </div>
        </div>
      )}

      {/* Solicitar servicio modal */}
      <NewServiceRequestModal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        onCreated={onServiceCreated}
      />
    </div>
  )
}

function StatCard({ label, value, sub, gradient, icon }: {
  label: string
  value: number
  sub: string
  gradient: string
  icon: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-carbon-100 dark:border-carbon-200">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-500/5" />
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white shadow-md`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-carbon-500">{label}</p>
          <p className="text-2xl font-bold text-carbon-900 dark:text-carbon-700">{value}</p>
          <p className="text-[11px] text-carbon-400">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function WrenchIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}

function OrdersIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
}

function CheckIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
}

function ClockIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
}

function PendingIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
}