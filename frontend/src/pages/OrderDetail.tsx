import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { api, apiBlob } from '../lib/api'
import BackLink from '../components/BackLink'
import type { OrderItem, OrderLabor, OrderTimeline, WorkOrderDetail } from '../lib/types'
import { ConfirmDialog } from '../components/ui/modal'
import { useToast } from '../lib/toast'

interface Photo {
  id: number
  caption?: string
  type: string
  url: string
  created_at?: string
  uploaded_by?: string
}

interface QuotationVersion {
  version: number
  status: string
  reason?: string
  created_at?: string
  created_by?: string
  parts_total: number
  labor_total: number
  subtotal: number
  tax: number
  total: number
  items?: { description: string; quantity: number; unit_price: number; total: number }[]
  labors?: { description: string; hours: number; amount: number }[]
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  awaiting_approval: 'Cotización pendiente',
  approved: 'Aprobada',
  completed: 'Completado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const theme: Record<string, { solid: string; bar: string; text: string; bg: string; dot: string }> = {
  pending: { solid: 'from-amber-400 to-amber-600', bar: 'bg-gradient-to-r from-amber-400 to-amber-300', text: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  in_progress: { solid: 'from-sky-400 to-blue-600', bar: 'bg-gradient-to-r from-sky-400 to-blue-500', text: 'text-sky-700', bg: 'bg-sky-100', dot: 'bg-sky-500' },
  awaiting_approval: { solid: 'from-orange-400 to-amber-600', bar: 'bg-gradient-to-r from-orange-400 to-amber-500', text: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  approved: { solid: 'from-emerald-400 to-green-600', bar: 'bg-gradient-to-r from-emerald-400 to-green-500', text: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  completed: { solid: 'from-emerald-400 to-green-600', bar: 'bg-gradient-to-r from-emerald-400 to-green-500', text: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  delivered: { solid: 'from-teal-400 to-cyan-600', bar: 'bg-gradient-to-r from-teal-400 to-cyan-500', text: 'text-teal-700', bg: 'bg-teal-100', dot: 'bg-teal-500' },
  cancelled: { solid: 'from-rose-400 to-red-600', bar: 'bg-gradient-to-r from-rose-400 to-red-500', text: 'text-rose-700', bg: 'bg-rose-100', dot: 'bg-rose-500' },
}

const steps = [
  { key: 'pending', label: 'Solicitud', desc: 'Recibimos tu solicitud' },
  { key: 'awaiting_approval', label: 'Cotización', desc: 'Revisa y aprueba' },
  { key: 'approved', label: 'Aprobado', desc: 'Trabajo iniciado' },
  { key: 'in_progress', label: 'En taller', desc: 'Trabajando en tu moto' },
  { key: 'delivered', label: 'Entrega', desc: 'Lista para recoger' },
]

const stepIndex: Record<string, number> = {
  pending: 0,
  awaiting_approval: 1,
  approved: 2,
  in_progress: 3,
  completed: 3,
  delivered: 4,
}

const progressPct: Record<string, number> = {
  pending: 15,
  awaiting_approval: 32,
  approved: 55,
  in_progress: 78,
  completed: 100,
  delivered: 100,
  cancelled: 100,
}

const statusDesc: Record<string, string> = {
  pending: 'La orden está pendiente de asignación. Pronto un encargado preparará tu cotización.',
  awaiting_approval: 'Ya tienes la cotización. Puedes aprobarla, pedir cambios o rechazarla.',
  approved: 'La cotización fue aprobada. El taller comenzará el trabajo en breve.',
  in_progress: 'El mecánico está trabajando en tu moto. Te avisaremos cuando termine.',
  completed: 'El servicio terminó. Tu moto está lista para la entrega.',
  delivered: '¡Servicio completado! Esperamos que todo haya salido perfecto.',
  cancelled: 'Este servicio fue cancelado. Si quieres, solicita una nueva orden.',
}

const timelineIcons: Record<string, { bg: string; icon: React.ReactNode }> = {
  completed: { bg: 'bg-emerald-100 text-emerald-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg> },
  in_progress: { bg: 'bg-sky-100 text-sky-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg> },
  assigned: { bg: 'bg-purple-100 text-purple-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  pending: { bg: 'bg-amber-100 text-amber-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg> },
  awaiting_approval: { bg: 'bg-orange-100 text-orange-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> },
  approved: { bg: 'bg-emerald-100 text-emerald-600', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg> },
}

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<WorkOrderDetail | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const [showLightbox, setShowLightbox] = useState<Photo | null>(null)
  const { toast } = useToast()
  const [toCancel, setToCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [quotes, setQuotes] = useState<QuotationVersion[]>([])
  const [quotesOpen, setQuotesOpen] = useState(false)
  const [quotesLoading, setQuotesLoading] = useState(false)

  useEffect(() => {
    api<WorkOrderDetail>(`/orders/${id}`)
      .then(setOrder)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false))
    api<Photo[]>(`/orders/${id}/photos`)
      .then(setPhotos)
      .catch(() => {})
  }, [id])

  async function loadQuotations() {
    if (quotesLoading) return
    setQuotesLoading(true)
    try {
      const res = await api<{ versions: QuotationVersion[] }>(`/orders/${id}/quotations`)
      setQuotes(res.versions || [])
    } catch {
      setQuotes([])
    } finally {
      setQuotesLoading(false)
    }
  }

  async function submitRating() {
    if (!ratingScore || ratingSubmitting) return
    setRatingSubmitting(true)
    try {
      await api(`/ratings`, {
        method: 'POST',
        body: JSON.stringify({ work_order_id: Number(id), score: ratingScore, comment: ratingComment || null }),
      })
      setRatingSaved(true)
      toast.success('¡Gracias por tu valoración!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar tu valoración')
    } finally {
      setRatingSubmitting(false)
    }
  }

  async function downloadQuotationPdf() {
    setDownloadingPdf(true)
    try {
      const blob = await apiBlob(`/orders/${id}/quotation/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cotizacion-${order?.order_number ?? id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function cancelOrder() {
    setCancelling(true)
    try {
      const updated = await api<WorkOrderDetail>(`/orders/${id}`, { method: 'DELETE' })
      setOrder(updated)
      setToCancel(false)
      toast.success('Orden cancelada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cancelar la orden')
      setToCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  async function respond(decision: 'approved' | 'rejected' | 'modification_requested') {
    setError('')
    setActing(true)
    try {
      const updated = await api<WorkOrderDetail>(`/orders/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      })
      setOrder(updated)
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al responder')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <div className="space-y-4">
          <div className="h-6 w-32 animate-pulse rounded-lg bg-carbon-100 dark:bg-carbon-200" />
          <div className="h-56 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            <div className="h-72 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
            <div className="h-64 animate-pulse rounded-2xl bg-carbon-100 dark:bg-carbon-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!order || error) return <div className="p-8 text-red-600">{error || 'Orden no encontrada'}</div>

  const currency = (n: number) => '$' + n.toLocaleString('es-CO')
  const effectiveStatus = order.quotation_status === 'awaiting_approval' ? 'awaiting_approval' : order.status
  const th = theme[effectiveStatus] ?? theme.pending
  const statusLabel = order.quotation_status === 'awaiting_approval' ? 'Cotización pendiente' : statusLabels[order.status] || order.status
  const pct = progressPct[effectiveStatus] ?? 0
  const createdDate = order.created_at ? new Date(order.created_at) : null
  const cancelled = effectiveStatus === 'cancelled'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 anim-fade-up">
      {/* Volver */}
      <BackLink to="/panel/servicios">Volver a Mis Servicios</BackLink>

      {/* Header hero con degradado según estado */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-md dark:bg-carbon-100 dark:border-carbon-200">
        <div className={`bg-gradient-to-br ${th.solid} p-6 text-white`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">Orden de trabajo</span>
                <span className="rounded-full bg-white/20 px-3 py-1 font-mono text-sm font-bold">{order.order_number}</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold">{order.service_type || 'Servicio general'}</h1>
              {order.motorcycle && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/90">
                  <BikeSvg />
                  <span className="font-semibold">{order.motorcycle.nickname || 'Moto sin nombre'}</span>
                  {order.motorcycle.plate && <span>· {order.motorcycle.plate}</span>}
                  {order.motorcycle.brand && <span>· {order.motorcycle.brand}</span>}
                </p>
              )}
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${th.dot}`} />
              <span className="text-carbon-800 dark:text-carbon-700">{statusLabel}</span>
            </span>
          </div>
        </div>

        {/* Progreso */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-carbon-100 dark:bg-carbon-200">
              <div className={`h-full rounded-full ${th.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-carbon-500">{pct}%</span>
          </div>

          {/* Stepper */}
          {cancelled ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <span className={`h-2 w-2 rounded-full ${th.dot}`} />
              Este servicio fue cancelado
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-5 gap-1">
              {steps.map((s, i) => {
                const idx = stepIndex[effectiveStatus] ?? 0
                const done = i < idx
                const current = i === idx
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1.5 text-center">
                    <div className="flex w-full items-center">
                      <div className={`h-0.5 flex-1 rounded-full ${i === 0 ? 'bg-transparent' : done ? 'bg-emerald-400' : 'bg-carbon-200 dark:bg-carbon-300'}`} />
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          done
                            ? 'bg-emerald-500 text-white'
                            : current
                              ? `bg-gradient-to-br ${th.solid} text-white ring-4 ring-white shadow dark:ring-black/20`
                              : 'bg-carbon-100 text-carbon-500 dark:bg-carbon-200'
                        }`}
                      >
                        {done ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : i + 1}
                      </span>
                      <div className={`h-0.5 flex-1 rounded-full ${i === steps.length - 1 ? 'bg-transparent' : done ? 'bg-emerald-400' : 'bg-carbon-200 dark:bg-carbon-300'}`} />
                    </div>
                    <p className={`text-[10px] font-semibold sm:text-[11px] ${current ? `text-carbon-900 dark:text-carbon-600` : done ? 'text-emerald-600' : 'text-carbon-400'}`}>{s.label}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Info chips */}
          <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-carbon-100 bg-carbon-50/50 p-4 dark:border-carbon-200 dark:bg-carbon-200/40 sm:grid-cols-4">
            <Chip icon={<CalendarSvg />} label="Creada" value={createdDate ? createdDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'} sub={createdDate ? createdDate.toLocaleDateString('es-CO', { year: 'numeric' }) : undefined} />
            <Chip icon={<FlashSvg />} label="Entrega estimada" value={order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}/>
            <Chip icon={<PersonSvg />} label="Mecánico" value={order.mechanic?.name || 'Sin asignar'} />
            <Chip icon={<SpeedSvg />} label="Odómetro entrada" value={order.odometer_in != null ? `${order.odometer_in.toLocaleString('es-CO')} km` : '—'} />
          </div>
        </div>
      </div>

      {/* Main content + Sidebar */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Valorar servicio */}
          {!cancelled && (effectiveStatus === 'completed' || effectiveStatus === 'delivered') && (
            <div className="overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
              <div className="bg-gradient-to-r from-brand-600 to-orange-500 px-6 py-3 text-white">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {ratingSaved ? '¡Valoración guardada!' : '¿Cómo estuvo tu servicio?'}
                </h2>
                <p className="mt-0.5 text-xs text-white/85">
                  {ratingSaved ? 'Gracias por tu opinión. Nos ayuda a mejorar.' : 'Tu opinión ayuda a otros clientes y a mejorar nuestro trabajo.'}
                </p>
              </div>
              <div className="p-5">
                {ratingSaved ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    Calificaste este servicio con {ratingScore}/5 estrellas.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRatingScore(s)}
                          aria-label={`${s} estrellas`}
                          className="transition hover:scale-110"
                        >
                          <svg
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill={s <= ratingScore ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={s <= ratingScore ? 'text-amber-400' : 'text-carbon-300 dark:text-carbon-400'}
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-bold text-carbon-800 dark:text-carbon-600">
                        {ratingScore ? `${ratingScore}/5` : 'Toca para calificar'}
                      </span>
                    </div>
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Cuéntanos cómo estuvo el servicio (opcional)"
                      className="mt-3 w-full rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
                    />
                    <button
                      onClick={submitRating}
                      disabled={!ratingScore || ratingSubmitting}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      {ratingSubmitting ? 'Guardando…' : 'Enviar valoración'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Responder cotización */}
          {order.quotation_status === 'awaiting_approval' && (
            <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm dark:border-orange-500/30 dark:bg-carbon-100">
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-3 text-white">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  Tu cotización está lista
                </h2>
                <p className="mt-0.5 text-xs text-white/85">Revísala abajo y dinos si continuamos con el trabajo.</p>
              </div>
              <div className="p-5">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas para el taller (opcional)"
                  className="w-full rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
                />
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <button onClick={() => respond('approved')} disabled={acting} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.97] disabled:opacity-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    Aprobar e iniciar
                  </button>
                  <button onClick={() => respond('modification_requested')} disabled={acting} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.97] disabled:opacity-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    Pedir cambios
                  </button>
                  <button onClick={() => respond('rejected')} disabled={acting} className="rounded-xl border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 active:scale-[0.97] disabled:opacity-50 dark:border-red-400/40">
                    Rechazar
                  </button>
                </div>
                {order.customer_response_notes && (
                  <p className="mt-3 rounded-lg bg-carbon-50 px-3 py-2 text-xs italic text-carbon-500 dark:bg-carbon-200 dark:text-carbon-400">
                    Tu última respuesta: {order.customer_response_notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cotización */}
          {(order.items.length > 0 || order.labors.length > 0) && (
            <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold text-carbon-900 dark:text-carbon-700">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
                  Cotización
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadQuotationPdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-200 px-3 py-1.5 text-xs font-semibold text-carbon-700 transition hover:bg-carbon-50 disabled:opacity-50 dark:border-carbon-200 dark:text-carbon-500 dark:hover:bg-carbon-200"
                  >
                    {downloadingPdf ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-carbon-300 border-t-carbon-600 dark:border-carbon-400 dark:border-t-carbon-100" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    )}
                    {downloadingPdf ? 'Generando…' : 'Descargar PDF'}
                  </button>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${themedBadge(order.quotation_status)}`}>
                    {quotationLabel(order.quotation_status)}
                  </span>
                </div>
              </div>

              {order.items.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-carbon-400">Repuestos</h3>
                  <div className="mt-2 overflow-hidden rounded-xl border border-carbon-100 dark:border-carbon-200">
                    {order.items.map((i: OrderItem, idx: number) => (
                      <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx % 2 === 0 ? 'bg-white dark:bg-carbon-100' : 'bg-carbon-50/60 dark:bg-carbon-200/40'}`}>
                        <span className="flex-1 text-carbon-700 dark:text-carbon-500">{i.description}</span>
                        <span className="text-xs text-carbon-400">x{i.quantity} · {currency(i.unit_price)}</span>
                        <span className="w-24 text-right font-semibold text-carbon-900 dark:text-carbon-600">{currency(i.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.labors.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-carbon-400">Mano de obra</h3>
                  <div className="mt-2 overflow-hidden rounded-xl border border-carbon-100 dark:border-carbon-200">
                    {order.labors.map((l: OrderLabor, idx: number) => (
                      <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx % 2 === 0 ? 'bg-white dark:bg-carbon-100' : 'bg-carbon-50/60 dark:bg-carbon-200/40'}`}>
                        <span className="flex-1 text-carbon-700 dark:text-carbon-500">{l.description} <span className="text-xs text-carbon-400">({l.hours} h)</span></span>
                        <span className="w-24 text-right font-semibold text-carbon-900 dark:text-carbon-600">{currency(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white">
                <span className="text-sm font-semibold text-white/90">Total a pagar</span>
                <span className="text-xl font-bold">{currency(order.quotation_total)}</span>
              </div>
            </div>
          )}

          {/* Historial de cotizaciones */}
          <div className="rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <button
              onClick={() => {
                setQuotesOpen((v) => !v)
                if (!quotesOpen && quotes.length === 0) loadQuotations()
              }}
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <h2 className="flex items-center gap-2 text-lg font-bold text-carbon-900 dark:text-carbon-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 1010 10H12V2z" /><path d="M14 8h6a6 6 0 00-6-6v6z" /></svg>
                Historial de cotizaciones
                {quotesLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-carbon-300 border-t-brand-600" />}
              </h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-carbon-400 transition-transform ${quotesOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {quotesOpen && (
              <div className="border-t border-carbon-100 px-6 py-4 dark:border-carbon-200">
                {quotes.length === 0 ? (
                  <p className="text-sm text-carbon-400">
                    {quotesLoading ? 'Cargando versiones…' : 'No hay versiones anteriores de la cotización.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((v) => (
                      <div key={v.version} className="rounded-xl border border-carbon-100 p-4 dark:border-carbon-200">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-carbon-900 dark:text-carbon-600">Versión {v.version}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${themedBadge(v.status)}`}>{quotationLabel(v.status)}</span>
                          <span className="ml-auto text-xs text-carbon-400">
                            {v.created_at ? new Date(v.created_at).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            {v.created_by ? ` · por ${v.created_by}` : ''}
                          </span>
                        </div>
                        {v.reason && <p className="mt-2 text-sm italic text-carbon-500">“{v.reason}”</p>}
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">Repuestos</p>
                            <p className="font-semibold text-carbon-800 dark:text-carbon-600">{currency(v.parts_total)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">Mano de obra</p>
                            <p className="font-semibold text-carbon-800 dark:text-carbon-600">{currency(v.labor_total)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">Impuestos</p>
                            <p className="font-semibold text-carbon-800 dark:text-carbon-600">{currency(v.tax)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">Total</p>
                            <p className="font-bold text-brand-600">{currency(v.total)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Descripción / diagnóstico */}
          <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <h2 className="flex items-center gap-2 text-lg font-bold text-carbon-900 dark:text-carbon-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>
              Descripción del servicio
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-carbon-600 dark:text-carbon-500">
              {order.diagnosis || 'El encargado aún no ha generado la cotización para esta orden.'}
            </p>
          </div>

          {/* Historial */}
          {order.timeline.length > 0 && (
            <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
              <h2 className="flex items-center gap-2 text-lg font-bold text-carbon-900 dark:text-carbon-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Historial de la orden
              </h2>
              <div className="mt-5">
                {order.timeline.map((t: OrderTimeline, idx: number) => {
                  const isLast = idx === order.timeline.length - 1
                  const tl = timelineIcons[t.status] ?? timelineIcons.pending
                  const tDate = t.created_at ? new Date(t.created_at) : null
                  return (
                    <div key={idx} className="relative flex gap-4">
                      {!isLast && <div className="absolute left-[15px] top-10 h-[calc(100%-16px)] w-px bg-carbon-200 dark:bg-carbon-300" />}
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tl.bg}`}>{tl.icon}</div>
                      <div className={`flex-1 ${isLast ? '' : 'pb-6'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold capitalize text-carbon-800 dark:text-carbon-600">{t.status.replace(/_/g, ' ')}</span>
                          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(t.status)}`}>{statusLabels[t.status] || t.status}</span>
                        </div>
                        {t.comment && <p className="mt-1 text-sm text-carbon-500">“{t.comment}”</p>}
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-carbon-400">
                          {tDate && <span>{tDate.toLocaleDateString('es-CO')} {tDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {t.changed_by && <span>· por {t.changed_by}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fotos */}
          {photos.length > 0 && (
            <div className="rounded-2xl border border-carbon-200 bg-white p-6 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
              <h2 className="flex items-center gap-2 text-lg font-bold text-carbon-900 dark:text-carbon-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                Fotografías del servicio
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <button key={p.id} onClick={() => setShowLightbox(p)} className="group overflow-hidden rounded-xl border border-carbon-200 text-left">
                    <img src={p.url} alt={p.caption || 'Foto'} className="h-32 w-full object-cover transition duration-300 group-hover:scale-105" />
                    {p.caption && <div className="bg-white px-2 py-1 text-xs text-carbon-600 dark:bg-carbon-100 dark:text-carbon-400">{p.caption}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Estado actual */}
          <div className="rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <h3 className="flex items-center gap-2 text-sm font-bold text-carbon-900 dark:text-carbon-700">
              <span className={`h-2 w-2 rounded-full ${th.dot}`} />
              Estado actual
            </h3>
            <div className={`mt-3 rounded-xl ${th.bg} p-4`}>
              <p className={`text-sm font-bold ${th.text}`}>{statusLabel}</p>
              <p className="mt-1 text-xs text-carbon-600 dark:text-carbon-400">{statusDesc[effectiveStatus] || ''}</p>
            </div>
            {order.mechanic && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-carbon-50 p-3 dark:bg-carbon-200/40">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials(order.mechanic.name)}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">Tu mecánico</p>
                  <p className="truncate text-sm font-semibold text-carbon-800 dark:text-carbon-600">{order.mechanic.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Información de la orden */}
          <div className="rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
            <h3 className="flex items-center gap-2 text-sm font-bold text-carbon-900 dark:text-carbon-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              Información de la orden
            </h3>
            <div className="mt-3 space-y-3">
              <Row icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>} label="N° de orden" value={order.order_number} />
              <Row icon={<WrenchSvg title />} label="Tipo de servicio" value={order.service_type || '—'} />
              <Row icon={<BikeSvg />} label="Vehículo" value={order.motorcycle?.nickname || 'Sin moto registrada'} />
              <Row icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>} label="Placa" value={order.motorcycle?.plate || '—'} />
              <Row icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>} label="Marca" value={order.motorcycle?.brand || '—'} />
              <Row icon={<CalendarSvg />} label="Fecha de creación" value={createdDate ? createdDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              <Row icon={<FlashSvg />} label="Entrega estimada" value={order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Por definir'} />
            </div>
          </div>
        {/* Cancelar (solo si sigue pendiente) */}
          {order.status === 'pending' && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 dark:border-rose-500/20 dark:bg-rose-500/5">
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">¿Cambiaste de opinión?</h3>
              <p className="mt-1 text-xs text-carbon-500">
                Si el taller aún no asignó esta orden, puedes cancelarla. Se conserva tu histórico.
              </p>
              <button
                onClick={() => setToCancel(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-[0.98] dark:border-rose-400/40 dark:hover:bg-rose-500/10"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Cancelar orden
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmar cancelación */}
      <ConfirmDialog
        open={toCancel}
        onClose={() => setToCancel(false)}
        onConfirm={cancelOrder}
        title="Cancelar orden"
        message={`¿Seguro que quieres cancelar la orden ${order.order_number}? Solo puedes cancelarla mientras esté pendiente de asignación.`}
        confirmLabel="Cancelar orden"
        loading={cancelling}
      />
      {showLightbox &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowLightbox(null)}>
            <div className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <img src={showLightbox.url} alt={showLightbox.caption || 'Foto'} className="max-h-[80vh] rounded-xl" />
              {showLightbox.caption && <p className="mt-2 text-center text-sm text-white">{showLightbox.caption}</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function themedBadge(quotation_status: string): string {
  switch (quotation_status) {
    case 'awaiting_approval': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300'
    case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
    case 'modification_requested': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    default: return 'bg-carbon-100 text-carbon-600 dark:bg-carbon-200 dark:text-carbon-400'
  }
}

function quotationLabel(s: string): string {
  switch (s) {
    case 'awaiting_approval': return 'En revisión'
    case 'approved': return 'Aprobada'
    case 'rejected': return 'Rechazada'
    case 'modification_requested': return 'Con ajustes'
    default: return 'Borrador'
  }
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    awaiting_approval: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    delivered: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  }
  return map[status] ?? map.pending
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function Chip({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-carbon-100 dark:text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-carbon-400">{label}</p>
        <p className="truncate text-sm font-semibold text-carbon-800 dark:text-carbon-600">{value}</p>
        {sub && <p className="text-[11px] text-carbon-400">{sub}</p>}
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">{label}</p>
        <p className="truncate text-sm font-semibold text-carbon-800 dark:text-carbon-600">{value}</p>
      </div>
    </div>
  )
}

function CalendarSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
}

function FlashSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
}

function PersonSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}

function SpeedSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
}

function BikeSvg() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M15 6l-2.5 6H9.5a3.5 3.5 0 000 3.5h9A3.5 3.5 0 0015 11a3.5 3.5 0 00-3.5 3.5" /></svg>
}

function WrenchSvg({ title }: { title?: boolean }) {
  return <svg width={title ? 15 : 14} height={title ? 15 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}