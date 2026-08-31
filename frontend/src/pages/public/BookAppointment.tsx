import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { useAuth } from '../../auth/AuthContext'
import { Reveal } from '../../components/Reveal'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { HeroBg } from '../../components/HeroBg'

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

function waLink(phone: string, text: string) {
  const clean = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
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
  const { workshop_phone: sitePhone } = useSiteInfo()

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

  const inputCls = 'w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15'
  const phoneDisplay = shopPhone || sitePhone || '+57 300 123 4567'

  return (
    <div className="bg-gray-50">
      {/* ──── HERO ──── */}
      <section className="relative overflow-hidden bg-white pb-10 pt-14 md:pt-20">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />

        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl text-center md:text-left">
              <p className="text-sm font-bold uppercase tracking-widest text-orange-500">Agenda tu revisión</p>
              <h1 className="mt-2 text-3xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
                {hero.slides?.[0]?.title ? <>{hero.slides[0].title}</> : <>¿Listo para revisar <br className="hidden md:block" /><span className="gradient-text">tu moto?</span></>}
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-500">
                {hero.slides?.[0]?.subtitle || 'Completa el formulario y agenda tu cita con nuestros expertos. Tu moto estará en las mejores manos.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-5 md:justify-start">
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">🔧</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Atención profesional</p>
                    <p className="text-xs text-gray-400">Técnicos certificados y con experiencia.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">🕐</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Agenda flexible</p>
                    <p className="text-xs text-gray-400">Elige el día y la hora que mejor te convengan.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">🛡️</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Confianza y calidad</p>
                    <p className="text-xs text-gray-400">Repuestos originales y servicio garantizado.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative shrink-0">
              <div className="relative h-[220px] w-[320px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 sm:h-[280px] sm:w-[400px] md:h-[320px] md:w-[460px]">
                {hero.images && hero.images.length > 0 ? (
                  <HeroBg images={hero.images} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-4.6-4.6a2 2 0 00-2.8 0L6 18" /></svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──── FORM + SIDEBAR ──── */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Formulario */}
          <Reveal className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">1</span>
                <h2 className="text-lg font-bold text-gray-900">Datos de tu cita</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Juan Pérez" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ejemplo@correo.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 300 123 4567" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Servicio</label>
                    <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setCustomService(e.target.value === '__other') }} className={inputCls}>
                      <option value="">Selecciona un servicio</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}{s.price ? ` · $${s.price.toLocaleString('es-CO')}` : ''}</option>
                      ))}
                      <option value="__other">Otro</option>
                    </select>
                    {customService && (
                      <input value={customType} onChange={(e) => setCustomType(e.target.value)} required className={`${inputCls} mt-2`} placeholder="Describe el servicio" />
                    )}
                  </div>
                  {loggedIn && motorcycles.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Mi moto</label>
                      <select value={motorcycleId} onChange={(e) => setMotorcycleId(e.target.value)} className={inputCls}>
                        <option value="">Sin especificar</option>
                        {motorcycles.map((m) => (
                          <option key={m.id} value={m.id}>
                            {[m.nickname, m.brand?.name, m.model?.name, m.plate].filter(Boolean).join(' · ') || `Moto #${m.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {loggedIn && motorcycles.length === 0 && (
                    <div className="sm:col-span-2">
                      <a href="/panel/garaje" className="text-xs font-semibold text-orange-500 hover:underline">
                        Aún no tienes motos registradas · Añadir a mi garaje →
                      </a>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Hora</label>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notas adicionales <span className="text-gray-400">(opcional)</span></label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Cuéntanos algo importante sobre tu moto o el servicio que necesitas..."
                    className={inputCls}
                    maxLength={300}
                  />
                  <p className="mt-1 text-right text-xs text-gray-400">{notes.length} / 300</p>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {message && (
                  <div className="rounded-xl bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-700">{message}</p>
                    {shopPhone && (
                      <a
                        href={waLink(shopPhone, `Hola! Quiero confirmar mi cita para ${customService ? customType || 'un servicio' : 'el servicio'} el ${date} a las ${time}.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                        Confirmar por WhatsApp
                      </a>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-xl disabled:opacity-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  {submitting ? 'Agendando...' : 'Confirmar cita'}
                </button>
              </form>
            </div>
          </Reveal>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* ¿Qué puedes esperar? */}
            <Reveal delay={100}>
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-gray-900">¿Qué puedes esperar?</h3>
                <div className="mt-4 space-y-4">
                  {[
                    { icon: '🔧', t: 'Revisión profesional', d: 'Diagnóstico completo de tu moto.' },
                    { icon: '🕐', t: 'Agenda sin demoras', d: 'Te asignamos el horario ideal para ti.' },
                    { icon: '📋', t: 'Hoja de vida digital', d: 'Registramos el historial de tu moto para tu tranquilidad.' },
                  ].map((b) => (
                    <div key={b.t} className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-base">{b.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{b.t}</p>
                        <p className="text-xs text-gray-500">{b.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Garantía */}
            <Reveal delay={150}>
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-xl shadow-orange-500/25">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">🛡️</span>
                  <div>
                    <h3 className="font-black">Servicio con garantía</h3>
                    <p className="text-sm text-white/85">Respaldamos nuestro trabajo y los repuestos instalados.</p>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Queue info */}
            {queueLoading && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-gray-900">Tu turno estimado</h3>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
                  Calculando tu posición...
                </div>
              </div>
            )}
            {queue && (
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-gray-900">Tu turno estimado</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Posición</span><span className="font-black text-orange-600">#{queue.turn}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Trabajos antes</span><span className="font-semibold text-gray-900">{queue.prior_jobs}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Duración</span><span className="font-semibold text-gray-900">{queue.estimated_minutes >= 60 ? `${(queue.estimated_minutes / 60).toFixed(1).replace('.0', '')} h` : `${queue.estimated_minutes} min`}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Mecánicos</span><span className="font-semibold text-gray-900">{queue.available_mechanics}</span></div>
                </div>
                {queue.big_job && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold">Trabajo extenso:</span> este servicio toma varias horas.
                    {queue.same_day_feasible ? ' Cabe el mismo día.' : ` Turno del día ${queue.days_out + 1}.`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ──── CTA WHATSAPP ──── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">🎧</div>
              <div>
                <h2 className="text-lg font-black text-gray-900">¿Prefieres hablar con alguien?</h2>
                <p className="text-sm text-gray-500">Escríbenos o llámanos y te ayudamos a agendar tu cita.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={waLink(phoneDisplay, 'Hola! Quiero agendar una cita para mi moto.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-5 py-3 text-sm font-bold text-white shadow-md shadow-green-500/25 transition hover:bg-green-600 hover:shadow-lg"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                WhatsApp
                <span className="font-normal text-white/80">{phoneDisplay}</span>
              </a>
              <a
                href={`tel:${phoneDisplay.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition hover:border-orange-300 hover:text-orange-600"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                Llamar ahora
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
