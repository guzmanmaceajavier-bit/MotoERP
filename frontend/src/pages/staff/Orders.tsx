import { useCallback, useEffect, useState } from 'react'
import {
  Bike,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  Plus,
  User as UserIcon,
  Wallet,
  Wrench,
} from 'lucide-react'
import { apiStaff as api, getStaffToken } from '../../lib/api'
import { useStaffAuth } from '../../auth/StaffAuthContext'
import { useToast } from '../../lib/toast'
import type { Paginated } from '../../lib/pagination'
import type { StaffOrder, StaffUser } from '../../lib/types'
import { useRefetchOnFocus } from '../../lib/useRefetch'
import { RowSkeleton } from '../../components/Skeletons'
import { Badge, SectionHeader, EmptyState } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar, FilterPill } from '../../components/ui/toolbar'
import { Modal } from '../../components/ui/modal'
import { Field, Input, Select, FormRow } from '../../components/ui/form'
import { fmtMoney } from '../../lib/money'

const STATUS_META: Record<string, { label: string; badge: string; dot: string; border: string }> = {
  pending: { label: 'Pendiente', badge: 'bg-rose-500 text-white', dot: 'bg-rose-500', border: 'border-l-rose-500' },
  assigned: { label: 'Asignada', badge: 'bg-sky-500 text-white', dot: 'bg-sky-500', border: 'border-l-sky-500' },
  in_progress: { label: 'En taller', badge: 'bg-amber-500 text-white', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  awaiting_approval: { label: 'Por aprobar', badge: 'bg-violet-500 text-white', dot: 'bg-violet-500', border: 'border-l-violet-500' },
  approved: { label: 'Aprobada', badge: 'bg-emerald-500 text-white', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  completed: { label: 'Completada', badge: 'bg-green-500 text-white', dot: 'bg-green-500', border: 'border-l-green-500' },
  delivered: { label: 'Entregada', badge: 'bg-teal-500 text-white', dot: 'bg-teal-500', border: 'border-l-teal-500' },
  cancelled: { label: 'Cancelada', badge: 'bg-carbon-400 text-white', dot: 'bg-carbon-400', border: 'border-l-carbon-400' },
}

const QUOTATION_META: Record<string, { label: string; badge: string }> = {
  draft: { label: 'Sin cotizar', badge: 'bg-carbon-100 text-carbon-600' },
  pending: { label: 'Cotización pendiente', badge: 'bg-brand-100 text-brand-700' },
  awaiting_approval: { label: 'En revisión', badge: 'bg-amber-100 text-amber-700' },
  revision_requested: { label: 'Requiere cambios', badge: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Aprobada', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', badge: 'bg-red-100 text-red-700' },
}

interface QuoteForm {
  diagnosis: string
  items: { description: string; quantity: number; unit_price: number }[]
  labors: { description: string; hours: number; hourly_rate: number }[]
  estimated_delivery: string
}

const fmtDate = (d?: string): string => {
  if (!d) return '—'
  const parsed = new Date(d)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('es-CO')
}

const FILTERS = [
  { value: '', label: 'Todas', key: 'all' },
  { value: 'in_progress', label: 'En taller', key: 'in_progress' },
  { value: 'awaiting_approval', label: 'Por aprobar', key: 'awaiting_approval' },
  { value: 'completed', label: 'Completadas', key: 'completed' },
  { value: 'delivered', label: 'Entregadas', key: 'delivered' },
]

export default function Orders() {
  const { user } = useStaffAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'
  const isReception = user?.role === 'receptionist'
  const isMechanic = user?.role === 'mechanic'

  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [detail, setDetail] = useState<StaffOrder | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ user_id: '', motorcycle_id: '', service_id: '', service_type: '', odometer_in: '' })
  const [services, setServices] = useState<{ id: number; name: string; price: number }[]>([])
  const [customService, setCustomService] = useState(false)
  const [clientQuery, setClientQuery] = useState('')

  useEffect(() => {
    if (!showCreate) return
    ;(async () => {
      try {
        const res = await api<{ id: number; name: string; price: number }[]>('/staff/services')
        setServices(res)
      } catch {
        setServices([])
      }
    })()
  }, [showCreate])
  const [clientOptions, setClientOptions] = useState<{ id: number; name: string; email?: string }[]>([])
  const [clientLoading, setClientLoading] = useState(false)
  const [clientMotos, setClientMotos] = useState<{ id: number; label: string }[]>([])

  useEffect(() => {
    if (!clientQuery) {
      setClientOptions([])
      return
    }
    const t = setTimeout(async () => {
      setClientLoading(true)
      try {
        const res = await api<Paginated<{ id: number; name: string; email: string; motorcycles_count: number }>>(
          `/staff/clients?search=${encodeURIComponent(clientQuery)}&per_page=10`,
        )
        setClientOptions(res.data.map((c) => ({ id: c.id, name: c.name, email: c.email })))
      } catch {
        setClientOptions([])
      } finally {
        setClientLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [clientQuery])

  async function pickClient(id: number) {
    setCreateForm((f) => ({ ...f, user_id: String(id), motorcycle_id: '' }))
    setClientMotos([])
    try {
      const res = await api<Paginated<{ id: number; nickname?: string; plate: string; brand?: { name?: string } }>>(
        `/staff/motorcycles?user_id=${id}&per_page=50`,
      )
      setClientMotos(res.data.map((m) => ({ id: m.id, label: `${m.nickname || m.plate}${m.brand?.name ? ` · ${m.brand.name}` : ''}` })))
    } catch {
      setClientMotos([])
    }
  }

  const [quotes, setQuotes] = useState<Record<number, QuoteForm>>({})

  const emptyQuote = (): QuoteForm => ({
    diagnosis: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }],
    labors: [{ description: '', hours: 1, hourly_rate: 0 }],
    estimated_delivery: '',
  })

  const quoteFor = (orderId: number): QuoteForm => quotes[orderId] ?? emptyQuote()
  const setQuoteFor = (orderId: number, updater: (q: QuoteForm) => QuoteForm) =>
    setQuotes((qs) => ({ ...qs, [orderId]: updater(qs[orderId] ?? emptyQuote()) }))

  const load = useCallback(async (targetPage = page, st = statusFilter, q = debouncedSearch) => {
    try {
      const params = new URLSearchParams()
      if (st) params.set('status', st)
      if (q) params.set('search', q)
      params.set('page', String(targetPage))
      const data = await api<Paginated<StaffOrder>>(`/staff/orders?${params.toString()}`)
      setOrders(data.data)
      setPage(data.meta.current_page)
      setLastPage(data.meta.last_page)
      setTotalOrders(data.meta.total)
      setCounts(data.meta.counts ?? {})
      if (isAdmin) {
        const staffRes = await api<Paginated<StaffUser>>('/staff/staff?per_page=50')
        setStaff(staffRes.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, page, statusFilter, debouncedSearch])

  useEffect(() => {
    load(1)
  }, [load])

  useRefetchOnFocus(() => load(page))

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (debouncedSearch) load(1, statusFilter, debouncedSearch)
    else if (!searchQuery) load(page, statusFilter, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  async function createOrder(e: React.FormEvent) {
    e.preventDefault()
    await api('/staff/orders', {
      method: 'POST',
      body: JSON.stringify(
        createForm.user_id || createForm.motorcycle_id
          ? {
              user_id: createForm.user_id ? Number(createForm.user_id) : null,
              motorcycle_id: createForm.motorcycle_id ? Number(createForm.motorcycle_id) : null,
              service_id: createForm.service_id ? Number(createForm.service_id) : null,
              service_type: customService ? createForm.service_type || null : undefined,
              odometer_in: createForm.odometer_in ? Number(createForm.odometer_in) : null,
            }
          : {
              service_id: createForm.service_id ? Number(createForm.service_id) : null,
              service_type: customService ? createForm.service_type || 'Revisión general' : undefined,
            },
      ),
    })
    setShowCreate(false)
    setCreateForm({ user_id: '', motorcycle_id: '', service_id: '', service_type: '', odometer_in: '' })
    setCustomService(false)
    setClientQuery('')
    setClientOptions([])
    setClientMotos([])
    setInvoiceMsg('')
    await load(page)
  }

  async function assign(orderId: number, mechanicId: number) {
    await api(`/staff/orders/${orderId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ mechanic_id: mechanicId }),
    })
    await load(page)
  }

  async function startOrder(orderId: number) {
    await api(`/staff/orders/${orderId}/start`, { method: 'POST' })
    await load(page)
  }

  async function submitQuote(orderId: number) {
    await api(`/staff/orders/${orderId}/quotation`, {
      method: 'POST',
      body: JSON.stringify(quoteFor(orderId)),
    })
    await load(page)
  }

  async function changeStatus(orderId: number, status: string) {
    await api(`/staff/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    await load(page)
  }

  async function refreshDetail() {
    try {
      const data = await api<Paginated<StaffOrder>>('/staff/orders?per_page=50&page=1')
      const fresh = data.data.find((o) => o.id === detail?.id)
      if (fresh) setDetail(fresh)
      toast.success('Datos actualizados')
    } catch {
      toast.error('No se pudo actualizar')
    }
    await load(page)
  }

  const [invoiceMsg, setInvoiceMsg] = useState('')
  const [pointsMap, setPointsMap] = useState<Record<number, number | string>>({})
  const [invoiceById, setInvoiceById] = useState<Record<number, string>>({})
  const [invoiceDetails, setInvoiceDetails] = useState<Record<number, { points_used: number }>>({})
  const [invoicePayment, setInvoicePayment] = useState<Record<number, string>>({})
  const [invoiceAmount, setInvoiceAmount] = useState<Record<number, string>>({})
  const [photoOrder, setPhotoOrder] = useState<number | null>(null)
  const [photoDrafts, setPhotoDrafts] = useState<Record<number, { caption: string; type: string; file: File | null }>>({})
  const [photosMap, setPhotosMap] = useState<Record<number, { id: number; caption?: string; type: string; url: string }[]>>({})

  const photoDraftFor = (orderId: number) => photoDrafts[orderId] ?? { caption: '', type: 'general', file: null }
  const setPhotoDraftFor = (orderId: number, updater: (d: { caption: string; type: string; file: File | null }) => { caption: string; type: string; file: File | null }) =>
    setPhotoDrafts((d) => ({ ...d, [orderId]: updater(photoDraftFor(orderId)) }))

  async function uploadPhoto(orderId: number) {
    const draft = photoDraftFor(orderId)
    if (!draft.file) return
    const fd = new FormData()
    fd.append('photo', draft.file)
    if (draft.caption) fd.append('caption', draft.caption)
    fd.append('type', draft.type)
    const token = getStaffToken()
    const res = await fetch(`/api/v1/staff/orders/${orderId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setInvoiceMsg(body.message || 'Error al subir foto')
      return
    }
    const photo = await res.json()
    setPhotosMap((p) => ({ ...p, [orderId]: [...(p[orderId] || []), photo] }))
    setPhotoDraftFor(orderId, (d) => ({ ...d, caption: '', file: null }))
  }

  async function loadPhotos(orderId: number) {
    try {
      const list = await api<{ id: number; caption?: string; type: string; url: string }[]>(`/orders/${orderId}/photos`)
      setPhotosMap((p) => ({ ...p, [orderId]: list }))
    } catch {
      /* ignore */
    }
  }

  async function generateInvoice(orderId: number) {
    setInvoiceMsg('')
    try {
      const inv = await api<{ invoice_number: string; points_used: number }>(`/staff/orders/${orderId}/invoice`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: invoicePayment[orderId] ?? 'efectivo',
          points_to_use: Number(pointsMap[orderId]) || 0,
          amount_paid: invoiceAmount[orderId] !== undefined && invoiceAmount[orderId] !== '' ? Number(invoiceAmount[orderId]) : undefined,
        }),
      })
      setInvoiceById((p) => ({ ...p, [orderId]: inv.invoice_number }))
      setInvoiceDetails((p) => ({ ...p, [orderId]: { points_used: inv.points_used ?? 0 } }))
      setInvoiceMsg(`Factura ${inv.invoice_number} generada`)
      await load(page)
    } catch (err) {
      setInvoiceMsg(err instanceof Error ? err.message : 'Error al facturar')
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-6xl animate-pulse p-4">
        <RowSkeleton cols={5} rows={6} />
      </div>
    )
  if (error) return <div className="p-4 text-red-600">{error}</div>

  const mechanics = staff.filter((s) => s.role === 'mechanic')

  const columns: Column<StaffOrder>[] = [
    {
      key: 'order',
      header: 'Orden',
      render: (o) => (
        <button
          onClick={() => setDetail(o)}
          className="block text-left font-mono text-sm font-bold text-carbon-900 transition hover:text-brand-600"
        >
          {o.order_number}
          <span className="mt-0.5 block font-sans text-[11px] font-medium text-carbon-400">{fmtDate(o.created_at)}</span>
        </button>
      ),
    },
    {
      key: 'client',
      header: 'Cliente / Moto',
      render: (o) => (
        <div>
          <p className="text-sm font-bold text-carbon-950">{o.customer?.name ?? 'Sin cliente'}</p>
          <p className="text-xs text-carbon-500">
            {o.motorcycle ? `${o.motorcycle.plate || o.motorcycle.nickname || 'Moto'}${o.motorcycle.brand ? ` · ${o.motorcycle.brand}` : ''}` : 'Sin moto'}
          </p>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Servicio',
      className: 'hidden sm:table-cell',
      headerClass: 'hidden sm:table-cell',
      render: (o) => <span className="text-sm font-semibold text-carbon-900">{o.service_type || '—'}</span>,
    },
    {
      key: 'mechanic',
      header: 'Mecánico',
      className: 'hidden md:table-cell',
      headerClass: 'hidden md:table-cell',
      render: (o) => <span className="text-sm font-semibold text-carbon-900">{o.mechanic?.name ?? '—'}</span>,
    },
    {
      key: 'delivery',
      header: 'Entrega',
      className: 'hidden md:table-cell',
      headerClass: 'hidden md:table-cell',
      render: (o) => <span className="text-sm font-medium text-carbon-600">{fmtDate(o.estimated_delivery)}</span>,
    },
    {
      key: 'quotation',
      header: 'Cotización',
      align: 'right',
      className: 'hidden lg:table-cell',
      headerClass: 'hidden lg:table-cell',
      render: (o) =>
        typeof o.quotation_total === 'number' && o.quotation_total > 0 ? (
          <span className="text-sm font-black text-carbon-950">{fmtMoney(o.quotation_total)}</span>
        ) : (
          <Badge tone={QUOTATION_META[o.quotation_status]?.badge ? 'gray' : 'gray'} className={QUOTATION_META[o.quotation_status]?.badge ?? ''}>
            {QUOTATION_META[o.quotation_status]?.label ?? '—'}
          </Badge>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (o) => {
        const st = STATUS_META[o.status] ?? STATUS_META.pending
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full bg-white/80`} />
            {st.label}
          </span>
        )
      },
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (o) => (
        <button
          onClick={() => setDetail(o)}
          aria-label={`Ver ${o.order_number}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-300 text-brand-700 transition hover:border-brand-500 hover:bg-brand-500 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Órdenes de trabajo"
        subtitle={isMechanic ? 'Órdenes asignadas para diagnosticar y cotizar.' : 'Gestiona clientes, motos y el flujo del taller.'}
        variant="brand"
        action={
          (isAdmin || isReception) && (
            <button onClick={() => setShowCreate(true)} className="btn-primary !text-sm">
              <Plus className="h-4 w-4" />
              Nueva orden
            </button>
          )
        }
      />

      {invoiceMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
          <span>{invoiceMsg}</span>
          <button onClick={() => setInvoiceMsg('')} className="ml-auto rounded p-0.5 text-emerald-500 hover:bg-emerald-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <Toolbar
        searchValue={searchQuery}
        onSearch={setSearchQuery}
        searchPlaceholder="Buscar placa, orden o cliente…"
        searchVariant="brand"
      >
        {FILTERS.map((f) => {
          const meta = STATUS_META[f.value]
          const n = counts[f.key] ?? 0
          const active = statusFilter === f.value
          return (
            <FilterPill
              key={f.value}
              active={active}
              variant="brand"
              onClick={() => {
                setStatusFilter(f.value)
                load(1, f.value, debouncedSearch)
              }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta ? meta.dot : 'bg-brand-600'}`} />
              {f.label}
              <span
                className={`ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 ${
                  active ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'
                }`}
              >
                {n}
              </span>
            </FilterPill>
          )
        })}
      </Toolbar>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No hay órdenes"
          subtitle="Crea una nueva orden o cambia los filtros de búsqueda."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={orders}
          page={page}
          lastPage={lastPage}
          total={totalOrders}
          onPage={(p) => load(p)}
          minWidth="min-w-[720px]"
          variant="brand"
          headerClassName="!font-black !text-carbon-950"
          rowClassName={(o) => `${STATUS_META[o.status]?.border ?? 'border-l-brand-400'} cursor-pointer`}
          emptyText="No hay órdenes."
        />
      )}

      {/* Modal: crear orden */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nueva orden de trabajo"
        subtitle="Registra el cliente, la moto y el servicio para abrir la orden."
        size="lg"
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="btn-ghost !text-sm">Cancelar</button>
            <button type="submit" form="create-order-form" className="btn-primary !text-sm">
              <Plus className="h-4 w-4" />
              Crear orden
            </button>
          </>
        }
      >
        <form id="create-order-form" onSubmit={createOrder} className="space-y-4">
          <FormRow>
            <Field label="Cliente" variant="brand">
              <div className="relative">
                <input
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Buscar por nombre, email o teléfono…"
                  className="w-full rounded-xl border border-brand-300 bg-white px-3.5 py-2.5 text-sm text-carbon-950 placeholder:text-carbon-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition"
                />
                {clientQuery && clientOptions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-brand-200 bg-white shadow-xl">
                    {clientOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            pickClient(c.id)
                            setClientQuery(`${c.name}${c.email ? ` (${c.email})` : ''}`)
                            setClientOptions([])
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-carbon-900 hover:bg-brand-50"
                        >
                          {c.name}
                          {c.email && <span className="text-carbon-400"> · {c.email}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {clientLoading && <div className="mt-1 text-xs text-carbon-400">Buscando…</div>}
              </div>
            </Field>
            <Field label="Motocicleta" hint={!createForm.user_id ? '(opcional)' : undefined} variant="brand">
              <Select
                value={createForm.motorcycle_id}
                onChange={(e) => setCreateForm({ ...createForm, motorcycle_id: e.target.value })}
                disabled={!createForm.user_id}
                variant="brand"
              >
                <option value="">{createForm.user_id ? 'Selecciona la moto…' : 'Primero selecciona el cliente'}</option>
                {clientMotos.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Servicio" variant="brand">
              <Select
                value={createForm.service_id}
                onChange={(e) => {
                  const id = e.target.value
                  setCreateForm({ ...createForm, service_id: id })
                  setCustomService(id === '__other')
                }}
                variant="brand"
              >
                <option value="">Selecciona un servicio…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.price ? ` · ${fmtMoney(s.price)}` : ''}</option>
                ))}
                <option value="__other">Otro / servicio personalizado</option>
              </Select>
            </Field>
            <Field label="Servicio personalizado" variant="brand">
              <Input
                value={createForm.service_type}
                onChange={(e) => setCreateForm({ ...createForm, service_type: e.target.value })}
                placeholder={customService ? 'Escribe el servicio' : 'Solo si eliges "Otro" arriba'}
                disabled={!customService}
                variant="brand"
              />
            </Field>
            <Field label="Odómetro (km)" variant="brand">
              <Input
                value={createForm.odometer_in}
                onChange={(e) => setCreateForm({ ...createForm, odometer_in: e.target.value })}
                placeholder="0"
                variant="brand"
              />
            </Field>
          </FormRow>
          {customService && (
            <p className="text-xs text-brand-600">Se abrirá la orden con el servicio personalizado que escribiste.</p>
          )}
        </form>
      </Modal>

      {/* Modal: detalle de la orden */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `Orden ${detail.order_number}` : ''}
        subtitle={detail ? `Creada el ${fmtDate(detail.created_at)}` : ''}
        size="lg"
        variant="brand"
        footer={
          detail && (
            <>
              <button onClick={() => setDetail(null)} className="btn-ghost !text-sm">Cerrar</button>
              <button onClick={() => void refreshDetail()} className="btn-primary !text-sm">
                Actualizar datos
              </button>
            </>
          )
        }
      >
        {detail && (
          <OrderDetail
            order={detail}
            isAdmin={isAdmin}
            isMechanic={isMechanic}
            isReception={isReception}
            user={user}
            mechanics={mechanics}
            invoiceMsg={invoiceMsg}
            pointsMap={pointsMap}
            invoiceById={invoiceById}
            invoiceDetails={invoiceDetails}
            invoicePayment={invoicePayment}
            invoiceAmount={invoiceAmount}
            photoOrder={photoOrder}
            photosMap={photosMap}
            photoDraftFor={photoDraftFor}
            quoteFor={quoteFor}
            setQuoteFor={setQuoteFor}
            setPhotoOrder={setPhotoOrder}
            loadPhotos={loadPhotos}
            setInvoiceMsg={setInvoiceMsg}
            setPointsMap={setPointsMap}
            setInvoicePayment={setInvoicePayment}
            setInvoiceAmount={setInvoiceAmount}
            setPhotoDraftFor={setPhotoDraftFor}
            uploadPhoto={uploadPhoto}
            assign={assign}
            startOrder={startOrder}
            submitQuote={submitQuote}
            changeStatus={changeStatus}
            generateInvoice={generateInvoice}
          />
        )}
      </Modal>
    </div>
  )
}

function InfoItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-white p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">{label}</p>
        <p className="truncate text-sm font-bold text-carbon-950">{children || '—'}</p>
      </div>
    </div>
  )
}

function OrderDetail(props: {
  order: StaffOrder
  isAdmin: boolean
  isMechanic: boolean
  isReception: boolean
  user: { id: number; role: string } | null
  mechanics: StaffUser[]
  invoiceMsg: string
  pointsMap: Record<number, number | string>
  invoiceById: Record<number, string>
  invoiceDetails: Record<number, { points_used: number }>
  invoicePayment: Record<number, string>
  invoiceAmount: Record<number, string>
  photoOrder: number | null
  photosMap: Record<number, { id: number; caption?: string; type: string; url: string }[]>
  photoDraftFor: (orderId: number) => { caption: string; type: string; file: File | null }
  quoteFor: (orderId: number) => QuoteForm
  setQuoteFor: (orderId: number, updater: (q: QuoteForm) => QuoteForm) => void
  setPhotoOrder: React.Dispatch<React.SetStateAction<number | null>>
  loadPhotos: (orderId: number) => Promise<void>
  setInvoiceMsg: (m: string) => void
  setPointsMap: (p: Record<number, number | string>) => void
  setInvoicePayment: (p: Record<number, string>) => void
  setInvoiceAmount: (p: Record<number, string>) => void
  setPhotoDraftFor: (orderId: number, updater: (d: { caption: string; type: string; file: File | null }) => { caption: string; type: string; file: File | null }) => void
  uploadPhoto: (orderId: number) => Promise<void>
  assign: (orderId: number, mechanicId: number) => Promise<void>
  startOrder: (orderId: number) => Promise<void>
  submitQuote: (orderId: number) => Promise<void>
  changeStatus: (orderId: number, status: string) => Promise<void>
  generateInvoice: (orderId: number) => Promise<void>
}) {
  const o = props.order
  const { isAdmin, isMechanic, isReception, user, mechanics } = props
  const st = STATUS_META[o.status] ?? STATUS_META.pending
  const q = QUOTATION_META[o.quotation_status] ?? QUOTATION_META.draft
  const canAssign = isAdmin && (!o.mechanic || o.status === 'pending')
  const canQuote = (isAdmin || (isMechanic && o.mechanic?.id === user?.id)) && o.status === 'in_progress' && o.quotation_status === 'pending'

  return (
    <div className="space-y-4">
      {/* Estado + total */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-300 bg-brand-50/60 px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${st.badge}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
          {st.label}
        </span>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${q.badge}`}>{q.label}</span>
        <span className="ml-auto text-2xl font-black text-carbon-950">{fmtMoney(o.quotation_total)}</span>
      </div>

      {/* Información principal */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoItem icon={<UserIcon className="h-4 w-4" />} label="Cliente">{o.customer?.name}</InfoItem>
        <InfoItem icon={<CalendarDays className="h-4 w-4" />} label="Entrega estimada">{fmtDate(o.estimated_delivery)}</InfoItem>
        <InfoItem icon={<Bike className="h-4 w-4" />} label="Motocicleta">
          {o.motorcycle ? `${o.motorcycle.plate || o.motorcycle.nickname || 'Moto'}${o.motorcycle.brand ? ` · ${o.motorcycle.brand}` : ''}` : 'Sin moto'}
        </InfoItem>
        <InfoItem icon={<Wrench className="h-4 w-4" />} label="Servicio">{o.service_type}</InfoItem>
        <InfoItem icon={<UserIcon className="h-4 w-4" />} label="Mecánico">{o.mechanic?.name ?? 'Sin asignar'}</InfoItem>
        <InfoItem icon={<CalendarDays className="h-4 w-4" />} label="Creada">{fmtDate(o.created_at)}</InfoItem>
      </div>

      {/* Diagnóstico */}
      {o.diagnosis && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">Diagnóstico</p>
          <p className="mt-1 text-sm text-carbon-900">{o.diagnosis}</p>
        </div>
      )}

      {/* Asignación + inicio */}
      {canAssign && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <Select
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) void props.assign(o.id, id)
            }}
            defaultValue=""
            variant="brand"
            className="max-w-xs"
          >
            <option value="">Asignar mecánico…</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
          <button onClick={() => void props.startOrder(o.id)} className="btn-primary !text-sm">Iniciar</button>
        </div>
      )}

      {/* Diagnóstico y cotización (mecánico) */}
      {canQuote && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <h3 className="flex items-center gap-1.5 border-l-4 border-brand-500 pl-2 font-bold text-carbon-950">
            <ClipboardList className="h-4 w-4 text-brand-600" /> Diagnóstico y cotización
          </h3>
          <textarea
            value={props.quoteFor(o.id).diagnosis}
            onChange={(e) => props.setQuoteFor(o.id, (qq) => ({ ...qq, diagnosis: e.target.value }))}
            placeholder="Diagnóstico del vehículo…"
            className="mt-2 w-full rounded-xl border border-brand-300 bg-white px-3.5 py-2.5 text-sm text-carbon-950 placeholder:text-carbon-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
            rows={2}
          />
          <input
            type="date"
            value={props.quoteFor(o.id).estimated_delivery}
            onChange={(e) => props.setQuoteFor(o.id, (qq) => ({ ...qq, estimated_delivery: e.target.value }))}
            className="mt-2 max-w-xs rounded-xl border border-brand-300 bg-white px-3.5 py-2.5 text-sm text-carbon-950 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
          />
          <div className="mt-3 text-sm font-bold text-carbon-950">Repuestos</div>
          {props.quoteFor(o.id).items.map((it, idx) => (
            <div key={idx} className="mt-2 grid grid-cols-3 gap-2">
              <Input
                value={it.description}
                onChange={(e) => {
                  const items = [...props.quoteFor(o.id).items]
                  items[idx] = { ...it, description: e.target.value }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, items }))
                }}
                placeholder="Descripción"
                variant="brand"
              />
              <Input
                type="number"
                value={it.quantity}
                onChange={(e) => {
                  const items = [...props.quoteFor(o.id).items]
                  items[idx] = { ...it, quantity: Number(e.target.value) }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, items }))
                }}
                placeholder="Cant."
                variant="brand"
              />
              <Input
                type="number"
                value={it.unit_price}
                onChange={(e) => {
                  const items = [...props.quoteFor(o.id).items]
                  items[idx] = { ...it, unit_price: Number(e.target.value) }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, items }))
                }}
                placeholder="Precio"
                variant="brand"
              />
            </div>
          ))}
          <button onClick={() => props.setQuoteFor(o.id, (qq) => ({ ...qq, items: [...qq.items, { description: '', quantity: 1, unit_price: 0 }] }))} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
            + Repuesto
          </button>
          <div className="mt-3 text-sm font-bold text-carbon-950">Mano de obra</div>
          {props.quoteFor(o.id).labors.map((l, idx) => (
            <div key={idx} className="mt-2 grid grid-cols-3 gap-2">
              <Input
                value={l.description}
                onChange={(e) => {
                  const labors = [...props.quoteFor(o.id).labors]
                  labors[idx] = { ...l, description: e.target.value }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, labors }))
                }}
                placeholder="Descripción"
                variant="brand"
              />
              <Input
                type="number"
                value={l.hours}
                onChange={(e) => {
                  const labors = [...props.quoteFor(o.id).labors]
                  labors[idx] = { ...l, hours: Number(e.target.value) }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, labors }))
                }}
                placeholder="Horas"
                variant="brand"
              />
              <Input
                type="number"
                value={l.hourly_rate}
                onChange={(e) => {
                  const labors = [...props.quoteFor(o.id).labors]
                  labors[idx] = { ...l, hourly_rate: Number(e.target.value) }
                  props.setQuoteFor(o.id, (qq) => ({ ...qq, labors }))
                }}
                placeholder="Valor/hora"
                variant="brand"
              />
            </div>
          ))}
          <button onClick={() => props.setQuoteFor(o.id, (qq) => ({ ...qq, labors: [...qq.labors, { description: '', hours: 1, hourly_rate: 0 }] }))} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
            + Mano de obra
          </button>
          <div className="mt-4">
            <button onClick={() => void props.submitQuote(o.id)} className="btn-primary !text-sm">
              Enviar cotización al cliente
            </button>
          </div>
        </div>
      )}

      {/* Acciones de estado */}
      {o.quotation_status === 'approved' && o.status !== 'in_progress' && o.status !== 'completed' && o.status !== 'delivered' && o.status !== 'cancelled' && (
        <div className="flex gap-2">
          <button onClick={() => void props.changeStatus(o.id, 'in_progress')} className="btn-primary !text-sm">
            Iniciar reparación
          </button>
        </div>
      )}
      {o.status === 'in_progress' && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void props.changeStatus(o.id, 'completed')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            Completar
          </button>
          <button onClick={() => void props.changeStatus(o.id, 'cancelled')} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
            Cancelar
          </button>
        </div>
      )}
      {o.status === 'completed' && (
        <button onClick={() => void props.changeStatus(o.id, 'delivered')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
          Marcar entregado
        </button>
      )}

      {/* Facturación */}
      {(isAdmin || isReception) && o.status === 'delivered' && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <h3 className="flex items-center gap-1.5 border-l-4 border-brand-500 pl-2 font-bold text-carbon-950">
            <Wallet className="h-4 w-4 text-brand-600" /> Facturación y pago
          </h3>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Puntos a usar" variant="brand">
              <Input
                type="number"
                min={0}
                value={props.pointsMap[o.id] ?? ''}
                onChange={(e) => props.setPointsMap({ ...props.pointsMap, [o.id]: e.target.value })}
                className="w-32"
                variant="brand"
              />
            </Field>
            <Field label="Abono (si no paga todo)" variant="brand">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={props.invoiceAmount[o.id] ?? ''}
                onChange={(e) => props.setInvoiceAmount({ ...props.invoiceAmount, [o.id]: e.target.value })}
                className="w-44"
                variant="brand"
              />
            </Field>
            <button onClick={() => void props.generateInvoice(o.id)} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              Generar factura
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-carbon-900">Pago:</span>
            {[
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'tarjeta', label: 'Tarjeta' },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => props.setInvoicePayment({ ...props.invoicePayment, [o.id]: m.value })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  (props.invoicePayment[o.id] ?? 'efectivo') === m.value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-carbon-300 bg-white text-carbon-700 hover:border-brand-400 hover:text-brand-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {props.invoiceById[o.id] && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              Factura {props.invoiceById[o.id]} · {(props.invoiceDetails[o.id]?.points_used ?? 0) > 0 ? `${props.invoiceDetails[o.id]?.points_used} puntos usados` : 'sin puntos'}
            </p>
          )}
          {props.invoiceMsg && <p className="mt-2 text-sm font-medium text-emerald-700">{props.invoiceMsg}</p>}
        </div>
      )}

      {/* Fotos */}
      <div>
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 border-l-4 border-brand-500 pl-2 text-sm font-bold text-carbon-950">
            <Camera className="h-4 w-4 text-brand-600" /> Fotos
          </h4>
          {(isAdmin || isMechanic) && (
            <button
              onClick={() => {
                props.setPhotoOrder(props.photoOrder === o.id ? null : o.id)
                if (!props.photosMap[o.id]) void props.loadPhotos(o.id)
              }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                props.photoOrder === o.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-brand-300 text-brand-700 hover:bg-brand-600 hover:text-white'
              }`}
            >
              {props.photoOrder === o.id ? 'Ocultar' : 'Ver fotos'}
            </button>
          )}
        </div>
        {props.photoOrder === o.id && (
          <div className="mt-2 rounded-xl border border-brand-200 bg-white p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(props.photosMap[o.id] || []).map((p) => (
                <img key={p.id} src={p.url} alt={p.caption || 'Foto'} className="h-20 w-full rounded-lg object-cover shadow-sm" />
              ))}
            </div>
            {(isAdmin || isMechanic) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => props.setPhotoDraftFor(o.id, (d) => ({ ...d, file: e.target.files?.[0] || null }))}
                  className="text-sm"
                />
                <Input
                  value={props.photoDraftFor(o.id).caption}
                  onChange={(e) => props.setPhotoDraftFor(o.id, (d) => ({ ...d, caption: e.target.value }))}
                  placeholder="Descripción"
                  className="w-40"
                  variant="brand"
                />
                <Select
                  value={props.photoDraftFor(o.id).type}
                  onChange={(e) => props.setPhotoDraftFor(o.id, (d) => ({ ...d, type: e.target.value }))}
                  className="w-36"
                  variant="brand"
                >
                  <option value="general">General</option>
                  <option value="diagnosis">Diagnóstico</option>
                  <option value="progress">Progreso</option>
                  <option value="finish">Final</option>
                </Select>
                <button
                  onClick={() => void props.uploadPhoto(o.id)}
                  disabled={!props.photoDraftFor(o.id).file}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
                >
                  Subir
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}