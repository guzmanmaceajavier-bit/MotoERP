import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Plus, Download, Search } from 'lucide-react'
import { apiStaff as api, getStaffToken } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { SectionHeader, Badge, EmptyState } from '../../components/ui'
import { Field, Input, Select, Textarea } from '../../components/ui/form'
import { Modal } from '../../components/ui/modal'
import { useStaffAuth } from '../../auth/StaffAuthContext'
import type { Paginated } from '../../lib/pagination'

interface WarrantyRow {
  id: number
  description: string
  type: string
  duration: number
  start_date?: string
  end_date?: string
  status: string
  is_active: boolean
  work_order?: { id: number; order_number: string; service_type?: string } | null
  product?: { id: number; name: string } | null
}

interface OrderOption {
  id: number
  order_number: string
  customer?: { id: number; name: string } | null
  motorcycle?: { plate: string } | null
}

interface ProductOption {
  id: number
  name: string
}

const statusTone: Record<string, 'green' | 'gray' | 'red' | 'blue'> = {
  active: 'green',
  expired: 'red',
  inactive: 'gray',
}

const typeLabel: Record<string, string> = {
  days: 'días',
  months: 'meses',
  km: 'km',
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('es-CO') : '—')

export default function Warranties() {
  const { user } = useStaffAuth()
  const isAdmin = user?.role === 'admin'
  const toast = useToast().toast
  const [rows, setRows] = useState<WarrantyRow[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [orders, setOrders] = useState<OrderOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    work_order_id: '',
    product_id: '',
    description: '',
    type: 'months',
    duration: '3',
    start_date: new Date().toISOString().slice(0, 10),
  })

  async function load(page = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await api<Paginated<WarrantyRow>>(`/staff/warranties?${params}`)
      setRows(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        api<{ data: OrderOption[] }>('/staff/orders?per_page=200').catch(() => ({ data: [] })),
        api<{ data: ProductOption[] }>('/staff/catalog/products').catch(() => ({ data: [] })),
      ])
      setOrders(o.data)
      setProducts(p.data)
    } catch {
      /* silencioso */
    }
  }, [])

  useEffect(() => {
    load(1)
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(1), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  function openNew() {
    setForm({
      work_order_id: '',
      product_id: '',
      description: '',
      type: 'months',
      duration: '3',
      start_date: new Date().toISOString().slice(0, 10),
    })
    setShowForm(true)
  }

  async function submit() {
    if (!form.description.trim()) {
      toast('La descripción es obligatoria', 'error')
      return
    }
    if (!form.work_order_id && !form.product_id) {
      toast('Selecciona una orden o un producto', 'error')
      return
    }
    setSaving(true)
    try {
      await api('/staff/warranties', {
        method: 'POST',
        body: JSON.stringify({
          work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
          product_id: form.product_id ? Number(form.product_id) : null,
          description: form.description.trim(),
          type: form.type,
          duration: Number(form.duration),
          start_date: form.start_date,
        }),
      })
      toast('Garantía creada')
      setShowForm(false)
      await load(1)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function downloadPdf(id: number) {
    const token = getStaffToken()
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

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        variant="brand"
        title="Garantías"
        subtitle="Garantías activas de servicios y productos para clientes."
        action={
          isAdmin ? (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Nueva garantía
            </button>
          ) : undefined
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción, orden, cliente o producto..."
            className="pl-9"
            variant="brand"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} variant="brand" className="w-40">
          <option value="">Todas</option>
          <option value="active">Activas</option>
          <option value="expired">Vencidas</option>
          <option value="inactive">Inactivas</option>
        </Select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-carbon-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-carbon-200 bg-carbon-50/60 text-carbon-500">
            <tr>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Cliente / Vehículo</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const origin = w.work_order
                ? `Orden ${w.work_order.order_number}${w.work_order.service_type ? ` · ${w.work_order.service_type}` : ''}`
                : w.product
                  ? `Producto: ${w.product.name}`
                  : 'Sin origen'
              return (
                <tr key={w.id} className="border-b border-carbon-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-carbon-900">{w.description}</td>
                  <td className="px-4 py-3 text-carbon-600">{origin}</td>
                  <td className="px-4 py-3 text-carbon-600">
                    {w.duration} {typeLabel[w.type] ?? w.type}
                  </td>
                  <td className="px-4 py-3 text-carbon-600">{fmtDate(w.start_date)}</td>
                  <td className="px-4 py-3 text-carbon-600">{w.type === 'km' ? '—' : fmtDate(w.end_date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[w.status] ?? 'gray'}>
                      {w.status === 'active' ? 'Activa' : w.status === 'expired' ? 'Vencida' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => downloadPdf(w.id)}
                      className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-brand-50 hover:text-brand-700"
                      title="Descargar PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10">
                  <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="Sin garantías" subtitle="Crea una garantía desde el botón «Nueva garantía»." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.last_page > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            disabled={meta.current_page <= 1}
            onClick={() => load(meta.current_page - 1)}
            className="rounded-lg border border-carbon-300 px-3 py-1.5 text-sm text-carbon-700 hover:bg-carbon-100 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-carbon-500">
            {meta.current_page} / {meta.last_page}
          </span>
          <button
            disabled={meta.current_page >= meta.last_page}
            onClick={() => load(meta.current_page + 1)}
            className="rounded-lg border border-carbon-300 px-3 py-1.5 text-sm text-carbon-700 hover:bg-carbon-100 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nueva garantía"
        subtitle="Registra la cobertura de un servicio o producto."
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-ghost !text-sm">Cancelar</button>
            <button
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Crear garantía'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Orden de trabajo" hint="opcional">
              <Select value={form.work_order_id} onChange={(e) => setForm((f) => ({ ...f, work_order_id: e.target.value, product_id: '' }))} variant="brand">
                <option value="">— Sin orden —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} {o.customer ? `· ${o.customer.name}` : ''} {o.motorcycle?.plate ? `· ${o.motorcycle.plate}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Producto" hint="opcional">
              <Select value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value, work_order_id: '' }))} variant="brand">
                <option value="">— Sin producto —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descripción">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              variant="brand"
              placeholder="Ej: Garantía de 3 meses por reparación de motor"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Tipo">
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} variant="brand">
                <option value="months">Meses</option>
                <option value="days">Días</option>
                <option value="km">Kilómetros</option>
              </Select>
            </Field>
            <Field label="Duración">
              <Input type="number" min={1} value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} variant="brand" />
            </Field>
            <Field label="Inicio">
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} variant="brand" />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
