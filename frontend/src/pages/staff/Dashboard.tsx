import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart,
  ReceiptText,
  ShieldAlert,
  FileCheck2,
  ClipboardList,
  Clock,
  Wrench,
  CheckCircle2,
  Users,
  Bike,
  Package,
  CalendarDays,
  BarChart3,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { Card, Badge, ProgressBar, EmptyState, SectionHeader } from '../../components/ui'
import type { DashboardStats } from '../../lib/types'
import { SkeletonLine, SkeletonBlock, StatSkeleton } from '../../components/Skeletons'
import MiniChart from '../../components/MiniChart'
import BarChart from '../../components/BarChart'
import DonutChart from '../../components/DonutChart'

interface MaintenanceAlert {
  motorcycle_id: number
  plate: string | null
  nickname: string | null
  brand: string | null
  model: string | null
  current_odometer: number
  customer: string | null
  service_name: string
  category: string | null
  interval_km: number | null
  interval_months: number | null
  due_km: number | null
  due_date: string | null
  km_left: number | null
  days_left: number | null
  urgency: 'overdue' | 'soon' | 'ok'
}

const statusTone: Record<string, string> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_approval: 'brand',
  approved: 'green',
  completed: 'green',
  rejected: 'red',
  delivered: 'dark',
}

const storeStatusMeta: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Por pagar', tone: 'amber' },
  payment_review: { label: 'En revisión', tone: 'amber' },
  confirmed: { label: 'Confirmado', tone: 'blue' },
  shipped: { label: 'Enviado', tone: 'blue' },
  delivered: { label: 'Entregado', tone: 'green' },
  cancelled: { label: 'Cancelado', tone: 'gray' },
}

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [maint, setMaint] = useState<{ data: MaintenanceAlert[]; overdue: number; soon: number } | null>(null)
  const [period, setPeriod] = useState<'7d' | '30d' | '12m'>('12m')
  const [maintPage, setMaintPage] = useState(1)
  const MAINT_PER_PAGE = 6
  const maintRows = maint?.data ?? []
  const maintTotalPages = Math.max(1, Math.ceil(maintRows.length / MAINT_PER_PAGE))

  useEffect(() => {
    api<DashboardStats>(`/staff/dashboard?period=${period}`)
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'))
    api<{ data: MaintenanceAlert[]; overdue: number; soon: number }>('/staff/maintenance-alerts')
      .then(setMaint)
      .catch(() => {})
  }, [period])

  if (error) return <div className="p-4 text-red-600">{error}</div>
  if (!stats) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse">
        <SkeletonLine className="h-6 w-48" />
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
        <SkeletonBlock className="mt-6 h-40 w-full" />
      </div>
    )
  }

  // Barra de avance del taller: pendientes + en progreso sobre el total de órdenes activas
  const activeOrders = stats.orders_pending + stats.orders_in_progress + stats.orders_awaiting_approval
  const completion = stats.orders_total > 0 ? Math.round((1 - activeOrders / stats.orders_total) * 100) : 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader title="Dashboard" subtitle="Resumen de la operación del taller." />

      {/* Hero de bienvenida */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-lg shadow-brand-600/20 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
        <p className="relative text-xs font-bold uppercase tracking-widest text-white/70">Portal Admin</p>
        <h1 className="relative mt-1 text-2xl font-black sm:text-3xl">{greeting}</h1>
        <p className="relative mt-1 max-w-xl text-sm text-white/80">
          {activeOrders > 0
            ? `Tienes ${activeOrders} órdenes activas y ${stats.appointments_pending} citas pendientes.`
            : 'Todo bajo control. El taller está al día.'}
        </p>
        <div className="relative mt-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg">📋</div>
            <div>
              <p className="text-xs text-white/70">Órdenes activas</p>
              <p className="text-xl font-black">{activeOrders}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg">📅</div>
            <div>
              <p className="text-xs text-white/70">Citas pendientes</p>
              <p className="text-xl font-black">{stats.appointments_pending}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-lg">💰</div>
            <div>
              <p className="text-xs text-white/70">Facturado (mes)</p>
              <p className="text-xl font-black">{fmt(stats.invoices_this_month ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <QuickTile to="/admin/ordenes" label="Órdenes" gradient="from-sky-500 to-blue-600" icon={<OrdersIcon />} />
        <QuickTile to="/admin/agenda" label="Agenda" gradient="from-violet-500 to-purple-600" icon={<CalendarIcon />} />
        <QuickTile to="/admin/ventas" label="Ventas" gradient="from-brand-500 to-brand-700" icon={<SalesIcon />} />
        <QuickTile to="/admin/inventario" label="Inventario" gradient="from-emerald-500 to-green-600" icon={<BoxIcon />} />
        <QuickTile to="/admin/caja" label="Caja" gradient="from-amber-500 to-orange-600" icon={<MoneyIcon />} />
        <QuickTile to="/admin/clientes" label="Clientes" gradient="from-slate-500 to-carbon-700" icon={<UsersIcon />} />
      </div>

      {/* Flujo de trabajo */}
      <div className="mt-6 flex flex-col gap-5 rounded-3xl border border-carbon-200 bg-gradient-to-r from-slate-100 to-white p-6 sm:flex-row sm:items-center dark:border-carbon-200 dark:from-carbon-100 dark:to-carbon-100">
        <div className="flex-1">
          <h2 className="font-bold text-carbon-900 dark:text-carbon-600">Flujo de trabajo del taller</h2>
          <p className="text-sm text-carbon-500">
            {activeOrders} órdenes activas de {stats.orders_total} totales.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <div className="mb-1 flex justify-between text-xs text-carbon-500">
            <span>Avance global</span>
            <span className="font-bold text-brand-600">{completion}%</span>
          </div>
          <ProgressBar value={completion} tone="brand" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GradStat label="Órdenes totales" value={stats.orders_total} gradient="from-carbon-700 to-slate-900" icon={<OrdersIcon />} />
        <GradStat label="Pendientes" value={stats.orders_pending} gradient="from-amber-500 to-orange-600" icon={<ClockIcon />} />
        <GradStat label="En reparación" value={stats.orders_in_progress} gradient="from-sky-500 to-blue-600" icon={<WrenchIcon />} />
        <GradStat label="Por aprobar" value={stats.orders_awaiting_approval} gradient="from-brand-500 to-brand-700" icon={<CheckIcon />} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <GradStat label="Clientes" value={stats.customers} gradient="from-emerald-500 to-green-600" icon={<UsersIcon />} />
        <GradStat label="Motocicletas" value={stats.motorcycles} gradient="from-violet-500 to-purple-600" icon={<MotorIcon />} />
        <GradStat label="Productos" value={stats.products} gradient="from-sky-500 to-blue-600" icon={<BoxIcon />} />
        <GradStat label="Ganancia (mes)" value={fmt(stats.profit_this_month ?? 0)} gradient="from-emerald-500 to-green-600" icon={<ProfitIcon />} />
      </div>

      {/* Tienda online */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-carbon-900 dark:text-carbon-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><ShoppingCart className="h-4 w-4" /></span>
          Tienda online
        </h2>
        <Link to="/admin/ventas?tab=orders" className="text-sm font-semibold text-brand-600 hover:underline">Ver pedidos de tienda</Link>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StoreStat to="/admin/ventas?tab=orders" label="Pedidos por pagar" value={(stats.store_orders_pending ?? 0)} icon={<ReceiptText className="h-5 w-5" />} tone="amber" />
        <StoreStat to="/admin/ventas?tab=orders&review=1" label="Comprobantes en revisión" value={(stats.store_proofs_pending ?? 0)} icon={<FileCheck2 className="h-5 w-5" />} tone="brand" />
        <StoreStat to="/admin/ventas?tab=orders" label="Ventas del mes" value={fmt(stats.store_sales_this_month ?? 0)} icon={<ShoppingCart className="h-5 w-5" />} tone="green" />
      </div>

      {stats.store_proofs_pending && stats.store_proofs_pending > 0 && (
        <Link to="/admin/ventas?tab=orders&review=1" className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><ShieldAlert className="h-4 w-4" /></span>
          Tienes {stats.store_proofs_pending} comprobante(s) por verificar. Entra a Ventas → Pedidos de tienda.
        </Link>
      )}

      {/* Analítica */}
      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><BarChart3 className="h-4 w-4" /></span>
          <h2 className="font-bold text-carbon-900">Analítica del negocio</h2>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-carbon-200 bg-white p-1 shadow-sm dark:border-carbon-200 dark:bg-carbon-100">
          {(['7d', '30d', '12m'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                period === p ? 'bg-brand-600 text-white shadow' : 'text-carbon-500 hover:bg-carbon-100 hover:text-carbon-800 dark:hover:bg-carbon-200'
              }`}
            >
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '12 meses'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><SalesIcon /></span>
              <h2 className="font-bold text-carbon-900">Facturación</h2>
            </div>
            <p className="mt-1 text-xs text-carbon-500">Ingresos del periodo seleccionado</p>
          </div>
          <div className="px-5 pb-5 pt-3">
            <MiniChart
              data={stats.monthly_series?.sales ?? []}
              labels={stats.monthly_series?.labels ?? []}
              color="#ea580c"
              formatValue={(v) => fmt(v)}
            />
          </div>
        </Card>

        <Card>
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><ShoppingCart className="h-4 w-4" /></span>
              <h2 className="font-bold text-carbon-900">Ventas por canal</h2>
            </div>
            <p className="mt-1 text-xs text-carbon-500">Tienda online vs servicios del taller</p>
          </div>
          <div className="px-5 pb-5 pt-4">
            <BarChart
              groups={[
                { label: 'Taller', color: '#ea580c', data: stats.channel_series?.workshop ?? [] },
                { label: 'Tienda', color: '#0ea5e9', data: stats.channel_series?.store ?? [] },
              ]}
              labels={stats.channel_series?.labels ?? []}
              formatValue={(v) => fmt(v)}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><ClockIcon /></span>
              <h2 className="font-bold text-carbon-900">Órdenes por estado</h2>
            </div>
            <p className="mt-1 text-xs text-carbon-500">Distribución de todas las órdenes del taller</p>
          </div>
          <div className="px-5 pb-5 pt-4">
            <DonutChart data={stats.orders_by_status ?? []} formatValue={(v) => String(v)} />
          </div>
        </Card>

        <Card>
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><Wallet className="h-4 w-4" /></span>
              <h2 className="font-bold text-carbon-900">Métodos de pago</h2>
            </div>
            <p className="mt-1 text-xs text-carbon-500">Pedidos del periodo seleccionado</p>
          </div>
          <div className="px-5 pb-5 pt-4">
            <DonutChart data={stats.payment_distribution ?? []} size={170} thickness={22} formatValue={(v) => String(v)} />
          </div>
        </Card>
      </div>

      {stats.mechanics_workload && stats.mechanics_workload.length > 0 && (
        <Card className="mt-4">
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600"><WrenchIcon /></span>
              <h2 className="font-bold text-carbon-900">Carga de trabajo por mecánico</h2>
            </div>
            <p className="mt-1 text-xs text-carbon-500">Ordenes activas y completadas por técnico</p>
          </div>
          <div className="px-5 pb-5 pt-4">
            <BarChart
              groups={[
                { label: 'Activas', color: '#0ea5e9', data: stats.mechanics_workload.map((m) => m.active) },
                { label: 'Completadas', color: '#10b981', data: stats.mechanics_workload.map((m) => m.done) },
              ]}
              labels={stats.mechanics_workload.map((m) => m.label.split(' ')[0])}
            />
          </div>
        </Card>
      )}

      {/* Top productos */}
      {stats.top_products && stats.top_products.length > 0 && (
        <Card className="mt-4">
          <div className="flex items-center justify-between border-b border-carbon-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-carbon-900">Productos más vendidos</h2>
              <p className="text-xs text-carbon-500">Por ingresos acumulados</p>
            </div>
            <Link to="/admin/inventario" className="text-sm font-semibold text-brand-600 hover:underline">Ver inventario</Link>
          </div>
          <ul className="divide-y divide-carbon-100">
            {stats.top_products.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${i < 3 ? 'bg-brand-100 text-brand-700' : 'bg-carbon-100 text-carbon-600'}`}>
                  #{i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-carbon-900">{p.name}</p>
                  <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-carbon-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      style={{ width: `${Math.min(100, (p.revenue / Math.max(1, stats.top_products![0].revenue)) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-carbon-900">{fmt(p.revenue)}</p>
                  <p className="text-xs text-carbon-400">{p.qty} und · stock {p.stock}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.stock_low > 0 && (
        <Link to="/admin/inventario" className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">!</span>
          {stats.stock_low} producto(s) con inventario bajo. Revisa la sección Inventario.
        </Link>
      )}

      <Card className="mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-carbon-100 px-5 py-4">
          <h2 className="font-bold text-carbon-900">Órdenes recientes</h2>
          <Link to="/admin/ordenes" className="text-sm font-semibold text-brand-600 hover:underline">Ver todas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-carbon-50 text-left text-carbon-500">
              <tr>
                <th className="px-4 py-3">Orden</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_orders.map((o) => (
                <tr key={o.id} className="border-t border-carbon-100 hover:bg-carbon-50/60">
                  <td className="px-4 py-3 font-semibold text-carbon-900">{o.order_number}</td>
                  <td className="px-4 py-3">{o.customer?.name || '—'}</td>
                  <td className="px-4 py-3">{o.service_type || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[o.status] ?? 'gray'}>{o.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(o.quotation_total ?? 0)}</td>
                </tr>
              ))}
              {stats.recent_orders.length === 0 && (
                <tr className="border-t border-carbon-100">
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <EmptyState title="No hay órdenes todavía" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-carbon-100 px-5 py-4">
          <h2 className="font-bold text-carbon-900">Pedidos de tienda recientes</h2>
          <Link to="/admin/ventas?tab=orders" className="text-sm font-semibold text-brand-600 hover:underline">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-carbon-50 text-left text-carbon-500">
              <tr>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recent_store_orders ?? []).map((o) => {
                const sm = storeStatusMeta[o.order_status] ?? storeStatusMeta.pending
                return (
                  <tr key={o.id} className="border-t border-carbon-100 hover:bg-carbon-50/60">
                    <td className="px-4 py-3 font-mono font-semibold text-carbon-900">{o.invoice_number}</td>
                    <td className="px-4 py-3">{o.customer || '—'}</td>
                    <td className="px-4 py-3"><Badge tone={sm.tone}>{sm.label}</Badge></td>
                    <td className="px-4 py-3 capitalize text-carbon-600">{o.payment_method?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(o.total)}</td>
                  </tr>
                )
              })}
              {(stats.recent_store_orders ?? []).length === 0 && (
                <tr className="border-t border-carbon-100">
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <EmptyState title="Sin pedidos de tienda todavía" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-carbon-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-carbon-900">Próximos mantenimientos</h2>
            <p className="text-xs text-carbon-500">Alertas automáticas según las reglas configuradas.</p>
          </div>
          {maint && (maint.overdue > 0 || maint.soon > 0) && (
            <div className="flex items-center gap-2">
              {maint.overdue > 0 && <Badge tone="red">{maint.overdue} vencidos</Badge>}
              {maint.soon > 0 && <Badge tone="amber">{maint.soon} próximos</Badge>}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-carbon-50 text-left text-carbon-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Moto</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {maintRows.slice((maintPage - 1) * MAINT_PER_PAGE, maintPage * MAINT_PER_PAGE).map((m, i) => (
                <tr key={`${m.motorcycle_id}-${m.service_name}-${i}`} className="border-t border-carbon-100 hover:bg-carbon-50/60">
                  <td className="px-4 py-3 font-semibold text-carbon-900">{m.customer || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-carbon-700">
                      {[m.brand, m.model].filter(Boolean).join(' ')}
                    </span>
                    {m.plate && <span className="ml-1 font-mono text-xs text-carbon-400">{m.plate}</span>}
                  </td>
                  <td className="px-4 py-3 text-carbon-600">{m.service_name}</td>
                  <td className="px-4 py-3 text-carbon-600">
                    {m.km_left != null
                      ? m.urgency === 'overdue'
                        ? `Vencido por km`
                        : `${m.km_left} km restantes`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-carbon-600">
                    {m.days_left != null
                      ? m.days_left <= 0
                        ? 'Vencido'
                        : `en ${m.days_left} días`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.urgency === 'overdue' ? 'red' : m.urgency === 'soon' ? 'amber' : 'green'}>
                      {m.urgency === 'overdue' ? 'Vencido' : m.urgency === 'soon' ? 'Próximo' : 'Al día'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {maint && maint.data.length === 0 && (
                <tr className="border-t border-carbon-100">
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <EmptyState title="Sin mantenimientos pendientes" subtitle="Todas las motos están al día según las reglas." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {maintTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-carbon-100 px-5 py-3">
            <p className="text-xs text-carbon-500">
              {maintRows.length} alertas · Página {maintPage} de {maintTotalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMaintPage((p) => Math.max(1, p - 1))}
                disabled={maintPage <= 1}
                className="rounded-lg border border-carbon-200 px-3 py-1.5 text-xs font-semibold text-carbon-600 transition hover:bg-carbon-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-carbon-200 dark:hover:bg-carbon-200"
              >
                Anterior
              </button>
              <button
                onClick={() => setMaintPage((p) => Math.min(maintTotalPages, p + 1))}
                disabled={maintPage >= maintTotalPages}
                className="rounded-lg border border-carbon-200 px-3 py-1.5 text-xs font-semibold text-carbon-600 transition hover:bg-carbon-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-carbon-200 dark:hover:bg-carbon-200"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function GradStat({ label, value, gradient, icon }: {
  label: string
  value: React.ReactNode
  gradient: string
  icon: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-carbon-100 dark:border-carbon-200">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-10`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white shadow-md`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-carbon-500">{label}</p>
          <p className="truncate text-2xl font-bold text-carbon-900 dark:text-carbon-700">{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickTile({ to, label, gradient, icon }: {
  to: string
  label: string
  gradient: string
  icon: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-carbon-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-carbon-100 dark:border-carbon-200"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md transition group-hover:scale-110`}>
        {icon}
      </div>
      <p className="mt-3 text-sm font-bold text-carbon-900 dark:text-carbon-600">{label}</p>
    </Link>
  )
}

function StoreStat({ to, label, value, icon, tone }: {
  to: string
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone: 'amber' | 'brand' | 'green'
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-700',
    brand: 'bg-brand-100 text-brand-600',
    green: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-carbon-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-carbon-100 dark:border-carbon-200"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]} transition group-hover:scale-110`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-carbon-500">{label}</p>
        <p className="truncate text-xl font-bold text-carbon-900 dark:text-carbon-700">{value}</p>
      </div>
    </Link>
  )
}

function OrdersIcon() { return <ClipboardList className="h-[22px] w-[22px]" /> }
function ClockIcon() { return <Clock className="h-[22px] w-[22px]" /> }
function WrenchIcon() { return <Wrench className="h-[22px] w-[22px]" /> }
function CheckIcon() { return <CheckCircle2 className="h-[22px] w-[22px]" /> }
function UsersIcon() { return <Users className="h-[22px] w-[22px]" /> }
function MotorIcon() { return <Bike className="h-[22px] w-[22px]" /> }
function BoxIcon() { return <Package className="h-[22px] w-[22px]" /> }
function CalendarIcon() { return <CalendarDays className="h-[22px] w-[22px]" /> }
function SalesIcon() { return <BarChart3 className="h-[22px] w-[22px]" /> }
function ProfitIcon() { return <TrendingUp className="h-[22px] w-[22px]" /> }
function MoneyIcon() { return <Wallet className="h-[22px] w-[22px]" /> }