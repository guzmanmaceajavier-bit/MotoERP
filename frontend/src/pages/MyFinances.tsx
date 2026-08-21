import { useEffect, useState } from 'react'
import { api, getToken } from '../lib/api'
import Pagination from '../components/Pagination'
import { Badge, SectionHeader, StatCard } from '../components/ui'
import type { Paginated } from '../lib/pagination'
import { unwrapList } from '../lib/pagination'
import type { InvoiceDetail, InvoiceSummary, LoyaltyInfo, Warranty } from '../lib/types'
import { useSiteInfo } from '../lib/useSiteImages'

type Tab = 'invoices' | 'points' | 'warranties'

const currency = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

const invStatus: Record<string, { label: string; tone: string }> = {
  paid: { label: 'Pagado', tone: 'green' },
  partial: { label: 'Abonado', tone: 'amber' },
  unpaid: { label: 'Pendiente', tone: 'red' },
  pending: { label: 'Pendiente', tone: 'blue' },
}

const invSource: Record<string, { label: string; icon: React.ReactNode }> = {
  store: { label: 'Tienda', icon: <CartIcon /> },
  service: { label: 'Servicio', icon: <WrenchIcon /> },
}

const methodLabel = (m?: string) => (m ? m.replace(/_/g, ' ') : '')

function CartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l2-1 2 1m0 0l2-2 2 2m-4 0V6m0 4l2-1m-2 1V6m6 4l2-1m-2 1v4m0 0l2-1m-2 1v2" />
    </svg>
  )
}

const StarIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.9 6.26 6.6.57-5 4.6 1.46 6.45L12 16.9 6.04 19.9l1.46-6.45-5-4.6 6.6-.57z" />
  </svg>
)

const ShieldIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const ReceiptIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
  </svg>
)

interface InvoiceTotals {
  orders: number
  total_spent: number
  this_month: number
  outstanding: number
}

export default function MyFinances() {
  const [tab, setTab] = useState<Tab>('invoices')
  const { workshop_name: siteName } = useSiteInfo()
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [invoiceMeta, setInvoiceMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [totals, setTotals] = useState<InvoiceTotals | null>(null)
  const [detail, setDetail] = useState<InvoiceDetail | null>(null)
  const [points, setPoints] = useState<LoyaltyInfo | null>(null)
  const [warranties, setWarranties] = useState<Warranty[]>([])
  const [redeemPoints, setRedeemPoints] = useState('')
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [redeeming, setRedeeming] = useState(false)

  useEffect(() => {
    loadInvoices()
    api<LoyaltyInfo>('/my-points').then(setPoints).catch(() => {})
    api<Paginated<Warranty> | Warranty[]>('/my-warranties').then((res) => setWarranties(unwrapList(res))).catch(() => {})
  }, [])

  async function loadInvoices(page = 1) {
    try {
      const res = await api<Paginated<InvoiceSummary> & { totals?: InvoiceTotals }>(`/my-invoices?page=${page}`)
      setInvoices(res.data)
      setInvoiceMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
      if (res.totals) setTotals(res.totals)
    } catch {
      /* ignore */
    }
  }

  async function openInvoice(id: number) {
    const d = await api<InvoiceDetail>(`/invoices/${id}`)
    setDetail(d)
  }

  async function download(id: number) {
    const token = getToken()
    const res = await fetch(`/api/v1/invoices/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factura-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadWarranty(id: number) {
    const token = getToken()
    const res = await fetch(`/api/v1/warranties/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `garantia-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doRedeem() {
    const pointsNum = Number(redeemPoints)
    if (!pointsNum || pointsNum < 100) {
      setRedeemMsg({ ok: false, text: 'Ingresa al menos 100 puntos.' })
      return
    }
    setRedeeming(true)
    setRedeemMsg(null)
    try {
      const res = await api<{ message: string; coupon: string; value: number; balance: number }>('/points/redeem', {
        method: 'POST',
        body: JSON.stringify({ points: pointsNum }),
      })
      setRedeemMsg({ ok: true, text: `${res.message} Cupón: ${res.coupon} (${currency(res.value)})` })
      setRedeemPoints('')
      const fresh = await api<LoyaltyInfo>('/my-points')
      setPoints(fresh)
    } catch (e) {
      setRedeemMsg({ ok: false, text: e instanceof Error ? e.message : 'Error al canjear.' })
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl anim-fade-up">
      <SectionHeader
        title="Mis finanzas"
        subtitle="Controla tus facturas, acumula puntos y consulta tus garantías."
        action={
          points ? (
            <div className="flex items-center gap-3 rounded-xl border border-carbon-200 bg-white px-4 py-2.5 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                {StarIcon}
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-400">Puntos</p>
                <p className="text-lg font-black text-carbon-900 dark:text-carbon-700">{points.balance}</p>
              </div>
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button onClick={() => setTab('invoices')} className="text-left" title="Ver facturas">
          <StatCard label="Total invertido" value={currency(totals?.total_spent ?? 0)} icon={ReceiptIcon} tone="brand" />
        </button>
        <button onClick={() => setTab('invoices')} className="text-left" title="Ver facturas del mes">
          <StatCard label="Compras este mes" value={totals?.this_month ?? 0} icon={CartIcon()} tone="blue" />
        </button>
        <button onClick={() => setTab('invoices')} className="text-left" title="Ver todas las facturas">
          <StatCard label="Facturas" value={totals?.orders ?? 0} icon={ReceiptIcon} tone="dark" />
        </button>
        <button onClick={() => setTab('invoices')} className="text-left" title="Ver saldos pendientes">
          <StatCard
            label="Por pagar"
            value={(totals?.outstanding ?? 0) > 0 ? totals!.outstanding : 'Ninguno'}
            icon={ShieldIcon}
            tone={(totals?.outstanding ?? 0) > 0 ? 'amber' : 'green'}
          />
        </button>
      </div>

      <div className="mx-auto mt-8 flex max-w-md items-center gap-1 rounded-2xl border border-carbon-200 bg-white p-1.5 shadow-sm dark:border-carbon-200 dark:bg-carbon-100">
        {([
          ['invoices', 'Facturas', ReceiptIcon],
          ['points', 'Mis puntos', StarIcon],
          ['warranties', 'Garantías', ShieldIcon],
        ] as [Tab, string, React.ReactNode][]).map(([key, label, ic]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${
              tab === key ? 'bg-brand-600 text-white shadow' : 'text-carbon-500 hover:bg-carbon-100 hover:text-carbon-800 dark:hover:bg-carbon-200 dark:hover:text-carbon-600'
            }`}
          >
            <span className={tab === key ? 'text-white' : 'text-brand-500'}>{ic}</span>
            {label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
          <div className="hidden items-center gap-4 border-b border-carbon-100 bg-carbon-50/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-carbon-400 sm:flex dark:border-carbon-200 dark:bg-carbon-200/40">
            <span className="flex-1">Factura</span>
            <span className="w-24 text-center">Estado</span>
            <span className="w-16 text-center">Ítems</span>
            <span className="w-28 text-right">Total</span>
            <span className="w-20 text-center">Acción</span>
          </div>
          <div className="divide-y divide-carbon-100 dark:divide-carbon-200">
            {invoices.map((inv) => {
              const st = invStatus[inv.status] ?? { label: inv.status, tone: 'gray' }
              const src = inv.source ? invSource[inv.source] : null
              const hasOutstanding = (inv.outstanding ?? 0) > 0
              return (
                <div key={inv.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-carbon-50/50 sm:flex-row sm:items-center sm:gap-4 dark:hover:bg-carbon-200/30">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-carbon-100 text-carbon-500 dark:bg-carbon-200">
                      {src ? <span className={src.label === 'Servicio' ? 'text-brand-600' : 'text-carbon-500'}>{src.icon}</span> : ReceiptIcon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-carbon-900 dark:text-carbon-700">{inv.invoice_number}</span>
                        {src && (
                          <span className="chip bg-carbon-100 text-carbon-600 dark:bg-carbon-200 dark:text-carbon-600">{src.label}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-carbon-500">
                        <span>{fmtDate(inv.issue_date)}</span>
                        <span className="capitalize">{methodLabel(inv.payment_method)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:w-24 sm:justify-center">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {hasOutstanding && <span className="text-xs font-medium text-red-500 sm:hidden">Restan {currency(inv.outstanding ?? 0)}</span>}
                  </div>
                  <div className="text-sm text-carbon-500 sm:w-16 sm:text-center">
                    {inv.items_count ?? '–'}
                  </div>
                  <div className="flex items-center justify-between sm:w-28 sm:justify-end">
                    <div className="text-right">
                      <div className="font-bold text-carbon-900 dark:text-carbon-700">{currency(inv.total)}</div>
                      {hasOutstanding ? (
                        <div className="text-xs font-medium text-red-500">Restan {currency(inv.outstanding ?? 0)}</div>
                      ) : (
                        <div className="text-xs font-medium text-emerald-600">Sin saldo</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:w-20 sm:justify-center">
                    <button onClick={() => openInvoice(inv.id)} className="text-sm font-semibold text-brand-600 hover:underline">
                      Ver
                    </button>
                    <button onClick={() => download(inv.id)} className="text-sm font-semibold text-emerald-600 hover:underline" title="Descargar PDF">
                      PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {invoices.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-sm text-carbon-400">No hay facturas todavía. Cuando realices una compra o un servicio, aparecerán aquí.</p>
            </div>
          )}
        </div>
      )}
      {tab === 'invoices' && (
        <Pagination page={invoiceMeta.current_page} lastPage={invoiceMeta.last_page} total={invoiceMeta.total} onChange={(p) => loadInvoices(p)} />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="anim-fade-up max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-carbon-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-carbon-900 dark:text-carbon-700">{detail.invoice_number}</h2>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 text-carbon-400 hover:bg-carbon-100 hover:text-carbon-700" aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={invStatus[detail.status]?.tone ?? 'gray'}>{invStatus[detail.status]?.label ?? detail.status}</Badge>
              <span className="chip bg-carbon-100 text-carbon-600 dark:bg-carbon-200 dark:text-carbon-600">{fmtDate(detail.issue_date)}</span>
              <span className="chip bg-carbon-100 text-carbon-600 dark:bg-carbon-200 dark:text-carbon-600 capitalize">{methodLabel(detail.payment_method)}</span>
            </div>
            <div className="mt-4 divide-y divide-carbon-100">
              {detail.items.map((it, idx) => (
                <div key={idx} className="flex justify-between py-2 text-sm">
                  <span className="min-w-0 pr-3 text-carbon-700">{it.description} x{it.quantity}</span>
                  <span className="whitespace-nowrap font-medium">{currency(it.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-carbon-200 pt-3">
              <span className="font-semibold">Subtotal</span>
              <span className="font-medium">{currency(detail.subtotal)}</span>
            </div>
            {detail.discount > 0 && (
              <div className="mt-1 flex justify-between text-sm">
                <span className="font-semibold text-emerald-700">Descuento por puntos ({detail.points_used})</span>
                <span className="font-medium text-emerald-700">-{currency(detail.discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-carbon-200 pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{currency(detail.total)}</span>
            </div>
            {(detail.warranties && detail.warranties.length > 0) && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Garantías asociadas</p>
                <ul className="mt-2 space-y-1">
                  {detail.warranties.map((w) => (
                    <li key={w.id} className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700">{w.description}</span>
                      <span className="text-xs text-emerald-600">
                        {w.type === 'km' ? `${w.duration.toLocaleString()} km` : `Vence ${w.end_date}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button onClick={() => download(detail.id)} className="btn-primary mt-4 w-full">
              Descargar PDF
            </button>
            <button
              onClick={() => {
                const text = `${siteName || 'MotoSystem'} · Factura ${detail.invoice_number} · Total ${currency(detail.total)}`
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
              }}
              className="btn-outline mt-2 w-full"
            >
              Compartir por WhatsApp
            </button>
          </div>
        </div>
      )}

      {tab === 'points' && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lg shadow-brand-600/20">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="flex items-center gap-2 text-sm font-medium text-brand-100">
                {StarIcon} Puntos de fidelización
              </div>
              <div className="mt-2 text-5xl font-black text-white">{points?.balance ?? 0}</div>
              <p className="mt-3 text-xs text-brand-100">Acumulas 1 punto por cada $1.000 en compras y servicios.</p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
                <span className="text-brand-100">Equivalencia</span>
                <span className="ml-auto font-semibold">1 punto = $1.000</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-carbon-200 bg-white p-5 dark:bg-carbon-100 dark:border-carbon-200">
              <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Canjear por descuento</h3>
              <p className="mt-1 text-sm text-carbon-500">Cada punto vale $1.000. Al canjear recibes un cupón para presentar en el mostrador.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  placeholder="Puntos a canjear"
                  className="garaje-input w-44"
                />
                <button
                  onClick={() => doRedeem().catch(() => {})}
                  disabled={redeeming}
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {redeeming ? 'Canjeando...' : 'Canjear'}
                </button>
              </div>
              {redeemMsg && (
                <p className={`mt-2 text-sm ${redeemMsg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{redeemMsg.text}</p>
              )}
              {redeemMsg?.ok && (
                <div className="mt-3 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">Recibo de canje — presentar en mostrador</p>
                  <p className="mt-1 text-sm font-semibold text-carbon-900">{redeemMsg.text.split('Cupón: ')[1]?.split(' ')[0]}</p>
                  <p className="text-sm text-carbon-600">Fecha: {new Date().toLocaleDateString('es-CO')}</p>
                  <button
                    onClick={() => window.print()}
                    className="mt-3 rounded-lg border border-brand-600 px-4 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-100"
                  >
                    Imprimir recibo
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-carbon-200 bg-white dark:bg-carbon-100 dark:border-carbon-200">
              <div className="border-b border-carbon-100 px-5 py-4 dark:border-carbon-200">
                <h3 className="font-bold text-carbon-900 dark:text-carbon-700">Historial de puntos</h3>
              </div>
              <div className="divide-y divide-carbon-100 dark:divide-carbon-200">
                {(points?.history ?? []).map((h) => {
                  const positive = h.points >= 0
                  return (
                    <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {positive ? <path d="M20 12H4M12 4v16" /> : <path d="M20 12H4" />}
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-carbon-800 dark:text-carbon-700">{h.concept}</p>
                        <p className="text-xs text-carbon-400">{fmtDate(h.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {positive ? '+' : ''}{h.points} pts
                        </p>
                        <p className="text-xs text-carbon-400">Saldo: {h.balance_after}</p>
                      </div>
                    </div>
                  )
                })}
                {(points?.history ?? []).length === 0 && (
                  <p className="border border-dashed border-carbon-300 p-10 text-center text-sm text-carbon-400">
                    Aún no acumulas puntos. ¡Compra o agenda servicios para empezar!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'warranties' && (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {warranties.map((w) => {
            const active = w.status === 'active'
            const end = w.end_date ? new Date(w.end_date).getTime() : null
            const nowMs = Date.now()
            const total = end && w.start_date ? end - new Date(w.start_date).getTime() : 0
            const pct = end && total > 0 ? Math.min(100, Math.max(4, ((end - nowMs) / total) * 100)) : active ? 100 : 0
            return (
              <div key={w.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-carbon-900 dark:text-carbon-700">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-carbon-100 text-carbon-400'}`}>
                      {ShieldIcon}
                    </span>
                    {w.description}
                  </span>
                  <Badge tone={active ? 'green' : w.status === 'expired' ? 'gray' : 'red'}>
                    {active ? 'Activa' : w.status === 'expired' ? 'Vencida' : w.status}
                  </Badge>
                </div>
                {active && w.end_date && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-carbon-500">
                      <span>Vence el {fmtDate(w.end_date)}</span>
                      <span className="font-medium">
                        {w.type === 'km' ? `${w.duration.toLocaleString()} km` : `${Math.max(0, Math.ceil((end! - nowMs) / 86400000))} días restantes`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-carbon-100">
                      <div className={`h-full rounded-full ${active ? 'bg-emerald-500' : 'bg-carbon-300'}`} style={{ width: `${Math.min(100, Math.max(4, pct))}%` }} />
                    </div>
                  </div>
                )}
                {!active && w.end_date && (
                  <p className="mt-2 text-sm text-carbon-500">Vencimiento: {fmtDate(w.end_date)}</p>
                )}
                <button onClick={() => downloadWarranty(w.id)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Descargar certificado PDF
                </button>
              </div>
            )
          })}
          {warranties.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-carbon-300 bg-white p-10 text-center text-sm text-carbon-400 dark:bg-carbon-100 dark:border-carbon-200">
              No tienes garantías. Cuando realices servicios o compres productos con garantía, aparecerán aquí.
            </div>
          )}
        </div>
      )}
    </div>
  )
}