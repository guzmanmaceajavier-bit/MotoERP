import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { useAuth } from '../../auth/AuthContext'
import { Reveal } from '../../components/Reveal'
import PageHero from '../../components/PageHero'
import { useHero } from '../../lib/useSiteImages'

interface Motorcycle {
  id: number
  nickname?: string | null
  plate?: string | null
  brand?: { name: string } | null
  model?: { name: string } | null
}

interface QueueInfo {
  service_type?: string | null
  estimated_minutes: number
  big_job: boolean
  available_mechanics: number
  prior_jobs: number
  turn: number
  estimated_wait_minutes: number
  same_day_feasible: boolean
  days_out: number
}

export default function BookAppointment() {
  const [searchParams] = useSearchParams()
  const preselected = searchParams.get('service') || ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState<{ id: number; name: string; category?: string; estimated_minutes?: number; price?: number }[]>([])
  const [serviceId, setServiceId] = useState('')
  const [customService, setCustomService] = useState(false)
  const [customType, setCustomType] = useState('')
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [motorcycleId, setMotorcycleId] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shopPhone, setShopPhone] = useState('')
  const [queue, setQueue] = useState<QueueInfo | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const hero = useHero('book')
  const { user } = useAuth()

  usePageMeta(
    'Agenda una cita | Revisa tu moto',
    'Elige servicio, fecha y hora para tu motocicleta. Confirmamos tu cita con anticipación.',
  )

  const loggedIn = !!user

  useEffect(() => {
    ;(async () => {
      try {
        const res = await api<{ id: number; name: string; category?: string; estimated_minutes?: number; price?: number }[]>('/services')
        setServices(res)
        if (preselected) {
          const match = res.find((s) => s.name.toLowerCase() === preselected.toLowerCase())
          if (match) setServiceId(String(match.id))
        }
      } catch {
        setServices([])
      }
    })()
    api<{ workshop_phone: string }>('/site-info').then((d) => setShopPhone(d.workshop_phone)).catch(() => {})
  }, [preselected])

  useEffect(() => {
    if (!loggedIn) return
    api<Motorcycle[]>('/motorcycles').then((motos) => {
      setMotorcycles(motos)
      if (motos.length === 1) setMotorcycleId(String(motos[0].id))
    }).catch(() => {})
  }, [loggedIn])

  useEffect(() => {
    if (!date) {
      setQueue(null)
      return
    }
    const params = new URLSearchParams({ date })
    if (serviceId && serviceId !== '__other') params.set('service_id', serviceId)
    if (customService && customType) params.set('service_type', customType)
    if (!params.has('service_id') && !params.has('service_type')) {
      setQueue(null)
      return
    }
    let alive = true
    setQueueLoading(true)
    api<QueueInfo>(`/appointments/queue?${params.toString()}`)
      .then((q) => { if (alive) setQueue(q) })
      .catch(() => { if (alive) setQueue(null) })
      .finally(() => { if (alive) setQueueLoading(false) })
    return () => { alive = false }
  }, [date, serviceId, customService, customType])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    setError('')
    setSubmitting(true)
    try {
      const service_id = serviceId && serviceId !== '__other' ? Number(serviceId) : null
      const res = await api<{ queue?: QueueInfo; message?: string }>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          service_id,
          service_type: customService ? customType : undefined,
          motorcycle_id: motorcycleId ? Number(motorcycleId) : undefined,
          notes,
          date,
          time,
        }),
      })
      setMessage(res.message || '¡Cita agendada! Te contactaremos para confirmarla.')
      if (res.queue) setQueue(res.queue)
      setName(''); setEmail(''); setPhone(''); setServiceId(''); setCustomService(false); setCustomType(''); setMotorcycleId(''); setNotes(''); setDate(''); setTime('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agendar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-carbon-50">
      <PageHero
        title={
          hero.title ? (
            <>{hero.title}</>
          ) : (
            <>Listo para <span className="gradient-text">revisar tu moto</span></>
          )
        }
        subtitle={hero.subtitle || 'Elige fecha y hora para tu servicio y te confirmamos con anticipación.'}
        images={hero.images}
        badge={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">📅</span>
            <div>
              <p className="text-sm font-bold text-carbon-900">Cita confirmada</p>
              <p className="text-xs text-carbon-500">Te avisamos con anticipación</p>
            </div>
          </>
        }
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card anim-fade-up overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-carbon-100 bg-brand-50/50 px-6 py-4">
            <h2 className="flex items-center gap-2 font-bold text-carbon-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-black text-white">1</span>
              Datos de tu cita
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="garaje-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="garaje-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="garaje-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Servicio</label>
            <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setCustomService(e.target.value === '__other') }} className="garaje-input">
              <option value="">Selecciona</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.price ? ` · $${s.price.toLocaleString('es-CO')}` : ''}</option>
              ))}
              <option value="__other">Otro</option>
            </select>
            {customService && (
              <input value={customType} onChange={(e) => setCustomType(e.target.value)} required className="garaje-input mt-2" placeholder="Describe el servicio" />
            )}
          </div>
          {loggedIn && (
            <div>
              <label className="mb-1 block text-sm font-medium text-carbon-700">Mi moto</label>
              <select value={motorcycleId} onChange={(e) => setMotorcycleId(e.target.value)} className="garaje-input">
                <option value="">Sin especificar</option>
                {motorcycles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.nickname, m.brand?.name, m.model?.name, m.plate].filter(Boolean).join(' · ') || `Moto #${m.id}`}
                  </option>
                ))}
              </select>
              {motorcycles.length === 0 && (
                <a href="/panel/garaje" className="mt-1.5 block text-xs font-semibold text-brand-600 hover:underline">
                  Aún no tienes motos registradas · Añadir a mi garaje →
                </a>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="garaje-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-carbon-700">Hora</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="garaje-input" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-carbon-700">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="garaje-input" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-green-700">{message}</p>
            {shopPhone && (
              <a
                href={waLink(shopPhone, `Hola! Quiero confirmar mi cita para ${customService ? customType || 'un servicio' : 'el servicio'} el ${date} a las ${time}.`)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Confirmar por WhatsApp
              </a>
            )}
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn-primary btn-shine w-full">
          {submitting ? 'Agendando...' : 'Confirmar cita'}
        </button>
        </form>
        </div>

        {/* ── Panel lateral ── */}
        <div className="space-y-4">
          {queueLoading && (
            <div className="card lift overflow-hidden">
              <div className="border-b border-carbon-100 bg-brand-50/60 px-5 py-3">
                <h3 className="font-bold text-carbon-900">Tu turno estimado</h3>
              </div>
              <div className="flex items-center gap-2 p-5 text-sm text-carbon-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
                Calculando tu posición en la cola...
              </div>
            </div>
          )}
          {queue && (
            <div className="card lift overflow-hidden">
              <div className="border-b border-carbon-100 bg-brand-50/60 px-5 py-3">
                <h3 className="flex items-center gap-2 font-bold text-carbon-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                  Tu turno estimado
                </h3>
              </div>
              <div className="space-y-3 p-5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-carbon-600">Posición en la cola</span>
                  <span className="text-2xl font-black text-brand-600">#{queue.turn}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-carbon-600">Trabajos antes que tú</span>
                  <span className="font-semibold text-carbon-900">{queue.prior_jobs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-carbon-600">Duración estimada</span>
                  <span className="font-semibold text-carbon-900">
                    {queue.estimated_minutes >= 60
                      ? `${(queue.estimated_minutes / 60).toFixed(1).replace('.0', '')} horas`
                      : `${queue.estimated_minutes} min`}
                  </span>
                </div>
                {queue.estimated_wait_minutes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-carbon-600">Espera estimada</span>
                    <span className="font-semibold text-carbon-900">
                      {(queue.estimated_wait_minutes / 60).toFixed(1).replace('.0', '')} h
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-carbon-600">Mecánicos disponibles</span>
                  <span className="font-semibold text-carbon-900">{queue.available_mechanics}</span>
                </div>
                {queue.big_job && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-800">
                    <span className="font-semibold">Trabajo extenso:</span> este servicio toma varias horas.
                    {queue.same_day_feasible
                      ? ' Cabe el mismo día según la carga actual.'
                      : ` Quedarás en el turno del día ${queue.days_out + 1} de tu jornada disponible.`}
                  </p>
                )}
                <p className="mt-1 rounded-xl bg-brand-50 px-3 py-2.5 text-xs leading-relaxed text-brand-800">
                  {queue.turn <= 1
                    ? 'Eres el primer turno del día. Entras apenas abra el taller.'
                    : `${queue.prior_jobs} trabajo${queue.prior_jobs === 1 ? '' : 's'} queda${queue.prior_jobs === 1 ? '' : 'n'} en la cola. Te avisamos cuando se acerque tu turno.`}
                </p>
              </div>
            </div>
          )}

          <div className="card lift overflow-hidden">
            <div className="border-b border-carbon-100 bg-brand-50/60 px-5 py-3">
              <h3 className="font-bold text-carbon-900">Qué pasará después</h3>
            </div>
            <ol className="space-y-4 p-5 text-sm">
              {[
                ['Recibes confirmación', 'Te contactamos para validar fecha y hora'],
                ['Aprobación de servicios', 'Si requiere cotización, te llega al teléfono'],
                ['Hoja de vida actualizada', 'Registramos el servicio en tu garaje digital'],
              ].map(([t, d], idx) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                    {idx + 2}
                  </span>
                  <div>
                    <p className="font-semibold text-carbon-900">{t}</p>
                    <p className="text-carbon-500">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-xl shadow-brand-600/25">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">🛡️</span>
              <div>
                <h3 className="font-black">Servicio con garantía</h3>
                <p className="text-sm text-white/85">Respaldamos la mano de obra y los repuestos instalados.</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
    </div>
  )
}