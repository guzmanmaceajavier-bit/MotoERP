import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Download, Plus, Banknote, CreditCard, ArrowLeftRight, Search, Package, Trash2, Minus, CheckCircle2, Receipt, Pencil } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { fmtMoney } from '../../lib/money'
import { Badge, SectionHeader } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select } from '../../components/ui/form'
import { useToast } from '../../lib/toast'
import { gradientFor } from '../../lib/gradients'

interface SaleInvoice {
  id: number
  invoice_number: string
  customer: string
  order_number?: string | null
  subtotal: number
  discount: number
  total: number
  paid_amount: number
  outstanding: number
  cost: number
  profit: number
  payment_method: string
  status: string
  issue_date: string
}

interface PosProduct {
  id: number
  name: string
  price: number
  promo_price: number | null
  final_price?: number
  image?: string
  unit: string
  quantity: number
  reserved: number
}

interface PosClient {
  id: number
  name: string
  email: string | null
  phone: string | null
}

interface CartLine {
  productId: number
  name: string
  unit: string
  unitPrice: number
  qty: number
}

const methodLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  cash: 'Efectivo',
  mixed: 'Mixto',
}

const orderMeta: Record<string, { label: string; pill: string }> = {
  pending: { label: 'Pendiente de pago', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  payment_review: { label: 'Comprobante en revisión', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  confirmed: { label: 'Confirmado', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  shipped: { label: 'Enviado', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  delivered: { label: 'Entregado', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  cancelled: { label: 'Cancelado', pill: 'bg-carbon-100 text-carbon-500 dark:bg-carbon-200 dark:text-carbon-400' },
}

const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['payment_review', 'confirmed', 'cancelled'],
  payment_review: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'delivered'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

interface ShopOrder {
  id: number
  invoice_number: string
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  total: number
  paid_amount: number
  payment_method: string
  status: string
  order_status?: string
  payment_proof_url?: string | null
  invoice_pdf_url?: string | null
  issue_date?: string
  items_count?: number
  items?: { description: string; quantity: number; unit_price: number; total: number }[]
}

function usePendingFilterCount() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    api<{ data: ShopOrder[]; meta: { total: number } }>('/staff/shop-orders?per_page=1&pending_only=1')
      .then((res) => setCount(res.meta.total))
      .catch(() => {})
  }, [])
  return count
}

function ShopOrdersPanel({ initialFilter = '' }: { initialFilter?: string }) {
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [filter, setFilter] = useState(initialFilter)
  const [search, setSearch] = useState('')
  const [statusOrder, setStatusOrder] = useState<ShopOrder | null>(null)
  const [newStatus, setNewStatus] = useState('confirmed')
  const [savingStatus, setSavingStatus] = useState(false)
  const [pdfOrder, setPdfOrder] = useState<ShopOrder | null>(null)
  const [statusError, setStatusError] = useState('')

  const load = useCallback(
    async (page = 1, f = filter, s = search) => {
      const params = new URLSearchParams({ page: String(page), per_page: '10' })
      if (f) params.set('order_status', f)
      if (s.trim()) params.set('search', s.trim())
      try {
        const res = await api<{ data: ShopOrder[]; meta: { current_page: number; last_page: number; total: number } }>(
          `/staff/shop-orders?${params.toString()}`,
        )
        setOrders(res.data)
        setMeta(res.meta)
      } catch {
        /* ignore */
      }
    },
    [filter, search],
  )

  useEffect(() => {
    void load(1)
  }, [load])

  async function changeStatus(to: string) {
    if (!statusOrder) return
    setSavingStatus(true)
    setStatusError('')
    try {
      await api(`/staff/invoices/${statusOrder.id}/order-status`, {
        method: 'PATCH',
        body: JSON.stringify({ order_status: to }),
      })
      setStatusOrder(null)
      load(meta.current_page)
    } catch (e: any) {
      setStatusError(e?.message || 'No se pudo actualizar el estado.')
    } finally {
      setSavingStatus(false)
    }
  }

  const pendingCounts = usePendingFilterCount()

  async function uploadPdf(file: File) {
    if (!pdfOrder) return
    setSavingStatus(true)
    setStatusError('')
    try {
      const fd = new FormData()
      fd.append('invoice_pdf', file)
      await api(`/staff/invoices/${pdfOrder.id}/invoice-pdf`, { method: 'POST', body: fd })
      setPdfOrder(null)
      load(meta.current_page)
    } catch (e: any) {
      setStatusError(e?.message || 'No se pudo subir el PDF.')
    } finally {
      setSavingStatus(false)
    }
  }

  const pills = [
    { key: '', label: 'Todos' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'payment_review', label: 'En revisión' },
    { key: 'confirmed', label: 'Confirmados' },
    { key: 'shipped', label: 'Enviados' },
    { key: 'delivered', label: 'Entregados' },
    { key: 'cancelled', label: 'Cancelados' },
  ]

  const ordersColumns: Column<ShopOrder>[] = [
    {
      key: 'order',
      header: 'Pedido',
      render: (o) => (
        <div className="min-w-0">
          <p className="font-bold text-carbon-950">{o.invoice_number}</p>
          <p className="text-xs text-carbon-500">{o.customer_name || 'Cliente web'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (o) => (
        <span className="text-sm text-carbon-600">
          {o.issue_date ? new Date(o.issue_date).toLocaleDateString('es-CO') : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (o) => <Badge tone={orderMeta[o.order_status ?? '']?.pill.includes('rose') ? 'red' : o.order_status === 'confirmed' ? 'green' : o.order_status === 'shipped' ? 'blue' : o.order_status === 'delivered' ? 'green' : o.order_status === 'payment_review' ? 'amber' : 'gray'}>{orderMeta[o.order_status ?? 'pending']?.label ?? o.order_status}</Badge>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (o) => (
        <span className="font-bold text-carbon-950">{fmtMoney(o.total)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (o) => (
        <div className="flex items-center justify-end gap-1.5">
          {o.payment_proof_url && (
            <a
              href={o.payment_proof_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-600 transition hover:bg-amber-50"
              title="Ver comprobante"
            >
              <Eye className="h-[15px] w-[15px]" />
            </a>
          )}
          <button
            onClick={() => { setStatusOrder(o); setNewStatus('') }}
            disabled={ORDER_TRANSITIONS[o.order_status ?? '']?.length === 0}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Avanzar
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <Toolbar searchValue={search} onSearch={setSearch} searchPlaceholder="Buscar por N° o cliente…" searchVariant="brand">
        {pills.map((p) => (
          <button
            key={p.key}
            onClick={() => { setFilter(p.key); load(1, p.key, search) }}
            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === p.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-brand-300 bg-white text-carbon-900 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:border-brand-500/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </Toolbar>

      {pendingCounts > 0 && (
        <p className="mb-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
          Hay {pendingCounts} {pendingCounts === 1 ? 'pedido' : 'pedidos'} esperando atención.
        </p>
      )}

      <DataTable
        columns={ordersColumns}
        rows={orders}
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        onPage={load}
        emptyText="Sin pedidos de tienda por aquí."
        minWidth="min-w-[820px]"
        variant="brand"
      />

      <Modal open={!!statusOrder} onClose={() => setStatusOrder(null)} title="Cambiar estado del pedido"
        subtitle={statusOrder ? `Pedido ${statusOrder.invoice_number} · estado actual: ${orderMeta[statusOrder.order_status ?? 'pending']?.label}` : ''}
        variant="brand"
        footer={
          statusOrder && (
            <>
              <button onClick={() => setStatusOrder(null)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">Cancelar</button>
              <button
                onClick={() => { if (newStatus) changeStatus(newStatus) }}
                disabled={!newStatus || savingStatus}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {savingStatus ? 'Guardando…' : 'Guardar estado'}
              </button>
            </>
          )
        }
      >
        {statusError && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">{statusError}</div>
        )}
        <Field label="Nuevo estado" variant="brand">
          <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} variant="brand">
            {(ORDER_TRANSITIONS[statusOrder?.order_status ?? ''] ?? []).map((s) => (
              <option key={s} value={s}>{orderMeta[s]?.label || s}</option>
            ))}
          </Select>
        </Field>
        <p className="mt-3 text-xs text-carbon-400">
          Al pasar a Confirmado se consumirá el stock reservado. Al cancelar se liberará la reserva.
        </p>
      </Modal>

      <Modal open={!!pdfOrder} onClose={() => setPdfOrder(null)} title="Subir PDF de la factura"
        subtitle={pdfOrder ? `El cliente podrá descargarlo desde Mis Pedidos (${pdfOrder.invoice_number}).` : ''}
        variant="brand"
        footer={
          pdfOrder && (
            <>
              <button onClick={() => setPdfOrder(null)} disabled={savingStatus} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">Cancelar</button>
              <button
                onClick={() => { const f = (document.getElementById('inv-pdf-input') as HTMLInputElement)?.files?.[0]; if (f) uploadPdf(f) }}
                disabled={savingStatus}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {savingStatus ? 'Subiendo…' : 'Subir PDF'}
              </button>
            </>
          )
        }
      >
        {statusError && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">{statusError}</div>
        )}
        <input id="inv-pdf-input" type="file" accept="application/pdf" className="block w-full text-sm text-carbon-600 dark:text-carbon-400" />
      </Modal>
    </div>
  )
}

function NewSaleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast().toast
  const [step, setStep] = useState<'client' | 'products' | 'review'>('client')
  const [clientQuery, setClientQuery] = useState('')
  const [clients, setClients] = useState<PosClient[]>([])
  const [selectedClient, setSelectedClient] = useState<PosClient | null>(null)
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' })

  const [productQuery, setProductQuery] = useState('')
  const [products, setProducts] = useState<PosProduct[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState('efectivo')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clientQuery.trim()) {
      setClients([])
      return
    }
    const t = setTimeout(() => {
      api<PosClient[]>(`/staff/sales/clients?q=${encodeURIComponent(clientQuery.trim())}`)
        .then(setClients)
        .catch(() => setClients([]))
    }, 300)
    return () => clearTimeout(t)
  }, [clientQuery])

  useEffect(() => {
    if (!productQuery.trim()) {
      setProducts([])
      return
    }
    const t = setTimeout(() => {
      setSearchingProducts(true)
      api<{ data: PosProduct[] }>(`/staff/catalog/products?q=${encodeURIComponent(productQuery.trim())}`)
        .then((res) => setProducts(res.data.filter((p) => p.quantity - p.reserved > 0)))
        .catch(() => setProducts([]))
        .finally(() => setSearchingProducts(false))
    }, 300)
    return () => clearTimeout(t)
  }, [productQuery])

  const available = (p: PosProduct) => p.quantity - p.reserved

  function addToCart(p: PosProduct) {
    const price = p.final_price ?? Number(p.price)
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        const max = available(p)
        if (existing.qty >= max) return prev
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, unitPrice: price, qty: 1 }]
    })
    setProductQuery('')
    setProducts([])
  }

  const cartTotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const discountedTotal = Math.max(0, cartTotal - (discount || 0))

  async function registerSale() {
    if (!selectedClient && !newClient.name.trim()) {
      setError('Debes seleccionar o crear un cliente.')
      return
    }
    if (cart.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/staff/sales', {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClient?.id || null,
          client_name: selectedClient ? null : newClient.name,
          client_email: selectedClient ? null : newClient.email || null,
          client_phone: selectedClient ? null : newClient.phone || null,
          items: cart.map((l) => ({ product_id: l.productId, quantity: l.qty })),
          payment_method: method,
          discount: discount || 0,
          notes: notes.trim() || null,
        }),
      })
      toast.success('Venta registrada correctamente')
      onDone()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar la venta.')
    } finally {
      setSaving(false)
    }
  }

  const stepLabel = ['Cliente', 'Productos', 'Pago']
  const stepIndex = ['client', 'products', 'review'].indexOf(step)

  const methods: { key: string; label: string; icon: typeof Banknote }[] = [
    { key: 'efectivo', label: 'Efectivo', icon: Banknote },
    { key: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { key: 'transferencia', label: 'Transferencia', icon: ArrowLeftRight },
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva venta"
      subtitle="Registra una venta directa de repuestos."
      size="lg"
      variant="brand"
      footer={
        <>
          {step === 'client' && (
            <button
              onClick={() => {
                if (!selectedClient && !newClient.name.trim()) {
                  setError('Indica el cliente.')
                  return
                }
                setError('')
                setStep('products')
              }}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Continuar →
            </button>
          )}
          {step === 'products' && (
            <button
              onClick={() => setStep('review')}
              disabled={cart.length === 0}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              Continuar al pago → ({fmtMoney(cartTotal)})
            </button>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('products')} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
                ← Volver
              </button>
              <button onClick={registerSale} disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Registrando…' : 'Cobrar y registrar'}
              </button>
            </>
          )}
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-5 flex items-center gap-2">
        {stepLabel.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => {
                if (i < stepIndex || (i === 2 && cart.length > 0)) setStep(['client', 'products', 'review'][i] as typeof step)
              }}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition ${
                i === stepIndex ? 'bg-brand-600 text-white' : i < stepIndex ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-carbon-100 text-carbon-400 dark:bg-carbon-200'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-black ${i === stepIndex ? 'bg-white/25' : i < stepIndex ? 'bg-brand-600 text-white' : 'bg-white text-carbon-400'}`}>
                {i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < stepLabel.length - 1 && <div className={`h-px flex-1 ${i < stepIndex ? 'bg-brand-300' : 'bg-carbon-200'}`} />}
          </div>
        ))}
      </div>

      {step === 'client' && (
        <div>
          {selectedClient ? (
            <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${gradientFor(selectedClient.name)}`}>
                {selectedClient.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-carbon-950">{selectedClient.name}</p>
                <p className="truncate text-xs text-carbon-500">
                  {[selectedClient.email, selectedClient.phone].filter(Boolean).join(' · ') || 'Sin contacto'}
                </p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Field label="Buscar cliente" hint="Nombre, email o teléfono" variant="brand">
                <Input value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} placeholder="Buscar cliente existente…" variant="brand" />
              </Field>
              {clients.length > 0 && (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-brand-200 bg-white dark:border-carbon-300">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50/60 dark:hover:bg-carbon-50/40"
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white ${gradientFor(c.name)}`}>
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-carbon-900 dark:text-carbon-700">{c.name}</span>
                      <span className="text-xs text-carbon-500">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="my-4 flex items-center gap-3 text-xs text-carbon-400">
                <span className="h-px flex-1 bg-carbon-200 dark:bg-carbon-300" /> o crea uno nuevo
                <span className="h-px flex-1 bg-carbon-200 dark:bg-carbon-300" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre completo" error={newClient.name ? undefined : undefined} variant="brand">
                  <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Cliente nuevo" variant="brand" />
                </Field>
                <Field label="Teléfono" variant="brand">
                  <Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="3012345678" variant="brand" />
                </Field>
                <Field label="Email" variant="brand">
                  <Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="cliente@mail.com" variant="brand" />
                </Field>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'products' && (
        <div>
          <Field label="Agregar producto" hint="Busca por nombre y agrégalo al carrito" variant="brand">
            <Input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Buscar producto…" variant="brand" />
          </Field>
          {searchingProducts && <p className="mt-2 text-sm text-carbon-400">Buscando…</p>}
          {products.length > 0 && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-brand-200 bg-white dark:border-carbon-300">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-brand-50/60 dark:hover:bg-brand-500/10"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-carbon-900 dark:text-carbon-700">{p.name}</div>
                    <div className="text-xs text-carbon-500">{available(p)} disponibles · {p.unit}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-semibold text-brand-600">{fmtMoney(p.final_price ?? Number(p.price))}</span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">+</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-brand-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-[11px] uppercase tracking-widest text-carbon-950">
                <tr>
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5">P. Unit.</th>
                  <th className="px-4 py-2.5 text-center">Cant.</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.productId} className="border-t border-brand-100">
                    <td className="px-4 py-2.5 font-medium text-carbon-900 dark:text-carbon-700">{l.name}</td>
                    <td className="px-4 py-2.5 text-carbon-600 dark:text-carbon-500">{fmtMoney(l.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="inline-flex items-center rounded-lg border border-brand-200">
                        <button onClick={() => setCart((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))} className="px-2 py-1 text-carbon-600 hover:bg-brand-50" aria-label="Disminuir"><Minus className="h-3 w-3" /></button>
                        <span className="w-8 text-center font-semibold text-carbon-900 dark:text-carbon-700">{l.qty}</span>
                        <button onClick={() => setCart((prev) => prev.map((x) => (x.productId === l.productId ? { ...x, qty: x.qty + 1 } : x)))} className="px-2 py-1 text-carbon-600 hover:bg-brand-50" aria-label="Aumentar">+</button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-carbon-900 dark:text-carbon-700">{fmtMoney(l.unitPrice * l.qty)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setCart((prev) => prev.filter((x) => x.productId !== l.productId))} className="text-red-500 hover:text-red-700" aria-label="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-carbon-400">
                      Agrega productos a la venta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-1.5 text-lg font-bold text-carbon-900 dark:text-carbon-700">
            Subtotal: <span className="text-brand-600">{fmtMoney(cartTotal)}</span>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-carbon-50 p-4 dark:bg-carbon-50/40">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${gradientFor(selectedClient?.name || newClient.name || 'cliente')}`}>
              {(selectedClient?.name || newClient.name || 'C').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-carbon-500">Cliente</div>
              <div className="truncate font-semibold text-carbon-900 dark:text-carbon-700">
                {selectedClient?.name || newClient.name}
              </div>
            </div>
            <div className="ml-auto text-right text-xs text-carbon-500">{cart.length} {cart.length === 1 ? 'producto' : 'productos'}</div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Descuento (monto)" variant="brand">
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} placeholder="0" variant="brand" />
            </Field>
            <Field label="Notas" variant="brand">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional…" variant="brand" />
            </Field>
          </div>

          <Field label="Método de pago" variant="brand">
            <div className="grid grid-cols-3 gap-2">
              {methods.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition ${
                    method === m.key ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-carbon-300 text-carbon-600 hover:border-brand-400 hover:text-brand-600 dark:border-carbon-300'
                  }`}
                >
                  <m.icon className="h-5 w-5" />
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="rounded-2xl border-2 border-brand-200 bg-white p-4 dark:border-brand-500/40 dark:bg-carbon-100">
            <div className="flex justify-between text-sm text-carbon-600 dark:text-carbon-500">
              <span>Subtotal</span>
              <span>{fmtMoney(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-carbon-600 dark:text-carbon-500">
              <span>Descuento</span>
              <span>-{fmtMoney(discount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-brand-100 pt-2 text-xl font-extrabold text-carbon-950 dark:border-brand-500/30 dark:text-carbon-700">
              <span>Total a cobrar</span>
              <span className="text-brand-600">{fmtMoney(discountedTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Sales() {
  const [searchParams] = useSearchParams()
  const toast = useToast().toast
  const [tab, setTab] = useState<'invoices' | 'orders'>(() => (searchParams.get('tab') === 'orders' ? 'orders' : 'invoices'))
  const [invoices, setInvoices] = useState<SaleInvoice[]>([])
  const [total, setTotal] = useState(0)
  const [profit, setProfit] = useState(0)
  const [cost, setCost] = useState(0)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [method, setMethod] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [editSale, setEditSale] = useState<SaleInvoice | null>(null)
  const [editForm, setEditForm] = useState({ payment_method: '', status: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [toDelete, setToDelete] = useState<SaleInvoice | null>(null)
  const [deleting, setDeleting] = useState(false)

  const invoiceParams = useCallback(
    (targetPage?: number) => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (method) params.set('payment_method', method)
      if (targetPage) params.set('page', String(targetPage))
      return params
    },
    [from, to, method],
  )

  async function load(targetPage = 1) {
    const data = await api<{
      total: number
      count: number
      cost: number
      profit: number
      data: SaleInvoice[]
      meta: { current_page: number; last_page: number; total: number }
    }>(`/staff/sales?${invoiceParams(targetPage).toString()}`)
    setInvoices(data.data)
    setTotal(data.total)
    setCost(data.cost ?? 0)
    setProfit(data.profit ?? 0)
    setCount(data.count)
    setPage(data.meta.current_page)
    setLastPage(data.meta.last_page)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [invoiceParams])

  const fmt = fmtMoney

  async function downloadPdf(inv: SaleInvoice) {
    setDownloading(inv.id)
    try {
      const token = localStorage.getItem('staff_token')
      const res = await fetch(`/api/v1/staff/sales/${inv.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al descargar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `factura-${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el PDF.')
    } finally {
      setDownloading(null)
    }
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const all: SaleInvoice[] = []
      let p = 1
      let last = 1
      do {
        const params = new URLSearchParams(invoiceParams().toString())
        params.set('per_page', '50')
        params.set('page', String(p))
        const res = await api<{ data: SaleInvoice[]; meta: { last_page: number } }>(`/staff/sales?${params.toString()}`)
        all.push(...res.data)
        last = res.meta.last_page
        p++
      } while (p <= last && p < 200)

      if (all.length === 0) {
        toast.error('No hay ventas para exportar con los filtros actuales')
        return
      }
      const head = ['Nº factura', 'Cliente', 'Nº orden', 'Fecha', 'Método', 'Subtotal', 'Descuento', 'Total', 'Pagado', 'Costo', 'Ganancia']
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const lines = [
        head.join(';'),
        ...all.map((i) =>
          [i.invoice_number, i.customer, i.order_number ?? '', i.issue_date, methodLabel[i.payment_method] ?? i.payment_method, i.subtotal, i.discount, i.total, i.paid_amount, i.cost, i.profit]
            .map(esc)
            .join(';'),
        ),
      ]
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Excel descargado con ${all.length} venta(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  function openEdit(inv: SaleInvoice) {
    setEditSale(inv)
    setEditForm({ payment_method: inv.payment_method, status: inv.outstanding > 0 ? 'partial' : inv.status })
    setEditError('')
    setEditSaving(false)
  }

  async function saveEdit() {
    if (!editSale) return
    setEditSaving(true)
    setEditError('')
    try {
      const body: Record<string, unknown> = {}
      if (editForm.payment_method) body.payment_method = editForm.payment_method
      if (editForm.status) body.status = editForm.status
      await api(`/staff/sales/${editSale.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      toast.success('Venta actualizada')
      setEditSale(null)
      await load(page)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar la venta')
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/staff/sales/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Venta anulada y stock devuelto')
      setToDelete(null)
      const newPage = invoices.length === 1 && page > 1 ? page - 1 : page
      await load(newPage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular la venta')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<SaleInvoice>[] = [
    {
      key: 'invoice',
      header: 'Nº factura',
      render: (inv) => <span className="font-mono text-sm font-bold text-carbon-950">{inv.invoice_number}</span>,
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (inv) => (
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white ${gradientFor(inv.customer)}`}>
            {inv.customer.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-carbon-800 dark:text-carbon-600">{inv.customer}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Fecha',
      render: (inv) => (
        <span className="text-sm text-carbon-600">
          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('es-CO') : '—'}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Método',
      render: (inv) => <Badge tone="gray">{methodLabel[inv.payment_method] || inv.payment_method}</Badge>,
    },
    {
      key: 'order',
      header: 'Orden',
      render: (inv) => <span className="text-xs text-carbon-500">{inv.order_number ?? '—'}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (inv) => <span className="font-bold text-carbon-950">{fmt(inv.total)}</span>,
    },
    {
      key: 'paid',
      header: 'Pago',
      align: 'center',
      render: (inv) =>
        inv.outstanding > 0 ? (
          <Badge tone="red">Debe {fmt(inv.outstanding)}</Badge>
        ) : (
          <Badge tone="green">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />Pagado
          </Badge>
        ),
    },
    {
      key: 'profit',
      header: 'Ganancia',
      align: 'right',
      render: (inv) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(inv.profit)}</span>,
    },
    {
      key: 'pdf',
      header: 'PDF',
      align: 'right',
      render: (inv) => (
        <button
          onClick={() => downloadPdf(inv)}
          disabled={downloading === inv.id}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
          title="Descargar PDF"
        >
          <Download className="h-[15px] w-[15px]" />
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEdit(inv)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700"
            title="Editar venta"
          >
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button
            onClick={() => setToDelete(inv)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
            title="Anular venta (devuelve stock)"
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      ),
    },
  ]

  const kpis: { label: string; value: string; icon: typeof Receipt; accent: string }[] = [
    { label: 'Facturas', value: String(count ?? 0), icon: Receipt, accent: 'from-brand-500 to-brand-700' },
    { label: 'Total', value: fmt(total), icon: Banknote, accent: 'from-emerald-500 to-emerald-700' },
    { label: 'Costo repuestos', value: fmt(cost), icon: Package, accent: 'from-indigo-500 to-indigo-700' },
    { label: 'Ganancia', value: fmt(profit), icon: CheckCircle2, accent: 'from-amber-500 to-orange-600' },
  ]

  const tabs = [
    { key: 'invoices' as const, label: 'Facturas', icon: Receipt },
    { key: 'orders' as const, label: 'Pedidos de tienda', icon: Package },
  ]

  return (
    <div className="mx-auto max-w-7xl anim-fade-up">
      <SectionHeader
        title="Ventas"
        subtitle="Facturas emitidas y pedidos de la tienda online."
        variant="brand"
        action={
          tab === 'invoices' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={exportExcel}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exportando…' : 'Descargar Excel'}
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]"
              >
                <Plus className="h-4 w-4" />
                Nueva venta
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-white p-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${k.accent} text-white`}>
              <k.icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-extrabold text-carbon-950">{k.value}</p>
              <p className="text-sm text-carbon-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-brand-300 bg-white text-carbon-900 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {showNew && <NewSaleModal onClose={() => setShowNew(false)} onDone={() => load().catch(() => {})} />}

      {tab === 'orders' ? (
        <ShopOrdersPanel initialFilter={searchParams.get('review') === '1' ? 'payment_review' : ''} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-brand-200 bg-white p-4">
            <Field label="Desde" variant="brand">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} variant="brand" />
            </Field>
            <Field label="Hasta" variant="brand">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} variant="brand" />
            </Field>
            <Field label="Método de pago" variant="brand">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} variant="brand">
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </Select>
            </Field>
            <button onClick={() => load().catch(() => {})} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Search className="h-4 w-4" />
              Filtrar
            </button>
          </div>

          <DataTable
            columns={columns}
            rows={invoices}
            page={page}
            lastPage={lastPage}
            total={count}
            onPage={(p) => load(p).catch(() => {})}
            minWidth="min-w-[1020px]"
            emptyText="Sin facturas en el rango seleccionado."
            variant="brand"
          />
        </>
      )}

      <Modal
        open={!!editSale}
        onClose={() => setEditSale(null)}
        title={`Editar venta ${editSale?.invoice_number ?? ''}`}
        subtitle="Actualiza el método de pago o el estado de cobro."
        variant="brand"
        footer={
          <>
            <button onClick={() => setEditSale(null)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={editSaving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {editSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        {editError && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{editError}</div>}
        <div className="space-y-4">
          <div className="rounded-xl bg-brand-50/50 px-4 py-3 text-sm text-carbon-700">
            <span className="font-semibold text-carbon-950">{editSale?.customer}</span> · {editSale ? fmtMoney(editSale.total) : ''}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Método de pago" variant="brand">
              <Select value={editForm.payment_method} onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })} variant="brand">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </Select>
            </Field>
            <Field label="Estado de cobro" variant="brand">
              <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} variant="brand">
                <option value="paid">Pagada</option>
                <option value="partial">Parcial</option>
                <option value="pending">Pendiente</option>
              </Select>
            </Field>
          </div>
          <p className="text-xs text-carbon-400">
            {editForm.status === 'paid' ? 'Se registrará como totalmente cobrada.' : editForm.status === 'partial' ? 'Quedará registrada con un abono pendiente.' : 'Quedará registrada como deuda del cliente.'}
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Anular venta"
        message={`¿Seguro que quieres anular la venta "${toDelete?.invoice_number}"? Se devolverá el stock al inventario y se eliminará la factura.`}
        loading={deleting}
      />
    </div>
  )
}