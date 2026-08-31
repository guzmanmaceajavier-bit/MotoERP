import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import type { Motorcycle } from '../lib/types'
import { Modal } from './ui/modal'

interface ServiceOption {
  id: number
  name: string
  description?: string
  price?: number | string
  category?: string | null
  estimated_minutes?: number | null
  is_active?: boolean
}

interface BikeCard {
  value: string
  title: string
  sub: string
  gradient: string
}

const MOTO_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
]

export default function NewServiceRequestModal({
  open,
  onClose,
  onCreated,
  initialMotoId,
}: {
  open: boolean
  onClose: () => void
  onCreated: (orderNumber: string) => void
  initialMotoId?: number | null
}) {
  const [services, setServices] = useState<ServiceOption[]>([])
  const [motos, setMotos] = useState<Motorcycle[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [customService, setCustomService] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [motoId, setMotoId] = useState<string>('none')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [category, setCategory] = useState<string | 'all'>('all')
  const [serviceQuery, setServiceQuery] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{ order_number: string; service_type: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setServiceIds([])
    setIsCustom(false)
    setCustomService('')
    setNotes('')
    setMotoId('none')
    setError('')
    setCreated(null)
    setFetchError('')
    setCategory('all')
    setServiceQuery('')
    setLoading(true)
    Promise.all([
      api<ServiceOption[]>('/services'),
      api<Motorcycle[]>('/motorcycles'),
    ])
      .then(([s, m]) => {
        setServices(s)
        setMotos(m)
        const initial = m.find((mo) => initialMotoId != null && mo.id === initialMotoId)
        if (initial) setMotoId(String(initial.id))
        else if (m.length > 0) setMotoId(String(m[0].id))
      })
      .catch((err: unknown) => setFetchError(err instanceof Error ? err.message : 'No se pudieron cargar las opciones'))
      .finally(() => setLoading(false))
  }, [open])

  const selectedServices = services.filter((s) => serviceIds.includes(s.id))
  const serviceName = [...selectedServices.map((s) => s.name), ...(isCustom && customService.trim() ? [customService.trim()] : [])].join(', ')
  const selectedMoto = motos.find((m) => String(m.id) === motoId)

  // Agrupar servicios por categoría para el desplegable
  const serviceGroups = useMemo(() => {
    const map = new Map<string, ServiceOption[]>()
    for (const s of services) {
      const key = s.category?.trim() || 'Servicios'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }))
  }, [services])

  const categories = useMemo(() => {
    const seen: string[] = []
    for (const g of serviceGroups) if (!seen.includes(g.label)) seen.push(g.label)
    return seen
  }, [serviceGroups])

  const visibleServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase()
    const list = category === 'all' ? services : services.filter((s) => (s.category?.trim() || 'Servicios') === category)
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list
  }, [services, category, serviceQuery])

  const bikeCards: BikeCard[] = [
    ...motos.map((m, i) => ({
      value: String(m.id),
      title: m.nickname || 'Moto sin nombre',
      sub: [m.brand?.name, m.plate].filter(Boolean).join(' • '),
      gradient: MOTO_GRADIENTS[i % MOTO_GRADIENTS.length],
    })),
    {
      value: 'none',
      title: 'No tengo la moto registrada aquí',
      sub: 'La describo en los detalles / solo quiero una consulta',
      gradient: 'from-carbon-400 to-carbon-600',
    },
  ]

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!serviceName) {
      setError('Selecciona un servicio o describe el que necesitas.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await api<{ id: number; order_number: string; service_type: string }>('/request-service', {
        method: 'POST',
        body: JSON.stringify({
          motorcycle_id: motoId === 'none' ? null : Number(motoId),
          service_type: serviceName,
          notes: notes.trim() || null,
        }),
      })
      setCreated({ order_number: res.order_number, service_type: res.service_type })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar el servicio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? '¡Solicitud recibida!' : 'Nueva orden de servicio'}
      subtitle={
        created
          ? 'El taller preparará la cotización y te notificará.'
          : 'Elige el servicio y la moto. Recibirás la cotización para aprobar.'
      }
      size="lg"
      footer={
        created ? (
          <button
            onClick={() => {
              onCreated(created.order_number)
              onClose()
            }}
            className="btn-primary !text-sm"
          >
            Entendido
          </button>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost !text-sm">Cancelar</button>
            <button
              onClick={submit}
              disabled={submitting || !!fetchError}
              className="btn-primary !text-sm"
            >
              {submitting ? 'Enviando…' : 'Solicitar servicio'}
            </button>
          </>
        )
      }
    >
      {created ? (
        <div className="py-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h4 className="mt-5 text-xl font-bold text-carbon-900 dark:text-carbon-700">Tu solicitud fue recibida</h4>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            {created.order_number}
          </div>
          <p className="mt-4 max-w-sm text-sm text-carbon-500">
            Registramos el servicio <span className="font-semibold text-carbon-700 dark:text-carbon-400">“{created.service_type}”</span>. Cuando el taller prepare tu cotización te llegará una notificación.
          </p>
          <p className="mt-2 text-xs text-carbon-400">Lo encontrarás en “En seguimiento”.</p>
        </div>
      ) : fetchError ? (
        <div className="py-10 text-center">
          <p className="text-sm text-red-600">{fetchError}</p>
        </div>
      ) : loading ? (
        <div className="space-y-4 py-2">
          <div className="h-5 w-32 animate-pulse rounded bg-carbon-100 dark:bg-carbon-200" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
            ))}
          </div>
          <div className="h-5 w-32 animate-pulse rounded bg-carbon-100 dark:bg-carbon-200" />
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          {/* Servicio */}
          <section>
            <SectionTitle step={1} title="¿Qué servicio necesitas?" />
            {services.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-carbon-200 p-4 text-sm text-carbon-500 dark:border-carbon-200">
                No hay servicios publicados aún. Describe el que necesitas abajo.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Chips por categoría */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategory('all')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      category === 'all'
                        ? 'bg-brand-600 text-white shadow'
                        : 'bg-carbon-100 text-carbon-600 hover:bg-carbon-200 dark:bg-carbon-200 dark:text-carbon-500'
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        category === c
                          ? 'bg-brand-600 text-white shadow'
                          : 'bg-carbon-100 text-carbon-600 hover:bg-carbon-200 dark:bg-carbon-200 dark:text-carbon-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {/* Buscador */}
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-carbon-400">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
                  </span>
                  <input
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    placeholder="Buscar servicio por nombre…"
                    className="w-full rounded-xl border border-carbon-200 bg-white py-2.5 pl-9 pr-3 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
                  />
                </div>

                {visibleServices.length > 0 ? (
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {visibleServices.map((s) => {
                      const isSel = serviceIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setServiceIds((prev) => (prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]))
                          }}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                            isSel
                              ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/30 dark:bg-brand-500/10'
                              : 'border-carbon-200 bg-white hover:border-brand-300 hover:shadow-sm dark:border-carbon-200 dark:bg-carbon-200'
                          }`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSel ? 'border-brand-500 bg-brand-500 text-white' : 'border-carbon-200 dark:border-carbon-400'}`}>
                            {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-semibold ${isSel ? 'text-brand-700 dark:text-brand-300' : 'text-carbon-800 dark:text-carbon-600'}`}>{s.name}</span>
                            {s.estimated_minutes ? <span className="block text-xs text-carbon-400">~ {s.estimated_minutes} min</span> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-carbon-200 p-3 text-center text-xs text-carbon-500 dark:border-carbon-200">
                    Sin servicios que coincidan. Usa la opción "otro servicio".
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setIsCustom((v) => !v)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    isCustom
                      ? 'border-brand-500 bg-brand-50/60 text-brand-700 ring-2 ring-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'border-carbon-200 text-carbon-600 hover:border-brand-300 hover:bg-brand-50/40 dark:border-carbon-200 dark:text-carbon-400'
                  }`}
                >
                  + Otro servicio (lo describo)
                </button>

                {selectedServices.length > 0 && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-carbon-500">
                    Seleccionados: {selectedServices.map((s) => s.name).join(', ')} {selectedServices.length > 0 && selectedServices[0].estimated_minutes ? <span>· ~ {selectedServices.reduce((a, s) => a + (s.estimated_minutes || 0), 0)} min total</span> : null}
                  </p>
                )}

                {isCustom && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                    <textarea
                      value={customService}
                      onChange={(e) => setCustomService(e.target.value)}
                      rows={2}
                      placeholder="Ej: cambio de aceite sintético del motor y revisión de frenos"
                      className="w-full rounded-xl bg-white px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-carbon-200 dark:text-carbon-600"
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Moto */}
          <section>
            <SectionTitle step={2} title="¿Para cuál moto es?" />
            <div className="mt-3 space-y-2">
              {bikeCards.map((b) => {
                const isSel = motoId === b.value
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setMotoId(b.value)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSel
                        ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/30 dark:bg-brand-500/10'
                        : 'border-carbon-200 bg-white hover:border-brand-300 hover:shadow-sm dark:border-carbon-200 dark:bg-carbon-200'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${b.gradient} text-white shadow-sm`}>
                      <BikeIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-carbon-800 dark:text-carbon-600">{b.title}</span>
                      <span className="block truncate text-xs text-carbon-400">{b.sub || 'Moto registrada'}</span>
                    </span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSel ? 'border-brand-500 bg-brand-500 text-white' : 'border-carbon-200 dark:border-carbon-400'}`}>
                      {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Detalles */}
          <section>
            <SectionTitle step={3} title="Detalles (opcional)" />
            <FieldBlock>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Cuéntanos qué notas, ruidos o marcas ves en la moto. Esto ayuda al técnico."
                className="w-full rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
              />
            </FieldBlock>
          </section>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              {error}
            </p>
          )}

          {/* Resumen */}
          {(serviceName || selectedMoto) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-sm text-white">
              {serviceName && (
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <WrenchIcon />
                  {serviceName}
                </span>
              )}
              {serviceName && selectedMoto && <span className="text-white/60">·</span>}
              {selectedMoto && motoId !== 'none' && (
                <span className="inline-flex items-center gap-1.5 text-brand-50">
                  <BikeIcon />
                  {selectedMoto.nickname || selectedMoto.plate || 'Moto'}
                </span>
              )}
              {motoId === 'none' && <span className="text-brand-50">Sin moto registrada</span>}
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{step}</span>
      <h4 className="text-sm font-bold text-carbon-900 dark:text-carbon-600">{title}</h4>
    </div>
  )
}

function FieldBlock({ children }: { children: React.ReactNode }) {
  return <div className="mt-2.5">{children}</div>
}

function WrenchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}

function BikeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M15 6l-2.5 6H9.5a3.5 3.5 0 000 3.5h9A3.5 3.5 0 0015 11a3.5 3.5 0 00-3.5 3.5" /></svg>
}