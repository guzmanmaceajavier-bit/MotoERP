import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Newspaper } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import Pagination from '../../components/Pagination'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { useToast } from '../../lib/toast'

interface PostRow {
  id: number
  title: string
  slug: string
  excerpt?: string
  content: string
  cover?: string
  is_published: boolean
  published_at?: string
  author?: { name: string } | null
}

export default function Blog() {
  const toast = useToast().toast
  const [posts, setPosts] = useState<PostRow[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PostRow | null>(null)
  const [form, setForm] = useState({ title: '', excerpt: '', content: '', cover: '', is_published: true })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [toDelete, setToDelete] = useState<PostRow | null>(null)

  async function load(page = 1) {
    const res = await api<Paginated<PostRow>>(`/staff/posts?page=${page}`)
    setPosts(res.data)
    setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  function openNew() {
    setEditing(null)
    setForm({ title: '', excerpt: '', content: '', cover: '', is_published: true })
    setShowForm(true)
  }

  function openEdit(p: PostRow) {
    setEditing(p)
    setForm({ title: p.title, excerpt: p.excerpt ?? '', content: p.content, cover: p.cover ?? '', is_published: p.is_published })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    try {
      const body = JSON.stringify(form)
      if (editing) {
        await api(`/staff/posts/${editing.id}`, { method: 'PATCH', body })
        setMsg({ type: 'ok', text: 'Publicación actualizada.' })
      } else {
        await api('/staff/posts', { method: 'POST', body })
        setMsg({ type: 'ok', text: 'Publicación creada.' })
      }
      setShowForm(false)
      await load(meta.current_page)
    } catch (err) {
      setMsg({ type: 'err', text: (err as Error).message })
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api(`/staff/posts/${toDelete.id}`, { method: 'DELETE' })
      toast.success('Publicación eliminada.')
      setToDelete(null)
      await load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
      setToDelete(null)
    }
  }

  const inputCls = 'garaje-input mt-1 block w-full'

  return (
    <div>
      {msg && (
        <div className={`mb-3 rounded-lg px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            Nueva publicación
          </button>
          <span className="text-sm text-carbon-500">{meta.total} publicaciones</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-carbon-200 bg-white p-4 transition hover:border-brand-300">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Newspaper className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-carbon-900">{p.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-carbon-100 text-carbon-500'}`}>
                    {p.is_published ? 'Publicada' : 'Borrador'}
                  </span>
                </div>
                {p.excerpt && <p className="mt-0.5 truncate text-sm text-carbon-500">{p.excerpt}</p>}
                {p.published_at && <p className="mt-0.5 text-xs text-carbon-400">{new Date(p.published_at).toLocaleDateString('es-CO')}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => openEdit(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700" title="Editar">
                <Pencil className="h-[15px] w-[15px]" />
              </button>
              <button onClick={() => setToDelete(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50" title="Eliminar">
                <Trash2 className="h-[15px] w-[15px]" />
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="py-8 text-center text-carbon-400">Sin publicaciones todavía.</p>}
      </div>

      <div className="mt-4">
        <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => load(p).catch(() => {})} />
      </div>

      {showForm && (
        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editing ? 'Editar publicación' : 'Nueva publicación'}
          subtitle="Publicaciones visibles en el blog de la web."
          variant="brand"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
                Cancelar
              </button>
              <button type="submit" form="post-form" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                Guardar publicación
              </button>
            </>
          }
        >
          <form id="post-form" onSubmit={save} className="space-y-3">
            <label className="block text-sm text-carbon-600">
              Título
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-sm text-carbon-600">
              Resumen
              <input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-sm text-carbon-600">
              Contenido
              <textarea required rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className={inputCls} />
            </label>
            <label className="block text-sm text-carbon-600">
              Portada (URL)
              <input value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} className={inputCls} placeholder="https://..." />
            </label>
            <label className="flex items-center gap-2 text-sm text-carbon-600">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Publicar en la web
            </label>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar publicación"
        message='¿Eliminar esta publicación del blog? Esta acción no se puede deshacer.'
      />
    </div>
  )
}