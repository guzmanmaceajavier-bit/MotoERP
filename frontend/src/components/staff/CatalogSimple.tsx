import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, Building2, Bike, ArrowUpDown, X, ImageIcon, Upload } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { Field, Input, Select, SearchInput } from '../ui/form'
import { Modal, ConfirmDialog } from '../ui/modal'
import { DataTable, type Column } from '../ui/table'
import { gradientFor } from '../../lib/gradients'
import { BulkToggle, BulkNamesField, parseBulkNames } from './BulkFields'

export interface SimpleBrand { id: number; name: string }

interface Item {
  id: number
  name: string
  brand_id?: number
  brand?: string | null
  year?: number | null
  image?: string | null
  is_active?: boolean
  models_count?: number
}

const PER_PAGE = 10

export default function CatalogSimple({
  kind,
  onViewModels,
  initialBrandFilter = '',
}: {
  kind: 'brands' | 'models'
  onViewModels?: (brandId: number) => void
  initialBrandFilter?: string
}) {
  const toast = useToast().toast
  const isModel = kind === 'models'
  const entity = isModel ? 'modelo' : 'marca'
  const title = isModel ? 'Modelos' : 'Marcas'
  const Tile = isModel ? Bike : Building2

  const [items, setItems] = useState<Item[]>([])
  const [brands, setBrands] = useState<SimpleBrand[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [confirm, setConfirm] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState(initialBrandFilter)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<'brand' | 'name'>('brand')
  const [form, setForm] = useState<{ name: string; brand_id: string; year: string; image: string }>({ name: '', brand_id: '', year: '', image: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [bulk, setBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  const endpoint = `/staff/catalog/${kind}`

  const load = useCallback(async () => {
    const data = await api<Item[]>(endpoint)
    setItems(data)
    if (kind === 'models') {
      api<SimpleBrand[]>('/staff/catalog/brands').then(setBrands).catch(() => {})
    }
  }, [endpoint, kind])

  useEffect(() => { load().catch(() => {}) }, [load])

  useEffect(() => { setPage(1) }, [search, brandFilter, statusFilter])

  const filtered = useMemo(() => {
    let list = items
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((it) => `${it.name} ${it.brand ?? ''} ${it.year ?? ''}`.toLowerCase().includes(q))
    if (isModel) {
      if (brandFilter) list = list.filter((it) => String(it.brand_id) === brandFilter)
      if (statusFilter === 'active') list = list.filter((it) => it.is_active !== false)
      if (statusFilter === 'inactive') list = list.filter((it) => it.is_active === false)
    }
    const sorted = [...list]
    if (isModel) {
      sorted.sort((a, b) =>
        sortKey === 'name'
          ? a.name.localeCompare(b.name)
          : (a.brand ?? '').localeCompare(b.brand ?? '') || a.name.localeCompare(b.name),
      )
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [items, search, brandFilter, statusFilter, sortKey, isModel])

  const total = items.length
  const active = items.filter((it) => it.is_active !== false).length
  const withModels = items.filter((it) => (it.models_count ?? 0) > 0).length
  const hasFilters = Boolean(search.trim() || brandFilter || statusFilter !== 'all')
  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, lastPage)
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const activeBrand = brands.find((b) => String(b.id) === brandFilter)

  function clearFilters() {
    setSearch('')
    setBrandFilter('')
    setStatusFilter('all')
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', brand_id: '', year: '', image: '' })
    setImageFile(null)
    setBulk(false)
    setBulkText('')
    setOpen(true)
  }
  function openEdit(it: Item) {
    setEditing(it)
    setForm({
      name: it.name,
      brand_id: it.brand_id ? String(it.brand_id) : '',
      year: it.year ? String(it.year) : '',
      image: it.image ?? '',
    })
    setImageFile(null)
    setOpen(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (!editing && bulk) {
        const names = parseBulkNames(bulkText)
        if (!names.length) {
          toast.error('Escribe al menos un nombre')
          return
        }
        let created = 0
        const skipped: string[] = []
        for (const name of names) {
          const payload: Record<string, string | number | null> = { name }
          if (isModel) {
            payload.brand_id = Number(form.brand_id)
            payload.year = form.year ? Number(form.year) : null
          }
          try {
            await api(endpoint, { method: 'POST', body: JSON.stringify(payload) })
            created++
          } catch {
            skipped.push(name)
          }
        }
        setOpen(false)
        load()
        if (skipped.length) {
          toast.error(`${created} creada(s), ${skipped.length} omitida(s) por existir ya: ${skipped.join(', ')}`)
        } else {
          toast.success(`${created} ${entity} creadas`)
        }
        return
      }
      const fd = new FormData()
      fd.append('name', form.name.trim())
      if (isModel) {
        fd.append('brand_id', String(Number(form.brand_id)))
        fd.append('year', form.year ? String(Number(form.year)) : '')
      } else {
        if (imageFile) {
          fd.append('image', imageFile)
        }
        if (form.image.trim()) {
          fd.append('image_url', form.image.trim())
        }
      }
      if (editing) {
        fd.append('_method', 'PATCH')
        await api(`${endpoint}/${editing.id}`, { method: 'POST', body: fd })
        toast.success(`${entity} actualizada`)
      } else {
        await api(endpoint, { method: 'POST', body: fd })
        toast.success(`${entity} creada`)
      }
      setOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function removeConfirmed() {
    if (!confirm) return
    setDeleting(true)
    try {
      await api(`${endpoint}/${confirm.id}`, { method: 'DELETE' })
      toast.success(`${entity} eliminada`)
      setConfirm(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  const previewSeed = isModel ? (form.brand_id ? `M${form.name}${form.brand_id}` : form.name || 'modelo') : form.name || 'marca'

  const actions = (it: Item) => (
    <div className="flex items-center justify-end gap-2">
      {kind === 'brands' && onViewModels && (
        <button
          onClick={() => onViewModels(it.id)}
          title="Ver los modelos de esta marca"
          className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-200 px-3 py-1.5 text-xs font-semibold text-carbon-700 transition hover:border-brand-300 hover:bg-brand-50"
        >
          <Tile className="h-3.5 w-3.5" />
          Modelos
        </button>
      )}
      <button
        onClick={() => openEdit(it)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </button>
      <button
        onClick={() => setConfirm(it)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Borrar
      </button>
    </div>
  )

  const columns: Column<Item>[] = isModel
    ? [
        {
          key: 'brand',
          header: 'Marca',
          render: (it) => (
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br ${gradientFor(it.brand ?? it.name)}`} />
              <span className="font-semibold text-carbon-700">{it.brand || '—'}</span>
            </div>
          ),
        },
        {
          key: 'name',
          header: 'Modelo',
          render: (it) => (
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradientFor(it.brand ?? it.name)} text-white`}>
                <Tile className="h-4 w-4" />
              </span>
              <p className="font-semibold text-carbon-950">{it.name}</p>
            </div>
          ),
        },
        {
          key: 'year',
          header: 'Año',
          render: (it) => (it.year ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">{it.year}</span> : <span className="text-carbon-300">—</span>),
        },
        {
          key: 'status',
          header: 'Estado',
          render: (it) =>
            it.is_active === false ? (
              <span className="rounded-full bg-carbon-100 px-2.5 py-1 text-xs font-bold text-carbon-600">Inactivo</span>
            ) : (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">Activo</span>
            ),
        },
        { key: 'actions', header: '', align: 'right', render: actions },
      ]
    : [
        {
          key: 'name',
          header: 'Marca',
          render: (it) => (
            <div className="flex items-center gap-3">
              {it.image ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-carbon-200 bg-white">
                  <img src={it.image} alt={it.name} className="h-full w-full object-contain" />
                </span>
              ) : (
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFor(it.name)} text-white`}>
                  <Tile className="h-4 w-4" />
                </span>
              )}
              <div>
                <p className="font-semibold text-carbon-950">{it.name}</p>
                <p className="text-xs text-carbon-400">Fabricante</p>
              </div>
            </div>
          ),
        },
        {
          key: 'models',
          header: 'Modelos',
          render: (it) => (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
              <Bike className="h-3.5 w-3.5" />
              {it.models_count ?? 0} {it.models_count === 1 ? 'modelo' : 'modelos'}
            </span>
          ),
        },
        { key: 'actions', header: '', align: 'right', render: actions },
      ]

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Agregar {entity}
          </button>
          <span className="rounded-full border border-carbon-200 bg-white px-3 py-1.5 text-sm font-bold text-carbon-950">{total} · Total</span>
          {isModel ? (
            <>
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-bold text-green-700">{active} · Activos</span>
              <span className="rounded-full border border-carbon-200 bg-carbon-50 px-3 py-1.5 text-sm font-bold text-carbon-600">{total - active} · Inactivos</span>
            </>
          ) : (
            <>
              <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">{withModels} · Con modelos</span>
              <span className="rounded-full border border-carbon-200 bg-carbon-50 px-3 py-1.5 text-sm font-bold text-carbon-600">{total - withModels} · Vacías</span>
            </>
          )}
          {filtered.length !== total && <span className="text-sm text-carbon-500">· {filtered.length} encontrados</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isModel && (
            <>
              <Select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                variant="brand"
                className="w-auto"
              >
                <option value="">Todas las marcas</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                variant="brand"
                className="w-auto"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
              <button
                onClick={() => setSortKey((k) => (k === 'brand' ? 'name' : 'brand'))}
                title={sortKey === 'brand' ? 'Ordenar por nombre' : 'Agrupar por marca'}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  sortKey === 'brand'
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-carbon-200 bg-white text-carbon-600 hover:border-brand-300'
                }`}
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortKey === 'brand' ? 'Por marca' : 'Por nombre'}
              </button>
            </>
          )}
          <SearchInput value={search} onChange={setSearch} placeholder={`Buscar ${title.toLowerCase()}…`} variant="brand" />
        </div>
      </div>

      {hasFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeBrand && (
            <button onClick={() => setBrandFilter('')} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700">
              <Tile className="h-3.5 w-3.5" />
              {activeBrand.name}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="inline-flex items-center gap-1.5 rounded-full bg-carbon-800 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-carbon-900">
              {statusFilter === 'active' ? 'Activos' : 'Inactivos'}
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {search.trim() && (
            <button onClick={() => setSearch('')} className="inline-flex items-center gap-1.5 rounded-full bg-carbon-200 px-3 py-1.5 text-xs font-bold text-carbon-700 transition hover:bg-carbon-300">
              "{search.trim()}"
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={clearFilters} className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-300 bg-white py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Tile className="h-7 w-7" />
          </span>
          <p className="mt-3 font-bold text-carbon-950">
            {hasFilters ? 'Sin coincidencias con los filtros.' : `Aún no hay ${title.toLowerCase()}.`}
          </p>
          <p className="mt-1 text-sm text-carbon-500">
            {hasFilters ? 'Ajusta o limpia los filtros para ver más resultados.' : `Crea la primera ${entity} desde aquí.`}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {hasFilters ? (
              <button onClick={clearFilters} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                Limpiar filtros
              </button>
            ) : (
              <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]">
                <Plus className="h-4 w-4" />
                Agregar {entity}
              </button>
            )}
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          page={safePage}
          lastPage={lastPage}
          total={filtered.length}
          onPage={setPage}
          variant="brand"
          rowKey={(it) => it.id}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar ${entity}` : `Nuevo ${entity}`}
        subtitle={editing ? editing.name : isModel ? 'Define la marca, el nombre y el año del modelo.' : 'Define el nombre de la marca.'}
        variant="brand"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="simple-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : bulk ? 'Crear todas' : `Crear ${entity}`}
            </button>
          </>
        }
      >
        <form id="simple-form" onSubmit={save} className="space-y-4">
          {!editing && (
            <div className="flex items-center justify-between gap-3">
              <BulkToggle bulk={bulk} onChange={setBulk} />
              {bulk && <p className="text-xs text-carbon-400">{entity} por línea, sin comas ni separadores.</p>}
            </div>
          )}
          {!bulk || editing ? (
            <>
              {isModel && (
                <Field label="Marca *" variant="brand">
                  <Select value={form.brand_id || ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} required variant="brand">
                    <option value="">Selecciona…</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </Field>
              )}
              <Field label={`Nombre de la ${entity} *`} variant="brand">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required variant="brand" />
              </Field>
              {isModel && (
                <Field label="Año" variant="brand">
                  <Input type="number" min={1900} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} variant="brand" placeholder="Ej. 2023" />
                </Field>
              )}

              {!isModel && (
                <Field label="Imagen de la marca" variant="brand">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-carbon-200 bg-carbon-100">
                      {imageFile ? (
                        <img src={URL.createObjectURL(imageFile)} alt="Vista previa" className="h-full w-full object-contain" />
                      ) : form.image ? (
                        <img src={form.image} alt="Vista previa" className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-carbon-400">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {imageFile ? 'Reemplazar imagen' : 'Subir imagen'}
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) { setImageFile(f); setForm((p) => ({ ...p, image: '' })) }
                          e.target.value = ''
                        }}
                      />
                      <Input
                        value={form.image}
                        onChange={(e) => { setForm({ ...form, image: e.target.value }); setImageFile(null) }}
                        placeholder="https://... o sube una imagen"
                        variant="brand"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </Field>
              )}

              <Field label="Vista previa" variant="brand">
                <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                  {imageFile ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-carbon-200 bg-white">
                      <img src={URL.createObjectURL(imageFile)} alt="" className="h-full w-full object-contain" />
                    </span>
                  ) : form.image ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-carbon-200 bg-white">
                      <img src={form.image} alt="" className="h-full w-full object-contain" />
                    </span>
                  ) : (
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradientFor(previewSeed)} text-white`}>
                      <Tile className="h-5 w-5" />
                    </span>
                  )}
                  <div>
                    <p className="font-bold text-carbon-950">{form.name.trim() || `Nombre de la ${entity}`}</p>
                    <p className="text-xs text-carbon-500">
                      {isModel
                        ? `${brands.find((b) => String(b.id) === form.brand_id)?.name ?? 'Sin marca'}${form.year ? ` · ${form.year}` : ''}`
                        : 'Fabricante de motocicletas'}
                    </p>
                  </div>
                </div>
              </Field>
            </>
          ) : (
            <>
              {isModel && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Marca *" variant="brand">
                    <Select value={form.brand_id || ''} onChange={(e) => setForm({ ...form, brand_id: e.target.value })} required variant="brand">
                      <option value="">Selecciona…</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Año (se aplica a todas)" variant="brand">
                    <Input type="number" min={1900} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} variant="brand" placeholder="Ej. 2023" />
                  </Field>
                </div>
              )}
              <BulkNamesField value={bulkText} onChange={setBulkText} entity={entity} />
            </>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={removeConfirmed}
        loading={deleting}
        title={`Eliminar ${entity}`}
        message={
          !isModel && (confirm?.models_count ?? 0) > 0
            ? `"${confirm?.name ?? ''}" tiene ${confirm?.models_count} modelo(s) asociado(s). Elimínalos o reasíglos antes de borrar la marca.`
            : `¿Seguro que quieres eliminar "${confirm?.name ?? ''}"? Esta acción no se puede deshacer.`
        }
      />
    </div>
  )
}