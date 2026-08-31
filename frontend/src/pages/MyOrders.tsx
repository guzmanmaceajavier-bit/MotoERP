import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  Wallet,
  CalendarDays,
  TriangleAlert,
  Package,
  ShoppingCart,
  Eye,
  ChevronRight,
  Upload,
  Truck,
} from 'lucide-react'
import { api, apiBlob, ApiError } from '../lib/api'
import { EmptyState, SectionHeader } from '../components/ui'
import { Toolbar, FilterPill } from '../components/ui/toolbar'
import Pagination from '../components/Pagination'
import { Modal } from '../components/ui/modal'
import type { Paginated } from '../lib/pagination'
import type { InvoiceSummary, InvoiceTotals, Product } from '../lib/types'
import { useRefetchOnFocus } from '../lib/useRefetch'
import PaymentInfoBlock from '../components/PaymentInfoBlock'
import { useCart } from '../lib/cart'
import { useToast } from '../lib/toast'

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

const statusMeta: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'gray' }> = {
  paid: { label: 'Pagado', tone: 'green' },
  partial: { label: 'Abonado', tone: 'amber' },
  unpaid: { label: 'Pendiente', tone: 'red' },
  pending: { label: 'Pendiente', tone: 'red' },
}

const ORDER_META: Record<string, { label: string; pill: string; ring: string; dot: string; hint: string }> = {
  pending: { label: 'Pendiente de pago', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', ring: 'from-rose-400 to-red-600', dot: 'bg-rose-500', hint: 'Completa el pago y sube tu comprobante' },
  payment_review: { label: 'Comprobante en revisión', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', ring: 'from-amber-400 to-orange-600', dot: 'bg-amber-500', hint: 'Estamos verificando tu pago' },
  confirmed: { label: 'Confirmado', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', ring: 'from-sky-400 to-blue-600', dot: 'bg-sky-500', hint: 'En preparación' },
  shipped: { label: 'Enviado', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', ring: 'from-violet-400 to-purple-600', dot: 'bg-violet-500', hint: 'Va en camino a tu destino' },
  delivered: { label: 'Entregado', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', ring: 'from-emerald-400 to-green-600', dot: 'bg-emerald-500', hint: 'Pedido entregado' },
  cancelled: { label: 'Cancelado', pill: 'bg-carbon-100 text-carbon-500 dark:bg-carbon-200 dark:text-carbon-400', ring: 'from-slate-400 to-carbon-600', dot: 'bg-carbon-500', hint: 'El pedido fue cancelado' },
}

const ORDER_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'payment_review', label: 'En revisión' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'shipped', label: 'Enviados' },
  { key: 'delivered', label: 'Entregados' },
] as const

const ZERO_TOTALS: InvoiceTotals = { orders: 0, total_spent: 0, this_month: 0, outstanding: 0 }

/** El cliente puede cancelar pedidos sin pagar: pendientes o confirmados en efectivo sin cobrar. */
const canCancel = (o: { order_status?: string; paid_amount?: number }) =>
  o.order_status === 'pending' || (o.order_status === 'confirmed' && !(Number(o.paid_amount) > 0))

interface ProofPayload {
  reference: string
  payment_method: string
}

interface InvoicesPage extends Paginated<InvoiceSummary> {
  totals?: InvoiceTotals
}

export default function MyOrders() {
  const navigate = useNavigate()
  const { add } = useCart()
  const toast = useToast().toast
  const [orders, setOrders] = useState<InvoiceSummary[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [totals, setTotals] = useState<InvoiceTotals>(ZERO_TOTALS)
  const [loading, setLoading] = useState(true)
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<'all' | (typeof ORDER_FILTERS)[number]['key']>('all')
  const [detail, setDetail] = useState<InvoiceSummary | null>(null)
  const [proofOrder, setProofOrder] = useState<InvoiceSummary | null>(null)
  const [cancelOrder, setCancelOrder] = useState<InvoiceSummary | null>(null)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (page = 1) => {
      setLoading(true)
      const params = new URLSearchParams({
        source: 'store',
        with_items: '1',
        page: String(page),
        per_page: '6',
      })
      if (status !== 'all') params.set('order_status', status)
      if (term.trim()) params.set('term', term.trim())
      try {
        const res = await api<InvoicesPage>(`/my-invoices?${params.toString()}`)
        setOrders(res.data)
        setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
        if (res.totals) setTotals(res.totals)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    },
    [status, term],
  )

  useEffect(() => {
    load()
  }, [load])

  // Debounce de la búsqueda por término
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(1), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [term, load])

  useRefetchOnFocus(() => load(meta.current_page))

  async function download(id: number, number: string) {
    try {
      const blob = await apiBlob(`/invoices/${id}/invoice-pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }

  async function submitProof(order: InvoiceSummary, form: Pick<ProofPayload, 'reference' | 'payment_method'> & { proof: File }) {
    const fd = new FormData()
    fd.append('proof', form.proof)
    fd.append('reference', form.reference)
    fd.append('payment_method', form.payment_method)
    try {
      await api(`/invoices/${order.id}/proof`, { method: 'POST', body: fd })
      setProofOrder(null)
      load(meta.current_page)
    } catch (e) {
      throw new Error(e instanceof ApiError ? e.message : 'No se pudo subir el comprobante')
    }
  }

  async function cancelNow(order: InvoiceSummary) {
    setCancelling(order.id)
    try {
      await api(`/invoices/${order.id}/cancel`, { method: 'POST' })
      setCancelOrder(null)
      load(meta.current_page)
    } catch {
      /* ignore */
    } finally {
      setCancelling(null)
    }
  }

  /** Re-agrega los ítems del pedido al carrito (manteniendo color/variante) y va al checkout. */
  async function repurchase(order: InvoiceSummary) {
    const ids = Array.from(
      new Set(
        (order.items ?? [])
          .map((i) => i.product_id)
          .filter((x): x is number => typeof x === 'number' && x > 0),
      ),
    )
    if (ids.length === 0) {
      toast.error('Este pedido no tiene productos recomprables')
      return
    }
    try {
      const params = new URLSearchParams({ ids: ids.join(','), per_page: '100' })
      const res = await api<Paginated<Product>>(`/products?${params.toString()}`)
      const byId = new Map(res.data.map((p) => [p.id, p]))
      let added = 0
      for (const it of order.items ?? []) {
        if (!it.product_id) continue
        const p = byId.get(it.product_id)
        if (!p) continue
        const variant = it.variant ? p.variants?.find((v) => v.name === it.variant) : undefined
        add(
          {
            productId: p.id,
            name: p.name,
            price: p.final_price ?? p.price,
            unit: p.unit || 'unidad',
            available: p.available,
            variant,
            image: p.image,
            brand: p.brand,
          },
          it.quantity,
        )
        added++
      }
      if (added > 0) {
        navigate('/panel/carrito')
      } else {
        toast.error('Ninguno de los productos está disponible en la tienda')
      }
    } catch {
      toast.error('No se pudo cargar los productos')
    }
  }

  const empty = !loading && orders.length === 0

  if (loading && orders.length === 0 && meta.current_page === 1) {
    return (
      <div className="mx-auto max-w-6xl p-4">
        <div className="space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-carbon-200 bg-white dark:bg-carbon-100 dark:border-carbon-200">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex items-center gap-4 px-4 py-5 ${i > 0 ? 'border-t border-carbon-100 dark:border-carbon-200' : ''}`}>
                <div className="h-4 w-32 animate-pulse rounded bg-carbon-100 dark:bg-carbon-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-carbon-100 dark:bg-carbon-200" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-carbon-100 dark:bg-carbon-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Mis Pedidos"
        subtitle="Repuestos y accesorios que has comprado en la tienda, con su seguimiento y factura."
        action={
          <Link to="/panel/tienda" className="btn-primary !text-sm">
            <ShoppingCart className="h-4 w-4" />
            Seguir comprando
          </Link>
        }
      />

      {/* Stat Cards con datos reales del backend */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total pedidos" value={totals.orders} sub="Todas tus compras" gradient="from-violet-500 to-purple-600" icon={<ShoppingBag className="h-5 w-5" />} />
        <StatCard label="Total gastado" value={fmt(totals.total_spent)} sub="En la tienda" gradient="from-emerald-500 to-green-600" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Este mes" value={totals.this_month} sub="Compras recientes" gradient="from-sky-500 to-blue-600" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Por pagar" value={totals.outstanding} sub="Abonos pendientes" gradient="from-orange-500 to-amber-600" icon={<TriangleAlert className="h-5 w-5" />} />
      </div>

      {empty ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag className="h-10 w-10" />}
            title={term.trim() || status !== 'all' ? 'No hay pedidos que coincidan' : 'Aún no has hecho compras'}
            subtitle={term.trim() || status !== 'all' ? 'Prueba con otro término o quita el filtro.' : 'Cuando compres repuestos o accesorios en la tienda, aparecerán aquí como pedidos.'}
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Toolbar searchValue={term} onSearch={setTerm} searchPlaceholder="Buscar por N° de factura…">
              <div className="flex flex-wrap items-center gap-1.5">
                {ORDER_FILTERS.map((s) => (
                  <FilterPill key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>
                    {s.label}
                  </FilterPill>
                ))}
              </div>
            </Toolbar>
          </div>

          <OrdersTable
            orders={orders}
            onDetail={setDetail}
            onProof={setProofOrder}
          />

          <div className="mt-6">
            <Pagination
              page={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              onChange={(p) => load(p)}
            />
          </div>
        </>
      )}

      {/* Detalle del pedido */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Pedido ${detail.invoice_number}` : ''}
        subtitle={detail ? `Realizado el ${detail.issue_date ? new Date(detail.issue_date).toLocaleDateString('es-CO') : '—'} · ${ORDER_META[detail.order_status as string]?.label ?? detail.order_status}` : ''}
        size="lg"
        footer={
          detail && (
            <>
              <button onClick={() => setDetail(null)} className="btn-ghost !text-sm">Cerrar</button>
              <button onClick={() => download(detail.id, detail.invoice_number)} className="btn-primary !text-sm">
                Descargar PDF
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            {/* Resumen superior */}
            <div className={`flex items-center gap-4 rounded-xl border border-carbon-200 bg-gradient-to-br ${(ORDER_META[detail.order_status ?? 'pending'] ?? ORDER_META.pending).ring} p-4 text-white`}>
              {detail.thumbnail ? (
                <img src={detail.thumbnail} alt={`Pedido ${detail.id}`} className="h-16 w-16 rounded-xl object-cover shadow-md" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20"><Package className="h-7 w-7" /></span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/80">{detail.items_count ? `${detail.items_count} producto${detail.items_count === 1 ? '' : 's'}` : 'Pedido de tienda'}</p>
                <p className="text-2xl font-black">{fmt(detail.total)}</p>
                <p className="flex items-center gap-1.5 text-xs text-white/90">
                  <span className="capitalize">{detail.payment_method?.replace(/_/g, ' ')}</span>
                  {' · '}
                  {detail.paid_amount != null && detail.paid_amount > 0 ? `Pagado: ${fmt(detail.paid_amount)}` : statusMeta[detail.status]?.label}
                </p>
              </div>
            </div>

            {/* Seguimiento del pedido */}
            <OrderTrack status={ORDER_META[detail.order_status as string]?.label ?? 'Pedido'} />

            {/* Comprobante y acciones */}
            {(detail.order_status === 'pending' || detail.order_status === 'payment_review') && (
              <div className="rounded-xl border border-carbon-200 bg-white p-4 dark:border-carbon-200 dark:bg-carbon-100">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-carbon-400">
                  <Truck className="h-3.5 w-3.5" /> Comprobante de pago
                </p>
                {detail.payment_method === 'transferencia' && (
                  <div className="mt-3">
                    <PaymentInfoBlock />
                  </div>
                )}
                {detail.payment_proof_url ? (
                  <a
                    href={detail.payment_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver comprobante enviado
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-carbon-500">{ORDER_META[detail.order_status as string]?.hint}</p>
                )}
                <div className={detail.payment_proof_url ? 'mt-2 flex gap-2' : 'mt-2 block'}>
                  <button
                    onClick={() => repurchase(detail)}
                    className="flex-1 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 active:scale-[0.98]"
                    title="Agrega los productos al carrito para pagar como compra nueva"
                  >
                    Pagar ahora
                  </button>
                  <button
                    onClick={() => setProofOrder(detail)}
                    className="flex-1 rounded-xl border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-600 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white"
                  >
                    {detail.payment_proof_url ? 'Reenviar comprobante' : 'Subir comprobante'}
                  </button>
                  {canCancel(detail) && (
                    <button
                      onClick={() => setCancelOrder(detail)}
                      className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white dark:border-rose-500/30"
                    >
                      Cancelar pedido
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ítems */}
            {(detail.items ?? []).length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-carbon-200 dark:border-carbon-200">
                <div className="divide-y divide-carbon-100 dark:divide-carbon-200">
                  {detail.items!.map((i, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-3">
                      {i.image ? (
                        <img src={i.image} alt={i.description || 'Producto'} className="h-12 w-12 shrink-0 rounded-lg border border-carbon-100 object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-carbon-100 text-carbon-400 dark:bg-carbon-200"><Package className="h-5 w-5" /></span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-carbon-800 dark:text-carbon-600">{i.description}</p>
                        {i.variant && (
                          <span className="inline-flex items-center gap-1 text-xs text-carbon-500">Color: <b>{i.variant}</b></span>
                        )}
                        <p className="text-xs text-carbon-400">x{i.quantity} · {fmt(i.unit_price)} c/u</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-carbon-900 dark:text-carbon-600">{fmt(i.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-carbon-500">Sin productos detallados.</p>
            )}

            {/* Totales */}
            <div className="rounded-xl border border-carbon-200 bg-white p-4 text-sm dark:border-carbon-200 dark:bg-carbon-100">
              <div className="flex justify-between text-carbon-500">
                <span>Subtotal</span>
                <span>{fmt(detail.subtotal)}</span>
              </div>
              {detail.discount > 0 && (
                <div className="mt-1 flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Descuento</span>
                  <span>-{fmt(detail.discount)}</span>
                </div>
              )}
              {detail.tax > 0 && (
                <div className="mt-1 flex justify-between text-carbon-500">
                  <span>Impuestos</span>
                  <span>{fmt(detail.tax)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-carbon-200 pt-2 dark:border-carbon-300">
                <span className="font-bold text-carbon-900 dark:text-carbon-600">Total</span>
                <span className="text-lg font-black text-carbon-900 dark:text-carbon-600">{fmt(detail.total)}</span>
              </div>
              {typeof detail.outstanding === 'number' && detail.outstanding > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                  <span className="font-semibold">Saldo pendiente</span>
                  <span className="font-bold">{fmt(detail.outstanding)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: subir comprobante */}
      <ProofUploadModal
        order={proofOrder}
        onClose={() => setProofOrder(null)}
        onSubmit={submitProof}
      />

      {/* Modal: confirmar cancelación */}
      <Modal
        open={!!cancelOrder}
        onClose={() => setCancelOrder(null)}
        title="¿Cancelar pedido?"
        subtitle={cancelOrder ? `Se cancelará el pedido ${cancelOrder.invoice_number} y se liberará el stock reservado.` : ''}
        footer={
          cancelOrder && (
            <>
              <button onClick={() => setCancelOrder(null)} className="btn-ghost !text-sm">Volver</button>
              <button
                onClick={() => cancelNow(cancelOrder)}
                disabled={cancelling === cancelOrder.id}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling === cancelOrder.id ? 'Cancelando…' : 'Sí, cancelar pedido'}
              </button>
            </>
          )
        }
      >
        <p className="text-sm text-carbon-600 dark:text-carbon-400">
          Solo puedes cancelar un pedido que aún no ha sido pagado. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  )
}

function OrdersTable({
  orders,
  onDetail,
  onProof,
}: {
  orders: InvoiceSummary[]
  onDetail: (o: InvoiceSummary) => void
  onProof: (o: InvoiceSummary) => void
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-carbon-100 bg-carbon-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-carbon-400 dark:border-carbon-200 dark:bg-carbon-200/30">
              <th className="px-4 py-3">Pedido</th>
              <th className="hidden px-4 py-3 sm:table-cell">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-carbon-100 dark:divide-carbon-200">
            {orders.map((o) => (
              <TableRow key={o.id} order={o} onDetail={onDetail} onProof={onProof} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TableRow({
  order: o,
  onDetail,
  onProof,
}: {
  order: InvoiceSummary
  onDetail: (o: InvoiceSummary) => void
  onProof: (o: InvoiceSummary) => void
}) {
  const om = ORDER_META[o.order_status ?? 'pending'] ?? ORDER_META.pending
  const first = o.items && o.items.length > 0 ? o.items[0].description : null
  const count = o.items_count ?? o.items?.length ?? 0
  const date = o.issue_date ? new Date(o.issue_date).toLocaleDateString('es-CO') : ''
  const outstanding = typeof o.outstanding === 'number' ? o.outstanding : 0
  const needsProof = o.order_status === 'pending' || o.order_status === 'payment_review'

  return (
    <tr
      className="group cursor-pointer transition hover:bg-brand-50/40 dark:hover:bg-brand-500/5"
      onClick={() => onDetail(o)}
    >
      <td className="px-4 py-3.5">
        <p className="font-mono text-sm font-bold text-carbon-900 transition group-hover:text-brand-600 dark:text-carbon-600">
          {o.invoice_number}
        </p>
        <p className="mt-0.5 max-w-[220px] truncate text-xs text-carbon-500">
          {first || 'Pedido de la tienda'}
          {count > 1 ? ` +${count - 1} más` : ''}
        </p>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3.5 text-carbon-500 sm:table-cell">{date || '—'}</td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${om.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${om.dot}`} />
          {om.label}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right">
        <p className="font-bold text-carbon-900 dark:text-carbon-600">{fmt(o.total)}</p>
        {outstanding > 0 && <p className="text-[11px] font-semibold text-rose-600">falta {fmt(outstanding)}</p>}
      </td>
      <td className="px-4 py-3.5 text-right">
        {needsProof ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onProof(o)
            }}
            className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 active:scale-[0.98]"
          >
            Pagar
          </button>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-carbon-400 transition group-hover:text-brand-600">
            Ver <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </td>
    </tr>
  )
}

function ProofUploadModal({ order, onClose, onSubmit }: {
  order: InvoiceSummary | null
  onClose: () => void
  onSubmit: (o: InvoiceSummary, form: ProofPayload & { proof: File }) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('transferencia')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!order || !file) return
    setSending(true)
    setError(null)
    try {
      await onSubmit(order, { proof: file, reference: reference.trim(), payment_method: method })
      setFile(null)
      setReference('')
      setMethod('transferencia')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hubo un problema al subir el comprobante')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={order ? `Pagar pedido ${order.invoice_number}` : ''}
      subtitle="Paso 1: elige el medio y realiza la transferencia. Paso 2: adjunta el comprobante para que lo verifiquemos."
      size="md"
      footer={
        order && (
          <>
            <button onClick={onClose} disabled={sending} className="btn-ghost !text-sm">Cancelar</button>
            <button
              onClick={handleSubmit}
              disabled={!file || sending}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-40"
            >
              {sending ? 'Enviando…' : 'Enviar comprobante'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Total a pagar */}
        {order && (
          <div className="flex items-center justify-between rounded-xl bg-carbon-900 px-4 py-3 text-white dark:bg-carbon-700">
            <span className="text-sm font-semibold text-white/80">Total a pagar</span>
            <span className="text-xl font-black">{fmt(order.total)}</span>
          </div>
        )}

        {/* Paso 1: dónde pagar */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-600">Paso 1 · Realiza el pago</p>
          {method === 'transferencia' && <PaymentInfoBlock />}
        </div>

        {/* Paso 2: adjuntar comprobante */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-600">Paso 2 · Adjunta tu comprobante</p>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              file
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-carbon-300 bg-carbon-50/50 hover:border-brand-400 hover:bg-brand-50 dark:border-carbon-200 dark:bg-carbon-200/40 dark:hover:bg-brand-500/10'
            }`}
          >
            <Upload className="h-6 w-6" />
            <p className="text-sm font-semibold text-carbon-700 dark:text-carbon-400">
              {file ? file.name : 'Toca para elegir el comprobante'}
            </p>
            <p className="text-[11px] text-carbon-400">JPG, PNG o PDF · máx. 8 MB</p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-carbon-400">Medio de pago</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-xl border border-carbon-200 bg-white px-3 py-2.5 text-sm text-carbon-800 outline-none focus:border-brand-500 dark:border-carbon-200 dark:bg-carbon-900 dark:text-carbon-600"
            >
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-carbon-400">N° de soporte / referencia</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-xl border border-carbon-200 bg-white px-3 py-2.5 text-sm text-carbon-800 outline-none focus:border-brand-500 dark:border-carbon-200 dark:bg-carbon-900 dark:text-carbon-600"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function OrderTrack({ status }: { status: string | undefined }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
        <TriangleAlert className="h-4 w-4" />
        Este pedido fue cancelado y el stock quedó liberado.
      </div>
    )
  }

  const steps = [
    { key: 'pending', label: 'Pedido' },
    { key: 'payment_review', label: 'Comprobante' },
    { key: 'confirmed', label: 'Confirmado' },
    { key: 'shipped', label: 'Enviado' },
    { key: 'delivered', label: 'Entregado' },
  ]
  const idx = steps.findIndex((s) => s.key === status)
  const current = idx < 0 ? 0 : idx

  return (
    <div className="rounded-xl border border-carbon-200 bg-white p-4 dark:border-carbon-200 dark:bg-carbon-100">
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i < current + 1
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition ${
                    done
                      ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm'
                      : 'bg-carbon-100 text-carbon-400 dark:bg-carbon-200'
                  }`}
                >
                  {done && i < current ? '✓' : i + 1}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 rounded-full ${i < current ? 'bg-brand-500' : 'bg-carbon-100 dark:bg-carbon-200'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center">
        {steps.map((s) => (
          <p key={s.key} className={`text-[10px] font-semibold ${steps.findIndex((x) => x.key === s.key) <= current ? 'text-carbon-800 dark:text-carbon-600' : 'text-carbon-400'}`}>
            {s.label}
          </p>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, gradient, icon }: {
  label: string
  value: React.ReactNode
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
        <div className="min-w-0">
          <p className="text-xs font-medium text-carbon-500">{label}</p>
          <p className="truncate text-2xl font-bold text-carbon-900 dark:text-carbon-700">{value}</p>
          <p className="text-[11px] text-carbon-400">{sub}</p>
        </div>
      </div>
    </div>
  )
}