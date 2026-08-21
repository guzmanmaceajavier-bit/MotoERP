import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Reveal } from '../../components/Reveal'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { scheduleSummary, type ScheduleInfo } from '../../lib/schedule'
import PageHero from '../../components/PageHero'
import { useHero } from '../../lib/useSiteImages'

interface SiteInfo extends ScheduleInfo {
  workshop_name?: string
  workshop_phone?: string
  workshop_address?: string
  workshop_email?: string
}

type IconNode = import('react').ReactNode

interface InfoCard {
  icon: IconNode
  k: string
  v: string
  sub: string
  href?: string
}

const infoIcons = [
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
]

const benefits = [
  {
    icon: '💬',
    t: 'Respuesta rápida',
    d: 'Atendemos tus consultas de forma ágil y efectiva.',
  },
  {
    icon: '🔧',
    t: 'Asesoría especializada',
    d: 'Te ayudamos a encontrar lo que necesitas.',
  },
  {
    icon: '🛡️',
    t: 'Confianza y calidad',
    d: 'Servicio profesional con repuestos de calidad.',
  },
]

const steps = [
  { n: '01', title: 'Registra tu moto', desc: 'Completa tu perfil y añade tu moto en segundos.', icon: 'user' },
  { n: '02', title: 'Agenda el servicio', desc: 'Elige el servicio y la fecha que mejor se adapte a ti.', icon: 'cal' },
  { n: '03', title: 'Sigue el avance', desc: 'Recibe actualizaciones y notificaciones de cada etapa.', icon: 'check' },
]

const inputCls =
  'w-full rounded-xl border-2 border-brand-300 bg-white px-4 py-2.5 text-carbon-900 placeholder:text-carbon-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

function StepIcon({ name, className = '' }: { name: string; className?: string }) {
  const cls = `w-6 h-6 ${className}`
  const props = { className: cls, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const icons: Record<string, React.JSX.Element> = {
    user: <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    cal: <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    check: <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  }
  return icons[name] ?? null
}

const infoCards = (site: SiteInfo | null): InfoCard[] => {
  const addr = site?.workshop_address || 'Calle Principal #12-34'
  const email = site?.workshop_email || 'info@taller.com'
  const phone = site?.workshop_phone || '+57 300 123 4567'
  const summary = scheduleSummary(site)

  const lines = ['Lunes a viernes | sin atención']
  if (summary) {
    const wk = summary.weekday
    lines[0] = `Lunes a viernes | ${wk.open} - ${wk.close}`
    const hasOpenHolidays = summary.holidays.some((h) => h.mode === 'saturday' || h.mode === 'custom' || h.open || h.close)
    if (summary.saturday || hasOpenHolidays) {
      const satLabel = summary.saturday ? 'Sábados y festivos' : 'Festivos'
      const satHours = summary.saturday ? `${summary.saturday.open} - ${summary.saturday.close}` : 'Horario especial'
      lines.push(`${satLabel} | ${satHours}`)
    } else if (summary.holidays.length > 0) {
      lines.push('Festivos | Cerrado')
    }
  }

  return [
    { icon: infoIcons[0], k: 'Dirección', v: addr, sub: 'Agenda tu visita sin cita previa.' },
    { icon: infoIcons[1], k: 'Teléfono / WhatsApp', v: phone, sub: 'Llama o escribe y te respondemos de inmediato.', href: `tel:${phone.replace(/\s/g, '')}` },
    { icon: infoIcons[2], k: 'Correo electrónico', v: email, sub: 'Respondemos en menos de 24 horas.', href: `mailto:${email}` },
    { icon: infoIcons[3], k: 'Horario de atención', v: summary ? `${summary.weekday.open} - ${summary.weekday.close}` : `${site?.schedule_open ?? '09:00'} - ${site?.schedule_close ?? '18:00'}`, sub: lines.join('\n') },
  ]
}

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [site, setSite] = useState<SiteInfo | null>(null)
  const hero = useHero('contact')

  usePageMeta(
    'Contacto | Estamos aquí para ayudarte',
    'Resuelve tus dudas, agenda una revisión o escríbenos por WhatsApp. Estamos para ayudarte.',
  )

  useEffect(() => {
    api<SiteInfo>('/site-info')
      .then(setSite)
      .catch(() => {})
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

  return (
    <div className="bg-white">
      {/* ═══════════ HERO ═══════════ */}
      <PageHero
        title={
          hero.title ? (
            <>{hero.title}</>
          ) : (
            <>ESTAMOS AQUÍ PARA <span className="gradient-text">AYUDARTE</span></>
          )
        }
        subtitle={hero.subtitle || 'Resuelve tus dudas o agenda una revisión. Nuestro equipo está listo para brindarte la mejor atención.'}
        images={hero.images}
        badge={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">💬</span>
            <div>
              <p className="text-sm font-bold text-carbon-900">Respuesta rápida</p>
              <p className="text-xs text-carbon-500">WhatsApp, email o llamada</p>
            </div>
          </>
        }
      />

      {/* ═══════════ INFO CARDS ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {infoCards(site).map((c, i) => (
            <Reveal key={c.k} delay={i * 70} className="h-full">
              <div className="card group relative h-full overflow-hidden p-6 hover:-translate-y-1 hover:shadow-lg">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-brand-200/60 transition group-hover:scale-110">
                  {c.icon}
                </div>
                <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-carbon-400">{c.k}</h3>
                {c.href ? (
                  <a href={c.href} className="mt-1.5 block text-base font-semibold text-carbon-900 underline-offset-2 transition hover:text-brand-600 hover:underline">
                    {c.v}
                  </a>
                ) : (
                  <p className="mt-1.5 text-base font-semibold text-carbon-900">{c.v}</p>
                )}
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-carbon-500">{c.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ FORM + MAP ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Formulario */}
          <Reveal>
            <div className="card p-6">
              <h2 className="text-2xl font-black text-carbon-900">Envíanos un mensaje</h2>
              <p className="mt-1 text-sm text-carbon-500">
                Cuéntanos qué necesitas y te responderemos lo más pronto posible.
              </p>

              {sent ? (
                <div className="anim-fade-up flex flex-col items-center py-14 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✅</span>
                  <h3 className="mt-4 text-xl font-black text-carbon-900">¡Mensaje enviado!</h3>
                  <p className="mt-2 max-w-sm text-carbon-500">
                    Gracias {form.name.split(' ')[0] || 'amigo'}. Te contactaremos pronto.
                  </p>
                  <button onClick={() => { setSent(false); setForm({ name: '', email: '', phone: '', subject: '', message: '' }) }} className="btn-ghost mt-6">
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div>
                    <input value={form.name} onChange={set('name')} required placeholder="Nombre completo" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input type="email" value={form.email} onChange={set('email')} required placeholder="Correo electrónico" className={inputCls} />
                    <input type="tel" value={form.phone} onChange={set('phone')} placeholder="Teléfono (opcional)" className={inputCls} />
                  </div>
                  <select value={form.subject} onChange={set('subject')} className={inputCls}>
                    <option value="">¿En qué podemos ayudarte?</option>
                    <option value="cita">Agendar una cita</option>
                    <option value="cotizacion">Cotización / repuestos</option>
                    <option value="garantia">Garantía</option>
                    <option value="otro">Otro</option>
                  </select>
                  <textarea value={form.message} onChange={set('message')} required rows={4} placeholder="Cuéntanos tu consulta o solicitud..." className={inputCls} />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button type="submit" disabled={submitting} className="btn-primary btn-shine">
                    {submitting ? 'Enviando...' : 'Enviar mensaje'}
                    {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
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
                {benefits.map((b) => (
                  <div key={b.t} className="card flex items-start gap-3 p-4 hover:border-brand-200">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg">{b.icon}</span>
                    <div>
                      <h4 className="font-bold text-carbon-900">{b.t}</h4>
                      <p className="text-sm text-carbon-500">{b.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div id="mapa" className="card overflow-hidden">
                <div className="px-5 py-3">
                  <h3 className="font-bold text-carbon-900">¿Dónde estamos?</h3>
                </div>
                <div className="relative">
                  <iframe
                    title={`Mapa ${site?.workshop_name || 'del taller'}`}
                    src="https://www.openstreetmap.org/export/embed.html?bbox=-74.0981%2C4.6403%2C-74.0381%2C4.6803&layer=mapnik&marker=4.6603%2C-74.0681"
                    className="h-[220px] w-full grayscale-[20%]"
                    loading="lazy"
                  />
                  <div className="flex items-center gap-2 bg-white px-5 py-3 text-sm text-carbon-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Calle Principal #12-34, Centro, Tu Ciudad
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════ 3 PASOS ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Cómo funciona
          </span>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">En <span className="gradient-text">3 pasos</span></h2>
          <p className="mx-auto mt-2 max-w-xl text-carbon-500">Así de fácil empiezas a cuidar tu moto con nosotros.</p>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="group relative h-full card lift p-7">
                <div className="absolute right-5 top-5 text-5xl font-black text-carbon-100 transition-all duration-300 group-hover:scale-125 group-hover:text-brand-500">{s.n}</div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
                  <StepIcon name={s.icon} />
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-carbon-500">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <section className="bg-carbon-50 py-14">
        <div className="mx-auto max-w-4xl px-4">
          <Reveal>
            <div className="cta-card card p-8 sm:p-12">
              <div className="ml-4 text-center sm:ml-8">
                <h2 className="text-3xl font-black text-carbon-900 md:text-4xl">
                  ¿Listo para llevar tu moto al siguiente nivel?
                </h2>
                <p className="mx-auto mt-3 max-w-lg text-carbon-500">
                  Agenda tu cita ahora y déjala en manos expertas.
                </p>
                <a href="/agendar" className="btn-primary mt-6 inline-flex">
                  Agendar cita ahora
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}