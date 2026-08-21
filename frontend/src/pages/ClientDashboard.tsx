import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Badge, StatCard, EmptyState, SectionHeader } from '../components/ui'
import type { ClientDashboard } from '../lib/types'
import { useRefetchOnFocus } from '../lib/useRefetch'
import MiniChart from '../components/MiniChart'
import DonutChart from '../components/DonutChart'

const statusTone: Record<string, string> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_approval: 'brand',
  approved: 'green',
  completed: 'green',
  rejected: 'red',
  delivered: 'dark',
}

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

export default function Dashboard() {
  const [data, setData] = useState<ClientDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        setData(await api<ClientDashboard>('/dashboard'))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const refresh = useCallback(async () => {
    try {
      setData(await api<ClientDashboard>('/dashboard'))
    } catch {
      /* keep previous data */
    }
  }, [])

  useRefetchOnFocus(refresh)

if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse p-4">
        <div className="h-6 w-56 rounded bg-carbon-200" />
        <div className="mt-4 h-6 w-72 rounded bg-carbon-100" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-carbon-200/70" />
          ))}
        </div>
        <div className="mt-6 h-32 rounded-2xl bg-carbon-200/70" />
      </div>
    )
  }
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!data) return null

return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Tu panel"
        subtitle="Resumen de tu taller, tus motos y tus compras."
      />

      {/* Hero carrusel */}
      <HeroCarousel
        unread={data.unread_notifications}
        activeServices={data.active_services}
        motorcycles={data.motorcycles_count}
        warranties={data.active_warranties}
        points={data.points_balance}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link to="/panel/garaje"><StatCard label="Mis motos" value={data.motorcycles_count} tone="brand" icon={<MotorIcon />} /></Link>
        <Link to="/panel/servicios"><StatCard label="Servicios activos" value={data.active_services} tone="blue" icon={<WrenchIcon />} /></Link>
        <Link to="/panel/mi-cuenta"><StatCard label="Garantías activas" value={data.active_warranties} tone="green" icon={<ShieldIcon />} /></Link>
        <Link to="/panel/mi-cuenta"><StatCard label="Puntos" value={data.points_balance} tone="dark" icon={<StarIcon />} /></Link>
      </div>

      {/* Accesos directos carrusel */}
      <QuickActions />

      {/* Acceso rápido a la tienda */}
      <Card className="mt-6 flex flex-col items-center justify-between gap-4 bg-gradient-to-r from-brand-500 via-brand-600 to-orange-500 p-6 sm:flex-row">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white">
            <CartIcon />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">Tienda de repuestos</h2>
            <p className="text-sm text-white/85">Compra desde tu portal, con envío o recogida en el taller.</p>
          </div>
        </div>
        <Link to="/panel/tienda" className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-600 shadow-lg transition hover:bg-brand-50 active:scale-[0.98]">
          Ir a la tienda →
        </Link>
      </Card>

      {/* Actividad / gastos */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-carbon-900">Tu actividad</h2>
              <p className="text-xs text-carbon-500">Gasto en los últimos 6 meses</p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600">
              {(data.monthly_series?.orders.reduce((a, b) => a + b, 0) ?? 0)} pedidos
            </span>
          </div>
          <div className="mt-3">
            <MiniChart
              data={data.monthly_series?.spend ?? []}
              labels={data.monthly_series?.labels ?? []}
              color="#2563eb"
              formatValue={(v) => fmt(v)}
            />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-carbon-900">Tus servicios</h2>
              <p className="text-xs text-carbon-500">Estado de tus órdenes en el taller</p>
            </div>
          </div>
          <div className="mt-4">
            <DonutChart data={data.services_by_status ?? []} formatValue={(v) => String(v)} size={170} thickness={22} />
          </div>
        </Card>
      </div>


      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-carbon-900">Servicios recientes</h2>
            <Link to="/panel/servicios" className="text-sm font-semibold text-brand-600 hover:underline">Ver todos</Link>
          </div>
          {data.recent_orders.length === 0 ? (
            <div className="mt-4"><EmptyState title="Aún no tienes servicios" subtitle="Agenda una cita para el primer mantenimiento de tu moto." /></div>
          ) : (
            <ul className="mt-3 divide-y divide-carbon-100">
              {data.recent_orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-carbon-800">{o.order_number}</p>
                    <p className="text-xs text-carbon-500">
                      {o.motorcycle?.nickname || o.motorcycle?.brand || 'Moto'}
                    </p>
                  </div>
                  <Badge tone={statusTone[o.status] ?? 'gray'}>{o.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-carbon-900">Compras recientes</h2>
            <Link to="/panel/mi-cuenta" className="text-sm font-semibold text-brand-600 hover:underline">Ver facturas</Link>
          </div>
          {data.recent_invoices.length === 0 ? (
            <div className="mt-4"><EmptyState title="Aún no tienes facturas" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-carbon-100">
              {data.recent_invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-carbon-800">{i.invoice_number}</p>
                    <p className="text-xs text-carbon-500">{i.issue_date}</p>
                  </div>
                  <span className="font-bold text-carbon-900">{fmt(i.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

{/* Mantenimiento predictivo */}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-amber-500 px-5 py-3">
          <div className="flex items-center gap-2">
            <ClockIcon />
            <h2 className="font-bold text-white">Próximos mantenimientos</h2>
          </div>
          <Link to="/panel/garaje" className="text-sm font-semibold text-white/85 hover:text-white">Ver garaje</Link>
        </div>
        {data.next_maintenances.length === 0 ? (
          <div className="p-5"><EmptyState title="Sin mantenimientos pendientes" subtitle="Tu moto está al día. Te avisaremos cuando se acerque un mantenimiento." /></div>
        ) : (
          <div className="divide-y divide-carbon-100">
            {data.next_maintenances.map((m, idx) => (
              <div key={idx} className="flex items-center gap-4 px-5 py-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.urgency === 'overdue' ? 'bg-red-100 text-red-600' : m.urgency === 'soon' ? 'bg-amber-100 text-amber-600' : 'bg-brand-50 text-brand-600'}`}>
                  <ToolIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-carbon-800">{m.service_name}</p>
                  <p className="text-xs text-carbon-500">
                    {m.due_km != null && `cada ${m.interval_km?.toLocaleString('es-CO')} km`}
                    {m.due_km != null && m.due_date ? ' · ' : ''}
                    {m.due_date ? `para el ${m.due_date}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={m.urgency === 'overdue' ? 'red' : m.urgency === 'soon' ? 'amber' : 'green'}>
                    {m.urgency === 'overdue' ? 'Vencido' : m.urgency === 'soon' ? 'Próximamente' : 'Al día'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-carbon-900">Garantías activas</h2>
            <Link to="/panel/mi-cuenta" className="text-sm font-semibold text-brand-600 hover:underline">Ver todo</Link>
          </div>
          {data.warranties.length === 0 ? (
            <div className="mt-4"><EmptyState title="No tienes garantías activas" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-carbon-100">
              {data.warranties.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldIcon /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-carbon-800">{w.description}</p>
                    <p className="text-xs text-carbon-500">
                      {w.type === 'km' ? `Hasta ${w.end_date || 'kilometraje'}` : `Vence ${w.end_date}`}
                    </p>
                  </div>
                  <Badge tone="green">Activa</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-carbon-900">Puntos de lealtad</h2>
            <Link to="/panel/mi-cuenta" className="text-sm font-semibold text-brand-600 hover:underline">Canjear</Link>
          </div>
          {data.points_history.length === 0 ? (
            <div className="mt-4"><EmptyState title="Aún no acumulas puntos" /></div>
          ) : (
            <ul className="mt-3 divide-y divide-carbon-100">
              {data.points_history.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <p className="text-sm text-carbon-700">{p.concept}</p>
                  <span className="font-bold text-emerald-600">+{p.points}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function MotorIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" /><circle cx="8.5" cy="16" r="1.5" /><circle cx="16.5" cy="16" r="1.5" /></svg>
}
function WrenchIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}
function ShieldIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}
function StarIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
}
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}
function ToolIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}
function PlusIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
}
function CartIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" /><circle cx="9" cy="21" r="1" /><circle cx="19" cy="21" r="1" /></svg>
}
function HistoryIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5M12 7v5l4 2" /></svg>
}
function ChatIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
}

const quickTones: Record<string, string> = {
  brand: 'from-orange-500 to-amber-600',
  blue: 'from-sky-500 to-blue-600',
  amber: 'from-amber-400 to-orange-500',
  green: 'from-emerald-500 to-teal-600',
  purple: 'from-violet-500 to-purple-600',
  dark: 'from-slate-500 to-slate-700',
}

function QuickLink({
  to,
  title,
  desc,
  icon,
  tone,
}: {
  to: string
  title: string
  desc: string
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-col rounded-2xl border border-carbon-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${quickTones[tone] ?? quickTones.brand} text-white shadow`}>
        {icon}
      </span>
      <span className="mt-3 text-sm font-bold text-carbon-900 group-hover:text-brand-600">{title}</span>
      <span className="mt-0.5 text-xs text-carbon-500">{desc}</span>
    </Link>
  )
}

function HeroCarousel({
  unread,
  activeServices,
  motorcycles,
  warranties,
  points,
}: {
  unread: number
  activeServices: number
  motorcycles: number
  warranties: number
  points: number
}) {
  const [index, setIndex] = useState(0)
  const slides = [
    {
      to: '/panel/garaje',
      title: 'Solicita una nueva orden de servicio',
      desc: 'Registra tu moto y pide un mantenimiento o reparación con solo unos clics.',
      cta: 'Nueva orden',
      gradient: 'from-orange-500 via-brand-500 to-amber-500',
      icon: <PlusIcon />,
    },
    {
      to: '/panel/servicios',
      title: `${activeServices} servicio${activeServices === 1 ? '' : 's'} activo${activeServices === 1 ? '' : 's'} en el taller`,
      desc: 'Consulta el estado, la cotización y el historial de tus órdenes en tiempo real.',
      cta: 'Ver mis servicios',
      gradient: 'from-sky-500 via-blue-600 to-indigo-600',
      icon: <WrenchIcon />,
    },
    {
      to: '/panel/garaje',
      title: `Tienes ${motorcycles} moto${motorcycles === 1 ? '' : 's'} en tu garaje digital`,
      desc: 'Lleva la hoja de vida, kilometraje y próximos mantenimientos de cada una.',
      cta: 'Ver mi garaje',
      gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
      icon: <MotorIcon />,
    },
    {
      to: '/panel/mi-cuenta',
      title: `${warranties} garantía${warranties === 1 ? '' : 's'} activa${warranties === 1 ? '' : 's'} · ${points} puntos`,
      desc: 'Revisa tus garantías, facturas, puntos de lealtad y saldos desde un solo lugar.',
      cta: 'Ir a mis finanzas',
      gradient: 'from-violet-500 via-purple-600 to-fuchsia-600',
      icon: <ShieldIcon />,
    },
    {
      to: '/panel/notificaciones',
      title: unread > 0 ? `Tienes ${unread} notificaci${unread === 1 ? 'ón' : 'ones'} sin leer` : 'Todas tus notificaciones al día',
      desc: 'Avisos de órdenes, facturas, garantías, citas y promociones de la tienda.',
      cta: 'Ver notificaciones',
      gradient: 'from-rose-500 via-red-500 to-orange-500',
      icon: <ChatIcon />,
    },
  ]

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = slides[index]

  return (
    <div className="mb-6 overflow-hidden rounded-3xl shadow-xl shadow-brand-600/10">
      <div className={`relative bg-gradient-to-br ${s.gradient} p-6 text-white sm:p-8`}>
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.8)_0,transparent_40%),radial-gradient(circle_at_15%_90%,rgba(255,255,255,0.5)_0,transparent_35%)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner">
              {s.icon}
            </span>
            <div>
              <h2 className="text-lg font-black leading-tight sm:text-xl">{s.title}</h2>
              <p className="mt-1 max-w-md text-sm text-white/85">{s.desc}</p>
            </div>
          </div>
          <Link
            to={s.to}
            className="shrink-0 self-start rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-carbon-900 shadow-lg transition hover:bg-carbon-50 active:scale-[0.98] sm:self-center"
          >
            {s.cta} →
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 bg-white py-2.5 dark:bg-carbon-100">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Ir al slide ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'w-6 bg-brand-600' : 'w-2 bg-carbon-300 hover:bg-carbon-400'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function QuickActions() {
  const items: { to: string; title: string; desc: string; icon: React.ReactNode; tone: string }[] = [
    { to: '/panel/garaje', title: 'Nueva orden', desc: 'Solicita un servicio', icon: <PlusIcon />, tone: 'brand' },
    { to: '/panel/garaje', title: 'Mi Garaje', desc: 'Ver mis motos', icon: <MotorIcon />, tone: 'blue' },
    { to: '/panel/servicios', title: 'Mis Servicios', desc: 'Estado de órdenes', icon: <WrenchIcon />, tone: 'amber' },
    { to: '/panel/tienda', title: 'Tienda', desc: 'Compra repuestos', icon: <CartIcon />, tone: 'green' },
    { to: '/panel/historial', title: 'Historial', desc: 'Compras y facturas', icon: <HistoryIcon />, tone: 'purple' },
    { to: '/panel/chat', title: 'Chat', desc: 'Habla con el taller', icon: <ChatIcon />, tone: 'dark' },
  ]

  return (
    <div className="mt-6">
      <h2 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-carbon-400">Accesos rápidos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <QuickLink key={it.title} {...it} />
        ))}
      </div>
    </div>
  )
}

