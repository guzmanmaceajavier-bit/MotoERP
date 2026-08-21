import { useEffect, useMemo, useState } from 'react'
import { BarChart3, TrendingUp, Package, Users, Wrench, ReceiptText, Download, Wallet, ShoppingBag, CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { StatCard, SectionHeader, Badge } from '../../components/ui'
import { Toolbar } from '../../components/ui/toolbar'
import { DataTable, type Column } from '../../components/ui/table'
import { Field, Input, Select } from '../../components/ui/form'
import { fmtMoney } from '../../lib/money'
import { useToast } from '../../lib/toast'

interface DailyRow {
  issue_date: string
  total: number | string
  count: number | string
}

interface MechanicRow {
  mechanic: string
  count: number
  total: number
}

interface MethodRow {
  method: string
  count: number
  total: number
}

interface ProductRow {
  product_id: number | null
  name: string
  quantity: number
  revenue: number
  profit: number
  rank?: number
}

interface ReportsData {
  period: { from: string; to: string }
  total_sales: number
  invoice_count: number
  cost: number
  profit: number
  outstanding: number
  compare: {
    prev_from: string
    prev_to: string
    sales: number
    profit: number
    sales_delta: number | null
    profit_delta: number | null
  }
  daily: DailyRow[]
  by_method: MethodRow[]
  by_mechanic: MechanicRow[]
  top_products: ProductRow[]
}

const METHOD_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

const METHODS: { key: string; tone: 'brand' | 'green' | 'amber' | 'blue' | 'dark' }[] = [
  { key: 'efectivo', tone: 'green' },
  { key: 'tarjeta', tone: 'brand' },
  { key: 'transferencia', tone: 'amber' },
]

type Tab = 'daily' | 'methods' | 'products' | 'mechanics'

export default function Reports() {
  const toast = useToast().toast
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('daily')
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [compare, setCompare] = useState('prev')
  const [exporting, setExporting] = useState(false)

  async function load(f?: string, t?: string, c?: string) {
    setError('')
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    if (c) params.set('compare', c)
    try {
      const res = await api<ReportsData>(`/staff/reports?${params}`)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  useEffect(() => {
    load(from, to, compare).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortedDaily = useMemo(
    () => (data ? [...data.daily].sort((a, b) => a.issue_date.localeCompare(b.issue_date)) : []),
    [data]
  )

  function applyFilters() {
    if (!from || !to) {
      toast.error('Selecciona un rango de fechas válido')
      return
    }
    load(from, to, compare).catch(() => {})
  }

  function exportCsv() {
    if (!data || exporting) return
    setExporting(true)
    try {
      const rows: string[][] = [
        [`Reporte ${new Date(data.period.from).toLocaleDateString()} - ${new Date(data.period.to).toLocaleDateString()}`],
        [],
        ['Métricas', 'Valor'],
        ['Ventas', fmtMoney2(data.total_sales)],
        ['Ganancia', fmtMoney2(data.profit)],
        ['Costo repuestos', fmtMoney2(data.cost)],
        ['Facturas', String(data.invoice_count)],
        ['Cuentas por cobrar', fmtMoney2(data.outstanding)],
        [],
        ['Ventas por día', 'Total', 'Facturas'],
        ...sortedDaily.map((d) => [formatDay(d.issue_date), fmtMoney2(Number(d.total)), String(d.count)]),
        [],
        ['Método de pago', 'Total', 'Facturas'],
        ...(data.by_method || []).map((m) => [METHOD_LABEL[m.method] ?? m.method, fmtMoney2(m.total), String(m.count)]),
        [],
        ['Top productos', 'Cantidad', 'Ingresos', 'Ganancia'],
        ...(data.top_products || []).map((p) => [p.name, String(p.quantity), fmtMoney2(p.revenue), fmtMoney2(p.profit)]),
        [],
        ['Órdenes por mecánico', 'Órdenes', 'Total'],
        ...(data.by_mechanic || []).map((m) => [m.mechanic, String(m.count), fmtMoney2(m.total)]),
      ]
      const csv = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${data.period.from}-a-${data.period.to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte exportado')
    } catch {
      toast.error('No se pudo exportar el reporte')
    } finally {
      setExporting(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <SectionHeader title="Reportes" subtitle="No se pudo cargar el reporte." />
        <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <SectionHeader title="Reportes" subtitle="Cargando datos del período…" />
        <div className="mt-6 h-40 animate-pulse rounded-xl bg-carbon-100" />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'daily', label: 'Ventas por día', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'methods', label: 'Métodos de pago', icon: <Wallet className="h-4 w-4" /> },
    { key: 'products', label: 'Top productos', icon: <ShoppingBag className="h-4 w-4" /> },
    { key: 'mechanics', label: 'Por mecánico', icon: <Wrench className="h-4 w-4" /> },
  ]

  const dailyColumns: Column<DailyRow>[] = [
    { key: 'date', header: 'Fecha', render: (r) => <span className="font-semibold text-carbon-900">{formatDay(r.issue_date)}</span> },
    { key: 'count', header: 'Facturas', align: 'right', render: (r) => <span className="text-carbon-600">{Number(r.count)}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="font-bold text-carbon-900">{fmtMoney(Number(r.total))}</span> },
  ]

  const methodColumns: Column<MethodRow>[] = [
    { key: 'method', header: 'Método', render: (r) => <Badge tone={METHODS.find((x) => x.key === r.method)?.tone ?? 'dark'}>{METHOD_LABEL[r.method] ?? r.method}</Badge> },
    { key: 'count', header: 'Facturas', align: 'right', render: (r) => <span className="text-carbon-600">{r.count}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="font-bold text-carbon-900">{fmtMoney(r.total)}</span> },
    {
      key: 'pct',
      header: '% del período',
      align: 'right',
      render: (r) => {
        const pct = data.total_sales ? Math.round((r.total / data.total_sales) * 100) : 0
        return (
          <span className="inline-flex items-center gap-1.5 font-semibold text-carbon-600">
            {pct}%
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-carbon-100">
              <span className={`block h-full rounded-full ${METHODS.find((x) => x.key === r.method)?.tone === 'green' ? 'bg-emerald-500' : METHODS.find((x) => x.key === r.method)?.tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
            </span>
          </span>
        )
      },
    },
  ]

  const productColumns: Column<ProductRow>[] = [
    {
      key: 'rank',
      header: '#',
      render: (r) => <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-carbon-900 text-xs font-bold text-white">{r.rank ?? '—'}</span>,
    },
    { key: 'name', header: 'Producto', render: (r) => <span className="font-semibold text-carbon-900">{r.name}</span> },
    { key: 'qty', header: 'Cantidad', align: 'right', render: (r) => <span className="text-carbon-600">{r.quantity}</span> },
    { key: 'revenue', header: 'Ingresos', align: 'right', render: (r) => <span className="font-bold text-carbon-900">{fmtMoney(r.revenue)}</span> },
    {
      key: 'profit',
      header: 'Ganancia',
      align: 'right',
      render: (r) => (
        <span className={`inline-flex items-center gap-1 font-semibold ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {r.profit >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {fmtMoney(r.profit)}
        </span>
      ),
    },
  ]

  const mechanicColumns: Column<MechanicRow>[] = [
    {
      key: 'name',
      header: 'Mecánico',
      render: (r) => (
        <span className="inline-flex items-center gap-2.5 font-semibold text-carbon-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-carbon-900 text-white"><Wrench className="h-4 w-4" /></span>
          {r.mechanic}
        </span>
      ),
    },
    { key: 'count', header: 'Órdenes completadas', align: 'right', render: (r) => <span className="text-carbon-600">{r.count}</span> },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <span className="font-bold text-carbon-900">{fmtMoney(r.total)}</span> },
  ]

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Reportes"
        subtitle={`Resumen de ${new Date(data.period.from).toLocaleDateString()} al ${new Date(data.period.to).toLocaleDateString()}.`}
        action={
          <button onClick={exportCsv} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50">
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
        }
      />

      <Toolbar>
        <Field label="Desde" variant="brand">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} variant="brand" />
        </Field>
        <Field label="Hasta" variant="brand">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} variant="brand" />
        </Field>
        <div className="hidden w-px self-stretch bg-carbon-200 sm:block" />
        <Field label="Comparación" variant="brand">
          <Select value={compare} onChange={(e) => setCompare(e.target.value)} variant="brand">
            <option value="prev">vs período anterior</option>
            <option value="none">Sin comparación</option>
          </Select>
        </Field>
        <button onClick={applyFilters} className="mb-1 inline-flex items-center gap-2 self-end rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
          <BarChart3 className="h-4 w-4" />
          Aplicar rango
        </button>
      </Toolbar>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventas del período" value={fmtMoney(data.total_sales)} tone="brand" icon={<BarChart3 className="h-[22px] w-[22px]" />} delta={data.compare.sales_delta == null ? undefined : { value: Math.abs(data.compare.sales_delta), direction: data.compare.sales_delta >= 0 ? 'up' : 'down', label: 'vs período anterior' }} />
        <StatCard label="Ganancia" value={fmtMoney(data.profit)} tone="green" icon={<TrendingUp className="h-[22px] w-[22px]" />} delta={data.compare.profit_delta == null ? undefined : { value: Math.abs(data.compare.profit_delta), direction: data.compare.profit_delta >= 0 ? 'up' : 'down', label: 'vs período anterior' }} />
        <StatCard label="Costo repuestos" value={fmtMoney(data.cost)} tone="amber" icon={<Package className="h-[22px] w-[22px]" />} />
        <StatCard label="Facturas" value={data.invoice_count} tone="dark" icon={<ReceiptText className="h-[22px] w-[22px]" />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Promedio por factura" value={data.invoice_count ? fmtMoney(data.total_sales / data.invoice_count) : '$0'} tone="blue" icon={<ShoppingBag className="h-[22px] w-[22px]" />} />
        <StatCard label="Cuentas por cobrar" value={fmtMoney(data.outstanding)} tone="red" icon={<Wallet className="h-[22px] w-[22px]" />} />
        <StatCard label="Mecánicos activos" value={data.by_mechanic.length} tone="dark" icon={<Users className="h-[22px] w-[22px]" />} />
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.key
                  ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'border-brand-300 bg-white text-carbon-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'daily' && (
            <DataTable<DailyRow>
              variant="brand"
              columns={dailyColumns}
              rows={sortedDaily}
              emptyText="Sin ventas en el período."
              minWidth="min-w-[480px]"
              rowKey={(r) => r.issue_date}
            />
          )}

          {tab === 'methods' && (
            <DataTable<MethodRow>
              variant="brand"
              columns={methodColumns}
              rows={data.by_method || []}
              emptyText="Sin pagos en el período."
              minWidth="min-w-[480px]"
              rowKey={(r) => r.method}
            />
          )}

          {tab === 'products' && (
            <DataTable<ProductRow>
              variant="brand"
              columns={productColumns}
              rows={(data.top_products || []).map((p, i) => ({ ...p, rank: i + 1 }))}
              emptyText="Sin ventas de productos en el período."
              minWidth="min-w-[560px]"
              rowKey={(_r, idx) => idx}
            />
          )}

          {tab === 'mechanics' && (
            <DataTable<MechanicRow>
              variant="brand"
              columns={mechanicColumns}
              rows={data.by_mechanic}
              emptyText="Sin órdenes completadas en el período."
              minWidth="min-w-[480px]"
              rowKey={(r) => r.mechanic}
            />
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-carbon-400">
        {data.compare.prev_from && data.compare.prev_to ? (
          <>
            Período comparado: {new Date(data.compare.prev_from).toLocaleDateString()} - {new Date(data.compare.prev_to).toLocaleDateString()}
            {data.compare.sales_delta == null ? ' (sin ventas previas para comparar)' : ''}
          </>
        ) : (
          'Comparación desactivada para este reporte.'
        )}
      </p>
    </div>
  )
}

function formatDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const fmtMoney2 = (n: number) => '$' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
