import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, Download, History, ImagePlus, Pencil, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { SectionHeader } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar, IconButton, FilterPill } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Input, Field, Select, Textarea, Toggle } from '../../components/ui/form'
import type { Paginated } from '../../lib/pagination'
import type { InventoryItem } from '../../lib/types'
import { RowSkeleton } from '../../components/Skeletons'
import { fmtMoney } from '../../lib/money'

const FILTERS = [
  { value: 'all', label: 'Todos', key: 'all', dot: 'bg-brand-500' },
  { value: 'low', label: 'Stock bajo', key: 'low', dot: 'bg-amber-500' },
  { value: 'out', label: 'Agotados', key: 'out', dot: 'bg-red-500' },
] as const

type StatusKey = (typeof FILTERS)[number]['value']

interface Option { id: number; name: string }

interface StockMovementRow {
  id: number
  quantity: number
  type: string
  reference?: string
  note?: string
  created_at?: string
  user?: { id: number; name: string } | null
}

const MOVE_LABEL: Record<string, { label: string; in: boolean | null; cls: string }> = {
  initial: { label: 'Stock inicial', in: true, cls: 'bg-brand-100 text-brand-700' },
  purchase: { label: 'Compra', in: true, cls: 'bg-emerald-100 text-emerald-700' },
  sale: { label: 'Venta', in: false, cls: 'bg-blue-100 text-blue-700' },
  reserve: { label: 'Reserva', in: false, cls: 'bg-amber-100 text-amber-700' },
  release: { label: 'Liberación', in: true, cls: 'bg-teal-100 text-teal-700' },
  adjustment: { label: 'Ajuste', in: null, cls: 'bg-purple-100 text-purple-700' },
  return: { label: 'Devolución', in: true, cls: 'bg-rose-100 text-rose-700' },
}

const moveInfo = (type: string) => MOVE_LABEL[type] ?? { label: type, in: null, cls: 'bg-carbon-100 text-carbon-600' }

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-b border-brand-100 pb-1.5 text-xs font-extrabold uppercase tracking-widest text-carbon-500">
      {children}
    </p>
  )
}

const emptyForm = () => ({
  name: '',
  sku: '',
  unit: 'unidad',
  description: '',
  category_id: '',
  brand_id: '',
  price: '',
  promo_price: '',
  cost: '',
  quantity: '0',
  min_stock: '0',
  is_active: true,
})

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusKey>('all')
  const [catFilter, setCatFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')

  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [categories, setCategories] = useState<Option[]>([])
  const [brands, setBrands] = useState<Option[]>([])
  const [exporting, setExporting] = useState(false)

  const [movementsTarget, setMovementsTarget] = useState<InventoryItem | null>(null)
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [movementsMeta, setMovementsMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [movementsLoading, setMovementsLoading] = useState(false)

  async function loadMovements(page = 1, targetId?: number) {
    const pid = targetId ?? movementsTarget?.id
    if (!pid) return
    setMovementsLoading(true)
    try {
      const res = await api<Paginated<StockMovementRow>>(`/staff/inventory/${pid}/movements?page=${page}`)
      setMovements(res.data)
      setMovementsMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    } catch (err) {
      setMovements([])
      setMovementsMeta({ current_page: 1, last_page: 1, total: 0 })
      setSuccessMsg(err instanceof Error ? err.message : 'Error al cargar movimientos')
    } finally {
      setMovementsLoading(false)
    }
  }

  function openMovements(it: InventoryItem) {
    setMovementsTarget(it)
    setMovements([])
    loadMovements(1, it.id)
  }

  useEffect(() => {
    api<Option[]>('/staff/catalog/categories').then(setCategories).catch(() => {})
    api<Option[]>('/staff/catalog/brands').then(setBrands).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  async function load(page = 1) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (query.trim()) params.set('q', query.trim())
      if (catFilter) params.set('category_id', catFilter)
      if (brandFilter) params.set('brand_id', brandFilter)
      const res = await api<Paginated<InventoryItem>>(`/staff/inventory?${params.toString()}`)
      setItems(res.data)
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
      setCounts(res.meta.counts ?? {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { load(1).catch(() => {}) }, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, catFilter, brandFilter])

  // ---------------- CRUD: crear / abrir / guardar / borrar ----------------

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setImageFile(null)
    setImageUrl('')
    setFormError('')
    setSaving(false)
    setFormOpen(true)
  }

  function openEdit(it: InventoryItem) {
    setEditing(it)
    setForm({
      name: it.name,
      sku: it.sku || '',
      unit: it.unit || 'unidad',
      description: it.description || '',
      category_id: it.category_id ? String(it.category_id) : '',
      brand_id: it.brand_id ? String(it.brand_id) : '',
      price: String(it.price ?? 0),
      promo_price: it.promo_price != null ? String(it.promo_price) : '',
      cost: it.cost != null ? String(it.cost) : '',
      quantity: String(it.quantity ?? 0),
      min_stock: String(it.min_stock ?? 0),
      is_active: it.is_active !== false,
    })
    setImageFile(null)
    setImageUrl(it.image || '')
    setFormError('')
    setSaving(false)
    setFormOpen(true)
  }

  function closeForm() {
    setEditing(null)
    setFormOpen(false)
    setFormError('')
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.name.trim()) {
      setFormError('El nombre del producto es obligatorio.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      if (form.sku.trim()) fd.append('sku', form.sku.trim())
      fd.append('unit', form.unit || 'unidad')
      if (form.description.trim()) fd.append('description', form.description.trim())
      if (form.category_id) fd.append('category_id', form.category_id)
      if (form.brand_id) fd.append('brand_id', form.brand_id)
      fd.append('price', String(Number(form.price) || 0))
      if (form.promo_price !== '') fd.append('promo_price', String(Number(form.promo_price) || 0))
      if (form.cost !== '') fd.append('cost', String(Number(form.cost) || 0))
      fd.append('quantity', String(Number(form.quantity) || 0))
      fd.append('min_stock', String(Number(form.min_stock) || 0))
      fd.append('is_active', form.is_active ? '1' : '0')
      if (imageFile) fd.append('image', imageFile)
      else if (imageUrl.trim() && (!editing || imageUrl.trim() !== (editing.image || ''))) fd.append('image_url', imageUrl.trim())

      if (editing) {
        await api(`/staff/catalog/products/${editing.id}`, { method: 'PATCH', body: fd })
        setSuccessMsg(`"${form.name.trim()}" actualizado correctamente`)
      } else {
        await api('/staff/catalog/products', { method: 'POST', body: fd })
        setSuccessMsg(`Producto "${form.name.trim()}" creado`)
      }
      closeForm()
      await load(meta.current_page)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(it: InventoryItem) {
    const next = it.is_active !== false
    try {
      const fd = new FormData()
      fd.append('is_active', next ? '0' : '1')
      await api(`/staff/catalog/products/${it.id}`, { method: 'PATCH', body: fd })
      setSuccessMsg(next ? `"${it.name}" desactivado (no visible en tienda)` : `"${it.name}" activado`)
      await load(meta.current_page)
    } catch (err) {
      setSuccessMsg(err instanceof Error ? err.message : 'Error al cambiar estado')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/staff/catalog/products/${deleteTarget.id}`, { method: 'DELETE' })
      setSuccessMsg(`"${deleteTarget.name}" eliminado`)
      setDeleteTarget(null)
      await load(meta.current_page)
    } catch (err) {
      setSuccessMsg(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  // ---------------- Excel ----------------

  const estadoOf = (it: InventoryItem) => {
    if (it.quantity <= 0) return { label: 'Agotado', cls: 'bg-red-100 text-red-700' }
    if (it.quantity <= it.min_stock) return { label: 'Stock bajo', cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-700' }
  }

  function downloadCsv(rows: InventoryItem[]) {
    const head = ['Producto', 'Categoría', 'Marca', 'SKU', 'Precio', 'Promoción', 'Costo', 'Stock', 'Reservado', 'Disponible', 'Stock mínimo', 'Estado', 'Visible en tienda']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }
    const lines = [
      head.join(';'),
      ...rows.map((it) =>
        [
          it.name,
          it.category ?? '',
          it.brand ?? '',
          it.sku ?? '',
          it.price,
          it.promo_price ?? '',
          it.cost,
          it.quantity,
          it.reserved,
          it.available,
          it.min_stock,
          estadoOf(it).label,
          it.is_active === false ? 'No' : 'Sí',
        ]
          .map(esc)
          .join(';'),
      ),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventario_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const all: InventoryItem[] = []
      let page = 1
      let lastPage = 1
      do {
        const params = new URLSearchParams({ per_page: '50', page: String(page) })
        if (query.trim()) params.set('q', query.trim())
        if (catFilter) params.set('category_id', catFilter)
        if (brandFilter) params.set('brand_id', brandFilter)
        const res = await api<Paginated<InventoryItem>>(`/staff/inventory?${params.toString()}`)
        all.push(...res.data)
        lastPage = res.meta.last_page
        page++
      } while (page <= lastPage && page < 200)

      const rows = all.filter((it) => {
        if (status === 'low') return it.quantity <= it.min_stock
        if (status === 'out') return it.quantity === 0
        return true
      })
      if (rows.length === 0) {
        setSuccessMsg('No hay filas para exportar con los filtros actuales')
        return
      }
      downloadCsv(rows)
      setSuccessMsg(`Excel descargado con ${rows.length} producto(s)`)
    } catch (err) {
      setSuccessMsg(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const visible = (() => {
    if (status === 'low') return items.filter((it) => it.quantity <= it.min_stock)
    if (status === 'out') return items.filter((it) => it.quantity === 0)
    return items
  })()

  const totalItems = counts.all ?? meta.total

  // ---------------- Tabla ----------------

  const columns: Column<InventoryItem>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (it) => (
        <div className="flex items-center gap-2">
          {it.image ? (
            <img src={it.image} alt={it.name} className="h-11 w-11 shrink-0 rounded-lg border border-brand-200 object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <ShoppingBag className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold text-carbon-950">{it.name}</p>
            <p className="truncate text-xs text-carbon-500">
              {it.sku ? `SKU: ${it.sku}` : ''}{it.sku && it.min_stock > 0 ? ' · ' : ''}{it.min_stock > 0 ? `mín. ${it.min_stock}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Categoría', render: (it) => <span className="text-carbon-600">{it.category || '—'}</span> },
    { key: 'brand', header: 'Marca', render: (it) => <span className="text-carbon-600">{it.brand || '—'}</span> },
    {
      key: 'stock',
      header: 'Stock',
      align: 'center',
      render: (it) => {
        const low = it.quantity <= it.min_stock
        return (
          <span
            className={`inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-sm font-black ${
              it.quantity === 0
                ? 'bg-red-100 text-red-700'
                : low
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {it.quantity}
          </span>
        )
      },
    },
    {
      key: 'available',
      header: 'Disponible',
      align: 'center',
      render: (it) => (
        <span className={`text-sm font-bold ${it.available <= 0 ? 'text-red-600' : 'text-carbon-950'}`}>{it.available}</span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (it) => {
        const e = estadoOf(it)
        return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${e.cls}`}>{e.label}</span>
      },
    },
    {
      key: 'price',
      header: 'Precio',
      align: 'right',
      render: (it) =>
        it.promo_price && it.promo_price < it.price ? (
          <span className="flex flex-col items-end">
            <span className="text-sm font-bold text-brand-600">{fmtMoney(it.promo_price)}</span>
            <span className="text-xs text-carbon-400 line-through">{fmtMoney(it.price)}</span>
          </span>
        ) : (
          <span className="text-sm font-semibold text-carbon-900">{fmtMoney(it.price)}</span>
        ),
    },
    {
      key: 'active',
      header: 'Activo',
      align: 'center',
      render: (it) => (
        <button
          onClick={() => toggleActive(it)}
          title={it.is_active === false ? 'Activar (visible en tienda)' : 'Desactivar (ocultar de tienda)'}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
            it.is_active === false
              ? 'bg-carbon-200 text-carbon-600 hover:bg-red-100 hover:text-red-600'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          }`}
        >
          {it.is_active === false ? 'Inactivo' : 'Activo'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (it) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton title="Movimientos de stock" onClick={() => openMovements(it)}>
            <History className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Editar producto" onClick={() => openEdit(it)}>
            <Pencil className="h-[15px] w-[15px]" />
          </IconButton>
          <IconButton title="Eliminar producto" danger onClick={() => setDeleteTarget(it)}>
            <Trash2 className="h-[15px] w-[15px]" />
          </IconButton>
        </div>
      ),
    },
  ]

  if (loading && items.length === 0)
    return (
      <div className="mx-auto max-w-6xl p-4">
        <RowSkeleton cols={8} rows={6} />
      </div>
    )
  if (error) return <div className="p-4 text-red-600">{error}</div>

  const set = (k: keyof ReturnType<typeof emptyForm>) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Inventario"
        subtitle="Productos, stock, precios y visibilidad en la tienda."
        variant="brand"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando…' : 'Descargar Excel'}
            </button>
            <button onClick={openCreate} className="btn-primary !text-sm">
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-brand-300 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">Productos</p>
            <p className="text-2xl font-black text-carbon-950">{totalItems}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-300 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">Stock bajo</p>
            <p className="text-2xl font-black text-carbon-950">{counts.low ?? 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-brand-300 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-carbon-500">Agotados</p>
            <p className="text-2xl font-black text-carbon-950">{counts.out ?? 0}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="ml-auto rounded p-0.5 text-emerald-500 hover:bg-emerald-100" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-5">
        <Toolbar
          searchValue={query}
          onSearch={setQuery}
          searchPlaceholder="Buscar producto, categoría o marca…"
          searchVariant="brand"
        >
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} variant="brand" className="w-auto sm:w-44">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} variant="brand" className="w-auto sm:w-44">
            <option value="">Todas las marcas</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          {FILTERS.map((f) => {
            const active = status === f.value
            const n = counts[f.key] ?? 0
            return (
              <FilterPill key={f.value} active={active} variant="brand" onClick={() => setStatus(f.value)}>
                <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
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
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        page={meta.current_page}
        lastPage={meta.last_page}
        total={meta.total}
        onPage={(p) => load(p)}
        variant="brand"
        headerClassName="!font-black !text-carbon-950"
        minWidth="min-w-[1120px]"
        emptyText="No hay productos que coincidan."
      />

      {/* Crear / editar producto */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        subtitle={editing ? editing.name : 'Registra un producto para el inventario y la tienda.'}
        size="xl"
        variant="brand"
        footer={
          <>
            <button onClick={closeForm} className="btn-ghost !text-sm">
              Cancelar
            </button>
            <button type="submit" form="product-form" disabled={saving} className="btn-primary !text-sm">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={saveProduct} className="space-y-5">
          {formError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{formError}</p>}

          {editing && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">Disponible: {editing.available}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">Reservado: {editing.reserved}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${estadoOf(editing).cls}`}>{estadoOf(editing).label}</span>
              {editing.quantity > 0 && editing.quantity <= editing.min_stock && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">mín. {editing.min_stock}</span>
              )}
            </div>
          )}

          <div className="space-y-3">
            <SectionTitle>Información general</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nombre *" variant="brand">
                <Input value={form.name} onChange={set('name')} required placeholder="Ej. Aceite 10W-40 Sintético" variant="brand" autoFocus={!editing} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU" hint="(opcional)" variant="brand">
                  <Input value={form.sku} onChange={set('sku')} placeholder="P-001" variant="brand" />
                </Field>
                <Field label="Unidad" variant="brand">
                  <Select value={form.unit} onChange={set('unit')} variant="brand">
                    <option value="unidad">Unidad</option>
                    <option value="litro">Litro</option>
                    <option value="kilogramo">Kilogramo</option>
                    <option value="par">Par</option>
                    <option value="juego">Juego</option>
                    <option value="servicio">Servicio</option>
                  </Select>
                </Field>
              </div>
            </div>
            <Field label="Descripción / detalles" variant="brand">
              <Textarea value={form.description} onChange={set('description')} rows={2} placeholder="Detalles visibles en la tienda…" variant="brand" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              <SectionTitle>Clasificación</SectionTitle>
              <Field label="Categoría" variant="brand">
                <Select value={form.category_id} onChange={set('category_id')} variant="brand">
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Marca" variant="brand">
                <Select value={form.brand_id} onChange={set('brand_id')} variant="brand">
                  <option value="">Sin marca</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            </div>

            <div className="space-y-3">
              <SectionTitle>Precios</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Venta *" variant="brand">
                  <Input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} placeholder="0" variant="brand" />
                </Field>
                <Field label="Promo" hint="opc." variant="brand">
                  <Input type="number" min={0} step="0.01" value={form.promo_price} onChange={set('promo_price')} placeholder="0" variant="brand" />
                </Field>
                <Field label="Costo" hint="opc." variant="brand">
                  <Input type="number" min={0} step="0.01" value={form.cost} onChange={set('cost')} placeholder="0" variant="brand" />
                </Field>
              </div>
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-2 text-xs text-carbon-600">
                El <b>precio de venta</b>, la <b>promoción</b> y el <b>costo</b> se muestran en tienda y en el punto de venta.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle>Stock</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Cantidad" variant="brand">
                <Input type="number" min={0} value={form.quantity} onChange={set('quantity')} variant="brand" />
              </Field>
              <Field label="Stock mínimo" variant="brand">
                <Input type="number" min={0} value={form.min_stock} onChange={set('min_stock')} variant="brand" />
              </Field>
            </div>
            {editing && (
              <p className="text-xs text-carbon-500">
                Guardar registrará un <b>ajuste de inventario</b> con la diferencia (±{Math.abs(Number(form.quantity) - editing.quantity)}).
              </p>
            )}
          </div>

          <div className="space-y-3">
            <SectionTitle>Imagen</SectionTitle>
            {imageFile || imageUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-300 bg-brand-50/40 p-2">
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                  alt="Vista previa"
                  className="h-16 w-16 shrink-0 rounded-lg border border-brand-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-carbon-950">{imageFile?.name || imageUrl}</p>
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImageUrl('') }}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                  >
                    <X className="h-3 w-3" /> Quitar imagen
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400 bg-brand-50/40 px-3 py-3 text-sm font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50">
                  <ImagePlus className="h-4 w-4" />
                  Subir archivo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { setImageFile(e.target.files?.[0] || null); setImageUrl('') }}
                  />
                </label>
                <Input
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImageFile(null) }}
                  placeholder="https://… (URL de imagen)"
                  variant="brand"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-2.5">
            <div className="text-sm font-semibold text-carbon-950">Visible en la tienda</div>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </form>
      </Modal>

      {/* Movimientos de stock */}
      <Modal
        open={!!movementsTarget}
        onClose={() => setMovementsTarget(null)}
        title="Movimientos de stock"
        subtitle={movementsTarget ? movementsTarget.name : ''}
        size="lg"
        variant="brand"
      >
        {movementsLoading && movements.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-carbon-400">Cargando movimientos…</div>
        ) : movements.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-carbon-400">
            <History className="h-6 w-6" />
            Este producto aún no tiene movimientos registrados.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-carbon-200">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="border-b-2 border-brand-400 bg-brand-50 text-left text-[11px] uppercase tracking-widest text-carbon-950">
                  <tr>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-center">Cantidad</th>
                    <th className="px-4 py-3 text-right">Fecha</th>
                    <th className="px-4 py-3">Registrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const info = moveInfo(m.type)
                    const sign = info.in === null ? '±' : info.in ? '+' : '−'
                    return (
                      <tr key={m.id} className="border-t border-carbon-100 hover:bg-brand-50/40">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${info.cls}`}>{info.label}</span>
                          {m.reference && <p className="mt-0.5 text-xs text-carbon-500">Ref: {m.reference}</p>}
                          {m.note && <p className="text-xs text-carbon-400">“{m.note}”</p>}
                        </td>
                        <td className={`px-4 py-3 text-center font-black ${info.in === null ? 'text-purple-600' : info.in ? 'text-emerald-600' : 'text-red-600'}`}>
                          {sign}{m.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-carbon-500">
                          {m.created_at ? new Date(m.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-carbon-600">{m.user?.name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {movementsMeta.last_page > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-carbon-500">{movementsMeta.total} movimiento(s)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadMovements(movementsMeta.current_page - 1)}
                    disabled={movementsMeta.current_page <= 1 || movementsLoading}
                    className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => loadMovements(movementsMeta.current_page + 1)}
                    disabled={movementsMeta.current_page >= movementsMeta.last_page || movementsLoading}
                    className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Eliminar producto"
        message={`¿Eliminar "${deleteTarget?.name}"? También se borrará su stock y no podrá recuperarse.`}
        confirmLabel="Eliminar"
      />
    </div>
  )
}