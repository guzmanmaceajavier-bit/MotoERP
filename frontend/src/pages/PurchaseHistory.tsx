import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, apiBlob } from '../lib/api'
import { EmptyState, SectionHeader } from '../components/ui'
import Pagination from '../components/Pagination'
import { RowSkeleton } from '../components/Skeletons'
import type { TimelineEvent, TimelinePage, InvoiceTotals } from '../lib/types'
import { useRefetchOnFocus } from '../lib/useRefetch'
import { useToast } from '../lib/toast'

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

const INVOICE_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  paid: { label: 'Pagado', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  partial: { label: 'Abonado', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  unpaid: { label: 'Pendiente', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' },
  pending: { label: 'Pendiente', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' },
}

const ORDER_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  pending: { label: 'Pendiente', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-500' },
  in_progress: { label: 'En taller', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', dot: 'bg-sky-500' },
  awaiting_approval: { label: 'Esperando aprobación', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  approved: { label: 'Aprobada', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
  completed: { label: 'Completada', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  delivered: { label: 'Entregada', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelada', pill: 'bg-carbon-100 text-carbon-600 dark:bg-carbon-500/10 dark:text-carbon-400', dot: 'bg-carbon-400' },
}

const POINTS_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  earned: { label: 'Ganados', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  spent: { label: 'Canjeados', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
}

const APPOINTMENT_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  pending: { label: 'Pendiente', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-500' },
  confirmed: { label: 'Confirmada', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  completed: { label: 'Atendida', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', dot: 'bg-sky-500' },
  cancelled: { label: 'Cancelada', pill: 'bg-carbon-100 text-carbon-600 dark:bg-carbon-500/10 dark:text-carbon-400', dot: 'bg-carbon-400' },
  no_show: { label: 'No asistió', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' },
}

const GENERIC_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  saved: { label: 'Registrado', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  rated: { label: 'Valorado', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
}

const ZERO_TOTALS: InvoiceTotals = { orders: 0, total_spent: 0, this_month: 0, outstanding: 0 }

const selectCls =
  'rounded-xl border border-carbon-300 bg-white px-3 py-2 text-sm text-carbon-900 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

function Stat({ label, value, gradient, icon }: { label: string; value: string; gradient: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-500/5" />
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

function StatusBadge({ ev }: { ev: TimelineEvent }) {
  const map =
    ev.type === 'invoice'
      ? INVOICE_STATUS
      : ev.type === 'order'
        ? ORDER_STATUS
        : ev.type === 'appointment'
          ? APPOINTMENT_STATUS
          : ev.type === 'points'
            ? POINTS_STATUS
            : GENERIC_STATUS
  const m = map[ev.status] as { label: string; pill: string; dot: string } | undefined
  if (!m) return <span className="rounded-full bg-carbon-100 px-2.5 py-1 text-[11px] font-bold text-carbon-600">{ev.status_label ?? ev.status}</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function TypeIcon({ ev }: { ev: TimelineEvent }) {
  const cls = (c: string) => `inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl ${c}`
  if (ev.type === 'points') {
    return (
      <span className={cls('bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
      </span>
    )
  }
  if (ev.type === 'order') {
    return (
      <span className={cls('bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
      </span>
    )
  }
  if (ev.type === 'appointment') {
    return (
      <span className={cls('bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M12 14v3l2 1" /></svg>
      </span>
    )
  }
  if (ev.type === 'favorite') {
    return (
      <span className={cls('bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
      </span>
    )
  }
  if (ev.type === 'rating') {
    return (
      <span className={cls('bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
      </span>
    )
  }
  if (ev.type === 'motorcycle') {
    return (
      <span className={cls('bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300')}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M5.5 17.5h13M15 6l-3-2-2 3M15 6l3 4h-5l-3-2" /></svg>
      </span>
    )
  }
  return (
    <span className={cls(ev.source === 'service' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300' : 'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300')}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
    </span>
  )
}

function TimelineCard({ ev, expanded, onToggle, onPdf, downloading }: {
  ev: TimelineEvent
  expanded: boolean
  onToggle: () => void
  onPdf: () => void
  downloading: boolean
}) {
  const fullDate = ev.date
    ? new Date(ev.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div className="overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm transition hover:shadow-md dark:bg-carbon-100 dark:border-carbon-200">
      <div className="flex items-center gap-4 p-4">
        <TypeIcon ev={ev} />

        {(ev.type === 'invoice' || (ev.type === 'favorite' && ev.thumbnail)) && (
          <div className="relative hidden h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-carbon-100 sm:block dark:bg-carbon-200">
            {ev.thumbnail ? (
              <img src={ev.thumbnail} alt={ev.reference ?? ''} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-carbon-300 dark:text-carbon-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>
              </div>
            )}
          </div>
        )}

        {/* Info principal */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {ev.reference && <p className="font-mono text-sm font-bold text-carbon-900 dark:text-carbon-600">{ev.reference}</p>}
            <StatusBadge ev={ev} />
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-carbon-800 dark:text-carbon-400">{ev.title}</p>
          <p className="mt-0.5 truncate text-xs text-carbon-400">
            {fullDate}
            {ev.detail?.payment_method ? ` · ${ev.detail.payment_method.replace(/_/g, ' ')}` : ''}
          </p>
          {ev.subtitle && <p className="mt-0.5 truncate text-xs text-carbon-500 dark:text-carbon-500">{ev.subtitle}</p>}
        </div>

        {/* Valor + acciones */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {ev.type === 'invoice' && typeof ev.amount === 'number' && (
            <p className="text-lg font-bold text-carbon-900 dark:text-carbon-600">{fmt(ev.amount)}</p>
          )}
          {ev.type === 'points' && typeof ev.points === 'number' && (
            <p className={`text-lg font-bold ${ev.points >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-violet-600 dark:text-violet-300'}`}>
              {ev.points >= 0 ? '+' : ''}{ev.points} pts
            </p>
          )}
          {ev.type === 'order' && ev.detail?.estimated_delivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              {new Date(ev.detail.estimated_delivery + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {ev.type === 'invoice' && typeof ev.outstanding === 'number' && ev.outstanding > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              Saldo {fmt(ev.outstanding)}
            </span>
          )}
          <div className="flex items-center gap-2">
            {(ev.type === 'invoice' && (ev.items?.length ?? 0) > 0) || ev.type !== 'invoice' ? (
              <button
                onClick={onToggle}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  expanded
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-carbon-200 bg-transparent text-carbon-700 hover:border-brand-600 hover:bg-brand-600 hover:text-white dark:border-carbon-200 dark:text-carbon-400'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                {expanded ? 'Ocultar' : 'Ver detalle'}
              </button>
            ) : null}
            {ev.type === 'invoice' && (
              <button
                onClick={onPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-200 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-carbon-700 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white disabled:opacity-50 dark:border-carbon-200 dark:text-carbon-400"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                {downloading ? '…' : 'PDF'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="border-t border-carbon-100 bg-carbon-50/60 px-4 py-4 dark:border-carbon-200 dark:bg-carbon-100">
          {ev.type === 'invoice' && (
            <>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-carbon-400">Qué se compró / se hizo</p>
              {(ev.items?.length ?? 0) === 0 ? (
                <p className="text-sm text-carbon-500">Sin ítems detallados.</p>
              ) : (
                <div className="space-y-1.5">
                  {ev.items!.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 dark:bg-carbon-50">
                      {it.image && <img src={it.image} alt={it.description} className="h-10 w-10 flex-none rounded-lg object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-sm text-carbon-700 dark:text-carbon-500">{it.description}</span>
                      <span className="flex-none text-xs font-semibold text-carbon-500">x{it.quantity}</span>
                      <span className="w-20 flex-none text-right text-sm font-semibold text-carbon-900 dark:text-carbon-500">{fmt(it.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {ev.type === 'order' && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-400">Cotización</p>
                  <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.detail?.quotation_status ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-400">Entrega estimada</p>
                  <p className="text-sm text-carbon-700 dark:text-carbon-500">
                    {ev.detail?.estimated_delivery ? new Date(ev.detail.estimated_delivery + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-400">Moto</p>
                  <p className="truncate text-sm text-carbon-700 dark:text-carbon-500">
                    {ev.detail?.motorcycle
                      ? [ev.detail.motorcycle.brand, ev.detail.motorcycle.nickname, ev.detail.motorcycle.plate].filter(Boolean).join(' · ')
                      : 'Sin asignar'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-carbon-400">El estado detallado de tu orden y su cotización está en la sección «Mis servicios».</p>
            </div>
          )}

          {ev.type === 'points' && (
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 dark:bg-carbon-50">
              <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.subtitle}</p>
              {typeof ev.detail?.balance_after === 'number' && (
                <p className="text-xs font-semibold text-carbon-500">Saldo después: {ev.detail.balance_after} pts</p>
              )}
            </div>
          )}

          {ev.type === 'appointment' && (
            <div className="space-y-1.5">
              <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.subtitle}</p>
              {ev.detail?.scheduled_at && (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  {ev.detail.scheduled_at}
                </p>
              )}
              {ev.detail?.notes && <p className="text-xs text-carbon-400">Nota: {ev.detail.notes}</p>}
            </div>
          )}

          {ev.type === 'favorite' && (
            <p className="text-sm text-carbon-700 dark:text-carbon-500">
              Lo marcaste como favorito en la tienda. Se mantiene en tu lista <span className="font-semibold">Favoritos</span>.
            </p>
          )}

          {ev.type === 'rating' && (
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 dark:bg-carbon-50">
              <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.subtitle}</p>
              {typeof ev.detail?.score === 'number' && (
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-300">Puntaje {ev.detail.score}/5</p>
              )}
            </div>
          )}

          {ev.type === 'motorcycle' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-400">Placa</p>
                <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.detail?.motorcycle?.plate ?? ev.subtitle}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-400">Año</p>
                <p className="text-sm text-carbon-700 dark:text-carbon-500">{ev.detail?.year ?? '—'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PurchaseHistory() {
  const toast = useToast().toast
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [totals, setTotals] = useState<InvoiceTotals>(ZERO_TOTALS)
  const [pointsBalance, setPointsBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [source, setSource] = useState<'all' | 'store' | 'service' | 'points'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), per_page: '8' })
      if (source !== 'all') params.set('source', source)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (debouncedQuery.trim()) params.set('term', debouncedQuery.trim())
      try {
        const res = await api<TimelinePage>(`/my-timeline?${params.toString()}`)
        setEvents(res.data)
        setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
        setTotals(res.totals ?? ZERO_TOTALS)
        setPointsBalance(res.points_balance ?? 0)
        setHasLoaded(true)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    },
    [source, from, to, debouncedQuery],
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    debounceRef.current = setTimeout(() => load(1), 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [source, from, to, debouncedQuery])

  useRefetchOnFocus(() => load(meta.current_page))

  async function download(id: number, number: string) {
    setDownloading(`inv-${id}`)
    try {
      const blob = await apiBlob(`/invoices/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el PDF')
    } finally {
      setDownloading(null)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (source !== 'all') params.set('source', source)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (debouncedQuery.trim()) params.set('term', debouncedQuery.trim())
      const blob = await apiBlob(`/my-timeline/export?${params.toString()}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historial-actividad${from || to ? '-' + [from || '', to || ''].join('-') : ''}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Historial exportado')
    } catch {
      toast.error('No se pudo exportar el historial')
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = Boolean(source !== 'all' || from || to || query.trim())

  const firstLoading = loading && !hasLoaded

  // Agrupar por mes para mejor organización
  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const ev of events) {
      const d = ev.date ? new Date(ev.date + 'T00:00:00') : null
      const key = d
        ? d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })
        : 'Sin fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return [...map.entries()]
  }, [events])

  const resetFilters = () => {
    setSource('all')
    setFrom('')
    setTo('')
    setQuery('')
  }

  if (firstLoading)
    return (
      <div className="mx-auto max-w-5xl anim-fade-up p-4">
        <RowSkeleton cols={5} rows={6} />
      </div>
    )

  return (
    <div className="mx-auto max-w-5xl anim-fade-up">
      <SectionHeader
        title="Historial de actividad"
        subtitle="Compras, servicios, y puntos de tu taller en una sola línea de tiempo."
        action={
          <button
            onClick={exportCsv}
            disabled={exporting || events.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
        }
      />

      {/* Stats */}
      <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total facturado" value={fmt(totals.total_spent)} gradient="from-violet-500 to-purple-600" icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>
        } />
        <Stat label="Facturas" value={String(totals.orders)} gradient="from-sky-500 to-blue-600" icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
        } />
        <Stat label="Este mes" value={String(totals.this_month)} gradient="from-emerald-500 to-green-600" icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
        } />
        <Stat label="Por pagar" value={String(totals.outstanding)} gradient="from-orange-500 to-amber-600" icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
        } />
      </div>

      {/* Filtros */}
      <div className="mt-6 rounded-2xl border border-carbon-200 bg-white p-4 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar factura, orden o punto…"
              className="garaje-input sm:w-56"
            />
            <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={selectCls}>
              <option value="all">Toda la actividad</option>
              <option value="store">Tienda</option>
              <option value="service">Servicios</option>
              <option value="points">Puntos</option>
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-carbon-500">Desde</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-carbon-500">Hasta</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
            </div>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-carbon-300 bg-white px-3 py-2 text-sm font-semibold text-carbon-600 transition hover:border-rose-400 hover:text-rose-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resultados */}
      <p className="mt-4 text-xs font-medium text-carbon-500">
        {meta.total} movimiento{meta.total === 1 ? '' : 's'}
        {hasFilters && ' encontrados'}
        {pointsBalance ? ` · ${pointsBalance} pts disponibles` : ''}
      </p>

      <div className={`mt-2 space-y-6 transition-opacity duration-150 ${loading && hasLoaded ? 'opacity-50' : ''}`}>
        {events.length === 0 ? (
          <EmptyState
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            }
            title={hasFilters ? 'No hay actividad que coincida' : 'No hay actividad todavía'}
            subtitle={hasFilters ? 'Prueba con otros filtros o fechas.' : 'Cuando compres o agendes un servicio, aparecerá aquí.'}
          />
        ) : (
          grouped.map(([month, list]) => (
            <div key={month}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-carbon-400">
                <span className="h-1 w-4 rounded-full bg-brand-500" />
                {month}
                <span className="text-xs font-medium text-carbon-300">({list.length})</span>
              </h2>
              <div className="space-y-3">
                {list.map((ev) => (
                  <TimelineCard
                    key={ev.event_id}
                    ev={ev}
                    expanded={expanded === ev.event_id}
                    onToggle={() => setExpanded(expanded === ev.event_id ? null : ev.event_id)}
                    onPdf={() => download(ev.id, ev.reference ?? '')}
                    downloading={downloading === `inv-${ev.id}`}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => load(p)} />
    </div>
  )
}