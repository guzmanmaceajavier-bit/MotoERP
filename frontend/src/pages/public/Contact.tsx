import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Reveal } from '../../components/Reveal'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { scheduleSummary, type ScheduleInfo } from '../../lib/schedule'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { HeroBg } from '../../components/HeroBg'

interface SiteInfo extends ScheduleInfo {
  workshop_name?: string
  workshop_phone?: string
  workshop_address?: string
  workshop_email?: string
}

const steps = [
  { n: '01', title: 'Agenda tu cita', desc: 'Completa tu perfil y elige el servicio que necesitas.', icon: 'cal' },
  { n: '02', title: 'Agenda el servicio', desc: 'Elige el horario que mejor se adapte a ti.', icon: 'clock' },
  { n: '03', title: 'Sigue el avance', desc: 'Recibe actualizaciones y notificaciones de cada etapa.', icon: 'check' },
]

function StepIcon({ name, className = '' }: { name: string; className?: string }) {
  const cls = `w-6 h-6 ${className}`
  const props = { className: cls, viewBox: '0 0 24 24' as const, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const icons: Record<string, React.JSX.Element> = {
    cal: <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
    clock: <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
    check: <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>,
  }
  return icons[name] ?? null
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [site, setSite] = useState<SiteInfo | null>(null)
  const hero = useHero('contact')
  const { workshop_name: siteName } = useSiteInfo()

  usePageMeta(
    `${siteName ? siteName + ' | ' : ''}Contacto`,
    'Resuelve tus dudas, agenda una revisión o escríbenos por WhatsApp. Estamos para ayudarte.',
  )

  useEffect(() => {
    api<SiteInfo>('/site-info').then(setSite).catch(() => {})
  }, [])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.message.trim() || form.message.trim().length < 10) {
      setError('Cuéntanos un poco más (mínimo 10 caracteres).')
      return
    }
    setSubmitting(true)
    try {
      await api('/contact', { method: 'POST', body: JSON.stringify(form) })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar tu mensaje. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const addr = site?.workshop_address || 'Calle Principal #12-34, Medellín, Colombia'
  const email = site?.workshop_email || 'info@taller.com'
  const phone = site?.workshop_phone || '+57 300 123 4567'
  const summary = scheduleSummary(site)

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
              <h1 className="mt-2 text-3xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
                Estamos aquí para <br className="hidden md:block" />
                ayudarte y que te sientas <br className="hidden md:block" />
                <span className="gradient-text">cómodo</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-500">
                Resuelve tus dudas, agenda un servicio, nuestro equipo está listo para brindarte la mejor atención.
              </p>
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

      {/* ──── INFO CARDS ──── */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
              k: 'Dirección',
              v: addr,
              link: 'Ver en el mapa →',
              href: '#mapa',
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
              k: 'Teléfono / WhatsApp',
              v: phone,
              link: 'Escribir por WhatsApp →',
              href: `https://wa.me/${phone.replace(/[^0-9]/g, '')}`,
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" /></svg>,
              k: 'Correo electrónico',
              v: email,
              link: 'Enviar correo →',
              href: `mailto:${email}`,
            },
            {
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
              k: 'Horario de atención',
              v: summary ? `${summary.weekday.open} - ${summary.weekday.close}` : '09:00 - 18:00',
              link: 'Ver horarios especiales →',
              sub: summary?.saturday ? `Sábados: ${summary.saturday.open} - ${summary.saturday.close}` : 'Sábados: 8:00 - 13:00',
            },
          ].map((c, i) => (
            <Reveal key={c.k} delay={i * 70}>
              <div className="group h-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500 transition group-hover:scale-110">
                  {c.icon}
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-gray-400">{c.k}</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{c.v}</p>
                {c.sub && <p className="mt-0.5 text-xs text-gray-500">{c.sub}</p>}
                {c.href ? (
                  <a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-500 hover:underline">
                    {c.link}
                  </a>
                ) : (
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-500">{c.link}</span>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ──── FORM + BENEFITS + MAP ──── */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Formulario */}
          <Reveal>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black text-gray-900">Envíanos un mensaje</h2>
              <p className="mt-1 text-sm text-gray-500">
                Cuéntanos cómo podemos ayudarte, te responderemos lo más pronto posible.
              </p>

              {sent ? (
                <div className="flex flex-col items-center py-14 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</span>
                  <h3 className="mt-4 text-xl font-black text-gray-900">¡Mensaje enviado!</h3>
                  <p className="mt-2 max-w-sm text-gray-500">
                    Gracias {form.name.split(' ')[0] || 'amigo'}. Te contactaremos pronto.
                  </p>
                  <button onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }} className="mt-6 text-sm font-semibold text-orange-500 hover:underline">
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <input
                    value={form.name}
                    onChange={set('name')}
                    required
                    placeholder="Nombre completo"
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      required
                      placeholder="Correo electrónico"
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                    />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="Teléfono (opcional)"
                      className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                    />
                  </div>
                  <select
                    value={form.subject}
                    onChange={set('subject')}
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                  >
                    <option value="">¿En qué podemos ayudarte?</option>
                    <option value="cita">Agendar una cita</option>
                    <option value="cotizacion">Cotización / repuestos</option>
                    <option value="garantia">Garantía</option>
                    <option value="otro">Otro</option>
                  </select>
                  <textarea
                    value={form.message}
                    onChange={set('message')}
                    required
                    rows={4}
                    placeholder="Cuéntanos los detalles de tu solicitud..."
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-xl disabled:opacity-50"
                  >
                    {submitting ? 'Enviando...' : 'Enviar mensaje'}
                    {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    )}
                  </button>
                </form>
              )}
            </div>
          </Reveal>

          {/* Beneficios + Mapa */}
          <div className="space-y-6">
            <Reveal delay={100}>
              <div className="space-y-4">
                {[
                  { icon: '💬', t: 'Respuesta rápida', d: 'Atendemos tus consultas de forma ágil y efectiva.' },
                  { icon: '🔧', t: 'Atención personalizada', d: 'Te ayudamos a encontrar la mejor solución.' },
                  { icon: '🛡️', t: 'Confianza y calidad', d: 'Servicio profesional con repuestos de calidad.' },
                ].map((b) => (
                  <div key={b.t} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-lg">{b.icon}</span>
                    <div>
                      <h4 className="font-bold text-gray-900">{b.t}</h4>
                      <p className="text-sm text-gray-500">{b.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div id="mapa" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="px-5 py-3">
                  <h3 className="font-bold text-gray-900">¿Dónde estamos?</h3>
                </div>
                <div className="relative">
                  <iframe
                    title={`Mapa ${siteName || 'del taller'}`}
                    src="https://www.openstreetmap.org/export/embed.html?bbox=-74.0981%2C4.6403%2C-74.0381%2C4.6803&layer=mapnik&marker=4.6603%2C-74.0681"
                    className="h-[220px] w-full grayscale-[20%]"
                    loading="lazy"
                  />
                  <div className="flex items-center gap-2 bg-white px-5 py-3 text-sm text-gray-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {addr}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ──── 3 PASOS ──── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
            En <span className="gradient-text">3 pasos</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-500">Así de fácil agendamos tu cita o atendemos tu consulta.</p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="absolute right-5 top-5 text-5xl font-black text-gray-100 transition-all duration-300 group-hover:scale-125 group-hover:text-orange-500">{s.n}</div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25">
                  <StepIcon name={s.icon} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ──── CTA ──── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900">
          <div className="absolute inset-0 opacity-20">
            <img src="/src/assets/hero.png" alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <div className="relative flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between sm:px-12">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-black text-white md:text-3xl">
                ¿Listo para llevar tu moto <br className="hidden sm:block" />
                al siguiente nivel?
              </h2>
              <p className="mt-2 text-gray-400">Agenda tu cita ahora y deja tu moto en manos expertas.</p>
            </div>
            <a
              href="/agendar"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-xl"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              Agendar tu cita
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
