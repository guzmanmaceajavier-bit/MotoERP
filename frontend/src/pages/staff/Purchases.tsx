import { useEffect, useState } from 'react'
import { Store, ShoppingCart, Truck, HandCoins, Eye, Plus, Pencil, Trash2, Search, PackageSearch, Phone } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { fmtMoney } from '../../lib/money'
import { useToast } from '../../lib/toast'
import Pagination from '../../components/Pagination'
import { Badge, SectionHeader, StatCard } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select } from '../../components/ui/form'
import type { Paginated } from '../../lib/pagination'

interface Supplier {
  id: number
  name: string
  contact?: string | null
  phone?: string | null
  email?: string | null
  purchase_count: number
  purchase_total: number
}

interface PurchaseItem {
  id?: number
  product_id?: number | null
  description: string
  quantity: number
  unit_cost: number
  total?: number
}

interface Purchase {
  id: number
  purchase_number: string
  supplier_id?: number | null
  supplier_name?: string | null
  total: number
  purchase_date: string
  item_count?: number
  items?: PurchaseItem[]
}

interface Product {
  id: number
  name: string
}

type Tab = 'purchases' | 'suppliers'

export default function Purchases() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('purchases')

  // Compras
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [purchaseMeta, setPurchaseMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [q, setQ] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number>(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Proveedores
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierMeta, setSupplierMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [supplierQ, setSupplierQ] = useState('')
  const [toEditSupplier, setToEditSupplier] = useState<Supplier | null>(null)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '', phone: '', email: '' })
  const [supplierSaving, setSupplierSaving] = useState(false)
  const [supplierError, setSupplierError] = useState('')
  const [toDeleteSupplier, setToDeleteSupplier] = useState<Supplier | null>(null)
  const [supplierDeleting, setSupplierDeleting] = useState(false)

  // Compra modal
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [viewing, setViewing] = useState<Purchase | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [purchaseForm, setPurchaseForm] = useState<{
    supplier_id: number
    purchase_date: string
    items: { id?: number; product_id: number; description: string; quantity: number; unit_cost: number }[]
  }>({
    supplier_id: 0,
    purchase_date: new Date().toISOString().slice(0, 10),
    items: [{ product_id: 0, description: '', quantity: 1, unit_cost: 0 }],
  })
  const [purchaseSaving, setPurchaseSaving] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [toDeletePurchase, setToDeletePurchase] = useState<Purchase | null>(null)
  const [purchaseDeleting, setPurchaseDeleting] = useState(false)

  async function loadPurchases(page = 1) {
    const params = new URLSearchParams({ page: String(page), per_page: '10' })
    if (q.trim()) params.set('q', q.trim())
    if (supplierFilter) params.set('supplier_id', String(supplierFilter))
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await api<Paginated<Purchase>>(`/staff/purchases?${params}`)
    setPurchases(res.data)
    setPurchaseMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
  }

  async function loadSuppliers(page = 1) {
    const params = new URLSearchParams({ page: String(page), per_page: '12' })
    if (supplierQ.trim()) params.set('q', supplierQ.trim())
    const res = await api<Paginated<Supplier>>(`/staff/suppliers?${params}`)
    setSuppliers(res.data)
    setSupplierMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
  }

  async function loadProducts() {
    const res = await api<Paginated<Product>>('/products?per_page=100')
    setProducts(res.data)
  }

  useEffect(() => {
    loadPurchases().catch(() => {})
    loadSuppliers().catch(() => {})
    loadProducts().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'suppliers') loadSuppliers(1).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab === 'suppliers') loadSuppliers(1).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierQ])

  // ---- Proveedores ----

  function openSupplierForm(s?: Supplier) {
    if (s) {
      setToEditSupplier(s)
      setSupplierForm({ name: s.name, contact: s.contact ?? '', phone: s.phone ?? '', email: s.email ?? '' })
    } else {
      setToEditSupplier(null)
      setSupplierForm({ name: '', contact: '', phone: '', email: '' })
    }
    setSupplierError('')
    setSupplierSaving(false)
    setShowSupplierForm(true)
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierForm.name.trim()) return
    setSupplierSaving(true)
    setSupplierError('')
    try {
      if (toEditSupplier) {
        await api(`/staff/suppliers/${toEditSupplier.id}`, { method: 'PATCH', body: JSON.stringify(supplierForm) })
        toast('Proveedor actualizado.')
      } else {
        await api('/staff/suppliers', { method: 'POST', body: JSON.stringify({ ...supplierForm, name: supplierForm.name.trim() }) })
        toast('Proveedor creado.')
      }
      setShowSupplierForm(false)
      await loadSuppliers(supplierMeta.current_page).catch(() => {})
    } catch (err) {
      setSupplierError(err instanceof Error ? err.message : 'Error al guardar el proveedor.')
    } finally {
      setSupplierSaving(false)
    }
  }

  async function confirmDeleteSupplier() {
    if (!toDeleteSupplier) return
    setSupplierDeleting(true)
    try {
      await api(`/staff/suppliers/${toDeleteSupplier.id}`, { method: 'DELETE' })
      toast('Proveedor eliminado.')
      setToDeleteSupplier(null)
      await loadSuppliers(supplierMeta.current_page).catch(() => {})
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar el proveedor.', 'error')
      setToDeleteSupplier(null)
    } finally {
      setSupplierDeleting(false)
    }
  }

  // ---- Compras ----

  function openPurchaseForm(p?: Purchase) {
    if (p) {
      setEditingPurchase(p)
      setPurchaseForm({
        supplier_id: p.supplier_id ?? 0,
        purchase_date: (p.purchase_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
        items: (p.items ?? [{ id: 0, product_id: 0, description: '', quantity: 1, unit_cost: 0 }]).map((i) => ({
          id: i.id,
          product_id: i.product_id ?? 0,
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      })
    } else {
      setEditingPurchase(null)
      setPurchaseForm({
        supplier_id: 0,
        purchase_date: new Date().toISOString().slice(0, 10),
        items: [{ product_id: 0, description: '', quantity: 1, unit_cost: 0 }],
      })
    }
    setPurchaseError('')
    setPurchaseSaving(false)
    setShowPurchaseForm(true)
  }

  async function savePurchase(e: React.FormEvent) {
    e.preventDefault()
    const valid = purchaseForm.items.filter((i) => i.description.trim() || i.product_id)
    if (valid.length === 0) {
      setPurchaseError('Agrega al menos un producto o descripción.')
      return
    }
    setPurchaseSaving(true)
    setPurchaseError('')
    try {
      const body = {
        supplier_id: purchaseForm.supplier_id || null,
        purchase_date: purchaseForm.purchase_date,
        items: valid.map((i) => ({
          id: editingPurchase ? i.id ?? null : null,
          product_id: i.product_id || null,
          description: i.description,
          quantity: i.quantity,
          unit_cost: i.unit_cost,
        })),
      }
      if (editingPurchase) {
        await api(`/staff/purchases/${editingPurchase.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast('Compra actualizada.')
      } else {
        await api('/staff/purchases', { method: 'POST', body: JSON.stringify(body) })
        toast('Compra registrada y stock repuesto.')
      }
      setShowPurchaseForm(false)
      await loadPurchases(purchaseMeta.current_page).catch(() => {})
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Error al guardar la compra.')
    } finally {
      setPurchaseSaving(false)
    }
  }

  async function confirmDeletePurchase() {
    if (!toDeletePurchase) return
    setPurchaseDeleting(true)
    try {
      await api(`/staff/purchases/${toDeletePurchase.id}`, { method: 'DELETE' })
      toast('Compra eliminada y stock revertido.')
      setToDeletePurchase(null)
      const page = purchases.length === 1 && purchaseMeta.current_page > 1 ? purchaseMeta.current_page - 1 : purchaseMeta.current_page
      await loadPurchases(page).catch(() => {})
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar la compra.', 'error')
      setToDeletePurchase(null)
    } finally {
      setPurchaseDeleting(false)
    }
  }

  function updateItem(idx: number, field: keyof (typeof purchaseForm.items)[number], value: number | string) {
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }))
  }

  function pickProduct(idx: number, productId: number) {
    const prod = products.find((p) => p.id === productId)
    setPurchaseForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, product_id: productId, description: prod ? prod.name : it.description } : it)),
    }))
  }

  function addItem() {
    setPurchaseForm((f) => ({ ...f, items: [...f.items, { product_id: 0, description: '', quantity: 1, unit_cost: 0 }] }))
  }

  function removeItem(idx: number) {
    setPurchaseForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  const cartTotal = purchaseForm.items.reduce((s, i) => s + Number(i.unit_cost || 0) * Number(i.quantity || 0), 0)

  const fmt = fmtMoney

  const purchaseColumns: Column<Purchase>[] = [
    { key: 'number', header: 'Nº compra', render: (p) => <span className="font-semibold text-carbon-900">{p.purchase_number}</span> },
    { key: 'supplier', header: 'Proveedor', render: (p) => <span className="text-carbon-700">{p.supplier_name || 'Sin proveedor'}</span> },
    { key: 'date', header: 'Fecha', render: (p) => <span className="text-carbon-500">{p.purchase_date}</span> },
    { key: 'items', header: 'Líneas', align: 'center', render: (p) => <Badge tone="brand">{p.item_count ?? p.items?.length ?? 0}</Badge> },
    { key: 'total', header: 'Total', align: 'right', render: (p) => <span className="font-bold text-carbon-950">{fmt(p.total)}</span> },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <button onClick={() => setViewing(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-carbon-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700" title="Ver detalle">
            <Eye className="h-[15px] w-[15px]" />
          </button>
          <button onClick={() => openPurchaseForm(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700" title="Editar compra">
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button onClick={() => setToDeletePurchase(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50" title="Eliminar compra">
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      ),
    },
  ]

  function supplierTone(purchase_total: number) {
    return purchase_total > 0 ? 'green' : 'gray'
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'purchases', label: `Compras (${purchaseMeta.total})`, icon: <ShoppingCart className="h-4 w-4" /> },
    { key: 'suppliers', label: `Proveedores (${supplierMeta.total})`, icon: <Store className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        variant="brand"
        title="Compras y proveedores"
        subtitle="Registro de compras a proveedores, reposición de stock y directorio de proveedores."
        action={
          <div className="flex gap-2">
            <button onClick={() => openSupplierForm()} className="inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
              <Store className="h-4 w-4" />
              Nuevo proveedor
            </button>
            <button onClick={() => openPurchaseForm()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Plus className="h-4 w-4" />
              Nueva compra
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compras registradas" value={purchaseMeta.total} tone="brand" icon={<ShoppingCart className="h-[22px] w-[22px]" />} />
        <StatCard label="Proveedores" value={supplierMeta.total} tone="dark" icon={<Store className="h-[22px] w-[22px]" />} />
        <StatCard
          label="Invertido" value={fmt(suppliers.reduce((a, s) => a + (s.purchase_total || 0), 0))} tone="amber" icon={<HandCoins className="h-[22px] w-[22px]" />}
        />
        <StatCard label="Productos en catálogo" value={products.length} tone="blue" icon={<PackageSearch className="h-[22px] w-[22px]" />} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
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

      {tab === 'purchases' && (
        <div className="mt-5">
          <Toolbar searchValue={q} onSearch={(v) => setQ(v)} searchPlaceholder="Buscar compra o proveedor…" searchVariant="brand">
            <Select
              value={String(supplierFilter)}
              onChange={(e) => setSupplierFilter(Number(e.target.value))}
              variant="brand"
            >
              <option value={0}>Todos los proveedores</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} variant="brand" title="Desde" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} variant="brand" title="Hasta" />
            <button onClick={() => loadPurchases(1).catch(() => {})} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Search className="h-4 w-4" />
              Filtrar
            </button>
            <button onClick={() => { setQ(''); setSupplierFilter(0); setFrom(''); setTo(''); loadPurchases(1).catch(() => {}) }} className="inline-flex items-center gap-2 rounded-xl border border-carbon-200 px-4 py-2.5 text-sm font-semibold text-carbon-600 transition hover:bg-carbon-50">
              Limpiar
            </button>
          </Toolbar>

          <DataTable
            columns={purchaseColumns}
            rows={purchases}
            page={purchaseMeta.current_page}
            lastPage={purchaseMeta.last_page}
            total={purchaseMeta.total}
            onPage={(p) => loadPurchases(p).catch(() => {})}
            minWidth="min-w-[900px]"
            emptyText="Sin compras con los filtros actuales."
            variant="brand"
          />
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="mt-5">
          <Toolbar searchValue={supplierQ} onSearch={(v) => setSupplierQ(v)} searchPlaceholder="Buscar proveedor, contacto…" searchVariant="brand">
            <span className="text-sm text-carbon-500">Directorio de proveedores del taller</span>
          </Toolbar>

          {suppliers.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 px-6 py-14 text-center">
              <Store className="mb-3 h-10 w-10 text-brand-300" />
              <p className="font-semibold text-carbon-700">Aún no hay proveedores</p>
              <p className="mt-1 text-sm text-carbon-400">Crea tu primer proveedor para registrar compras y reponer stock.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <div key={s.id} className="group rounded-2xl border border-carbon-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Truck className="h-[22px] w-[22px]" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openSupplierForm(s)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700" title="Editar">
                      <Pencil className="h-[15px] w-[15px]" />
                    </button>
                    <button onClick={() => setToDeleteSupplier(s)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50" title="Eliminar">
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 font-bold text-carbon-900">{s.name}</div>
                <div className="mt-0.5 text-sm text-carbon-500">{s.contact || 'Sin contacto'}</div>
                {s.email && <div className="mt-0.5 text-sm text-carbon-400">{s.email}</div>}
                {s.phone && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-carbon-400">
                    <Phone className="h-3.5 w-3.5" />
                    {s.phone}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-carbon-100 pt-3">
                  <Badge tone={supplierTone(s.purchase_total)}>{s.purchase_count} compras</Badge>
                  <span className="text-sm font-semibold text-carbon-700">{fmt(s.purchase_total)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Pagination
              page={supplierMeta.current_page}
              lastPage={supplierMeta.last_page}
              total={supplierMeta.total}
              onChange={(p) => loadSuppliers(p).catch(() => {})}
            />
          </div>
        </div>
      )}

      {/* Modal proveedor */}
      <Modal
        open={showSupplierForm}
        onClose={() => setShowSupplierForm(false)}
        title={toEditSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}
        subtitle="Datos del proveedor para registrar compras."
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowSupplierForm(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="supplier-form" disabled={supplierSaving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {supplierSaving ? 'Guardando…' : 'Guardar proveedor'}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={saveSupplier} className="space-y-4">
          {supplierError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{supplierError}</div>}
          <Field label="Nombre del proveedor" variant="brand">
            <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="Ej. Repuestos Silva" variant="brand" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Contacto / teléfono" variant="brand">
              <Input value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} placeholder="Nombre del contacto" variant="brand" />
            </Field>
            <Field label="Teléfono" variant="brand">
              <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="300 123 4567" variant="brand" />
            </Field>
          </div>
          <Field label="Correo electrónico" variant="brand">
            <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="proveedor@correo.com" variant="brand" />
          </Field>
        </form>
      </Modal>

      {/* Modal compra */}
      <Modal
        open={showPurchaseForm}
        onClose={() => setShowPurchaseForm(false)}
        title={editingPurchase ? `Editar compra ${editingPurchase.purchase_number}` : 'Nueva compra'}
        subtitle="Registra los productos recibidos; el stock se repone automáticamente."
        size="lg"
        variant="brand"
        footer={
          <>
            <button onClick={() => setShowPurchaseForm(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="purchase-form" disabled={purchaseSaving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {purchaseSaving ? 'Guardando…' : editingPurchase ? 'Guardar cambios' : 'Registrar compra'}
            </button>
          </>
        }
      >
        <form id="purchase-form" onSubmit={savePurchase} className="space-y-4">
          {purchaseError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{purchaseError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Proveedor" variant="brand">
              <Select value={String(purchaseForm.supplier_id)} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: Number(e.target.value) })} variant="brand">
                <option value={0}>Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha de compra" variant="brand">
              <Input type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} variant="brand" />
            </Field>
          </div>

          <div className="rounded-xl border border-carbon-200">
            <div className="rounded-t-xl border-b border-carbon-200 bg-carbon-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-carbon-500">
              Líneas de la compra
            </div>
            <div className="space-y-3 p-4">
              {purchaseForm.items.map((item, idx) => {
                const lineTotal = Number(item.unit_cost || 0) * Number(item.quantity || 0)
                return (
                  <div key={idx} className="rounded-xl border border-carbon-100 p-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <Select value={String(item.product_id || 0)} onChange={(e) => pickProduct(idx, Number(e.target.value))} variant="brand">
                          <option value={0}>Producto del catálogo…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="sm:col-span-4">
                        <Input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="Descripción" variant="brand" />
                      </div>
                      <div className="sm:col-span-1">
                        <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} placeholder="Cant." variant="brand" />
                      </div>
                      <div className="sm:col-span-2">
                        <Input type="number" min={0} step="0.01" value={item.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', Number(e.target.value))} placeholder="Costo unit." variant="brand" />
                      </div>
                      <div className="flex items-center justify-between gap-1 sm:col-span-1">
                        <span className="text-sm font-semibold text-carbon-700">{fmt(lineTotal)}</span>
                        <button type="button" onClick={() => removeItem(idx)} disabled={purchaseForm.items.length === 1} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-30" title="Quitar línea">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700">
                <Plus className="h-4 w-4" />
                Agregar línea
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-brand-50/60 px-4 py-3">
            <span className="text-sm font-semibold text-carbon-800">Total de la compra</span>
            <span className="text-lg font-bold text-brand-700">{fmt(cartTotal)}</span>
          </div>
        </form>
      </Modal>

      {/* Modal detalle */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`Compra ${viewing?.purchase_number ?? ''}`}
        subtitle={`${viewing?.supplier_name ?? 'Sin proveedor'} · ${viewing?.purchase_date ?? ''}`}
        variant="brand"
      >
        {viewing && (
          <div>
            <div className="flex items-center justify-between rounded-xl bg-brand-50/60 px-4 py-3">
              <span className="font-semibold text-carbon-800">Total</span>
              <span className="text-lg font-bold text-brand-700">{fmt(viewing.total)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {(viewing.items ?? []).map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-carbon-100 px-3 py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-carbon-800">{it.description}</div>
                    <div className="text-xs text-carbon-400">{it.quantity} × {fmt(it.unit_cost)}</div>
                  </div>
                  <div className="font-semibold text-carbon-900">{fmt((it.total ?? it.quantity * it.unit_cost))}</div>
                </div>
              ))}
              {(viewing.items ?? []).length === 0 && <p className="text-sm text-carbon-400">Sin líneas.</p>}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDeleteSupplier}
        onClose={() => setToDeleteSupplier(null)}
        onConfirm={() => confirmDeleteSupplier().catch(() => {})}
        title="Eliminar proveedor"
        message={`¿Eliminar el proveedor "${toDeleteSupplier?.name}"? Solo es posible si no tiene compras registradas.`}
        loading={supplierDeleting}
      />

      <ConfirmDialog
        open={!!toDeletePurchase}
        onClose={() => setToDeletePurchase(null)}
        onConfirm={() => confirmDeletePurchase().catch(() => {})}
        title="Eliminar compra"
        message={`¿Eliminar la compra "${toDeletePurchase?.purchase_number}"? Se revertirá el stock recibido.`}
        loading={purchaseDeleting}
      />
    </div>
  )
}