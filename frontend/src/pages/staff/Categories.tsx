import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { SectionHeader } from '../../components/ui'
import { Field, Input, SearchInput } from '../../components/ui/form'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { DataTable, type Column } from '../../components/ui/table'
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_NAMES,
  CategoryIcon,
} from '../../lib/categoryIcons'
import { gradientFor } from '../../lib/gradients'
import { BulkToggle, BulkNamesField, parseBulkNames } from '../../components/staff/BulkFields'

interface Category {
  id: number
  name: string
  slug?: string
  icon?: string | null
  products_count?: number
}

const PER_PAGE = 10

export default function Categories() {
  const toast = useToast().toast
  const [items, setItems] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [confirm, setConfirm] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<{ name: string; icon: string }>({ name: '', icon: '' })
  const [bulk, setBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const load = useCallback(async () => {
    const data = await api<Category[]>('/staff/catalog/categories')
    setItems(data)
  }, [])

  useEffect(() => { load().catch(() => {}) }, [load])

  useEffect(() => { setPage(1) }, [search])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => `${c.name} ${c.slug ?? ''}`.toLowerCase().includes(q))
  }, [items, search])

  const withProducts = items.filter((c) => (c.products_count ?? 0) > 0).length

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, lastPage)
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Categoría',
      render: (c) => (
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradientFor(String(c.id) + c.name)} text-white`}>
            <CategoryIcon name={c.icon ?? null} className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold text-carbon-950">{c.name}</p>
            <p className="text-xs text-carbon-400">{c.icon ? `Icono: ${CATEGORY_ICON_LABELS[c.icon] || c.icon}` : 'Sin icono'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'products',
      header: 'Productos',
      render: (c) => (
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
          {c.products_count ?? 0} {c.products_count === 1 ? 'producto' : 'productos'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEdit(c)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <button
            onClick={() => setConfirm(c)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Borrar
          </button>
        </div>
      ),
    },
  ]

  function openNew() {
    setEditing(null)
    setForm({ name: '', icon: '' })
    setBulk(false)
    setBulkText('')
    setOpen(true)
  }
  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, icon: c.icon || '' })
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
          try {
            await api('/staff/catalog/categories', { method: 'POST', body: JSON.stringify({ name, icon: form.icon || null }) })
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
          toast.success(`${created} categorías creadas`)
        }
        return
      }
      const payload = { name: form.name, icon: form.icon || null }
      if (editing) {
        await api(`/staff/catalog/categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Categoría actualizada')
      } else {
        await api('/staff/catalog/categories', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Categoría creada')
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
      await api(`/staff/catalog/categories/${confirm.id}`, { method: 'DELETE' })
      toast.success('Categoría eliminada')
      setConfirm(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        title="Categorías"
        subtitle="Agrupaciones de productos y servicios que se muestran en la tienda."
        variant="brand"
        action={
          <button onClick={openNew} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]">
            <Plus className="h-4 w-4" />
            Nueva categoría
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-carbon-200 bg-white px-3 py-1.5 text-sm font-bold text-carbon-950">{items.length} · Total</span>
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">{withProducts} · Con productos</span>
          <span className="rounded-full border border-carbon-200 bg-carbon-50 px-3 py-1.5 text-sm font-bold text-carbon-600">{items.length - withProducts} · Vacías</span>
          {search.trim() && <span className="text-sm text-carbon-500">· {filtered.length} encontradas</span>}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar categorías…" variant="brand" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-300 bg-white py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CategoryIcon name={null} className="h-7 w-7" />
          </span>
          <p className="mt-3 font-bold text-carbon-950">{search.trim() ? 'Sin coincidencias.' : 'Aún no hay categorías.'}</p>
          <p className="mt-1 text-sm text-carbon-500">
            {search.trim() ? 'Prueba con otra búsqueda.' : 'Crea la primera categoría para agrupar tus productos.'}
          </p>
          {!search.trim() && (
            <button onClick={openNew} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97]">
              <Plus className="h-4 w-4" />
              Nueva categoría
            </button>
          )}
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
          rowKey={(c) => c.id}
        />
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        subtitle={editing ? editing.name : 'Define el nombre y el icono que la representarán en la tienda.'}
        variant="brand"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button type="submit" form="category-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar cambios' : bulk ? 'Crear todas' : 'Crear categoría'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={save} className="space-y-4">
          {!editing && (
            <div className="flex items-center justify-between gap-3">
              <BulkToggle bulk={bulk} onChange={setBulk} />
              {bulk && <p className="text-xs text-carbon-400">Una categoría por línea.</p>}
            </div>
          )}
          {(!bulk || editing) && (
            <Field label="Nombre *" variant="brand">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required variant="brand" placeholder="Ej. Cascos, Aceites, Repuestos…" />
            </Field>
          )}

          <Field label={bulk && !editing ? 'Icono (se aplica a todas)' : 'Icono'} variant="brand">
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              <button
                type="button"
                onClick={() => setForm({ ...form, icon: '' })}
                title="Sin icono"
                className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  !form.icon ? 'border-brand-400 bg-brand-600 text-white' : 'border-carbon-200 bg-white text-carbon-500 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                <span className="text-base font-bold">—</span>
              </button>
              {CATEGORY_ICON_NAMES.map((name) => {
                const Icon = CATEGORY_ICONS[name]
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setForm({ ...form, icon: name })}
                    title={CATEGORY_ICON_LABELS[name]}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                      form.icon === name
                        ? 'border-brand-400 bg-brand-600 text-white'
                        : 'border-carbon-200 bg-white text-carbon-500 hover:border-brand-300 hover:bg-brand-50'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </button>
                )
              })}
            </div>
          </Field>

          {bulk && !editing ? (
            <BulkNamesField value={bulkText} onChange={setBulkText} entity="categoría" />
          ) : (
            <Field label="Vista previa" variant="brand">
              <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                  form.name.trim() ? gradientFor(form.name.trim()) : 'from-carbon-400 to-carbon-500'
                } text-white`}>
                  <CategoryIcon name={form.icon || null} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-carbon-950">{form.name.trim() || 'Nombre de la categoría'}</p>
                  <p className="text-xs text-carbon-500">Así aparecerá la tarjeta en la tienda</p>
                </div>
              </div>
            </Field>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={removeConfirmed}
        loading={deleting}
        title="Eliminar categoría"
        message={
          (confirm?.products_count ?? 0) > 0
            ? `"${confirm?.name ?? ''}" tiene ${confirm?.products_count} producto(s). Asigna esos productos a otra categoría antes de eliminarla.`
            : `¿Seguro que quieres eliminar "${confirm?.name ?? ''}"? Esta acción no se puede deshacer.`
        }
      />
    </div>
  )
}