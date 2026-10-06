import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import Pagination from '../../components/Pagination'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { HeroBg } from '../../components/HeroBg'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { APP_NAME } from '../../lib/config'
import { ArrowRight, BadgeCheck, Bike, CalendarDays, Check, CircleDot, ClipboardList, Clock, Cog, Disc3, Droplets, Gauge, Package, Palette, Search, Settings, ShieldCheck, Smile, Sparkles, User, Wrench, Zap } from 'lucide-react'
import CategoryRail from '../../components/CategoryRail'
import type { LucideIcon } from 'lucide-react'

interface Service {
  id: number
  name: string
  price: number
  category?: string | null
  estimated_minutes?: number | null
  description?: string | null
}

const categoryIcons: Record<string, LucideIcon> = {
  'Motor': Cog,
  'Frenos': Disc3,
  'Eléctrico': Zap,
  'Suspensión': Wrench,
  'Transmisión': Settings,
  'Carrocería': Palette,
  'Llantas': CircleDot,
  'Aceite': Droplets,
  'General': Search,
  'Mecánico': User,
  'Limpieza': Sparkles,
  'Confort': Smile,
  'Rendimiento': Gauge,
  'Protección': ShieldCheck,
}

function CatIcon({ name, className = 'h-4 w-4' }: { name?: string | null; className?: string }) {
  const I = (name && categoryIcons[name]) || ClipboardList
  return <I className={className} />
}

const PER_PAGE = 6

function ServicesHeroLight({ title, subtitle, images, total, totalCats }: {
  title: string; subtitle: string; images?: string[]; total: number; totalCats: number
}) {
  const words = title.split(' ')
  const accentFrom = Math.max(0, words.length - 2)

  return (
    <section className="relative isolate overflow-hidden bg-orange-50 dark:bg-gray-950">
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(#fdba74 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          maskImage: 'linear-gradient(180deg,#000 35%,transparent)',
          WebkitMaskImage: 'linear-gradient(180deg,#000 35%,transparent)',
        }}
      />
      <div className="anim-glow absolute -right-20 -top-20 -z-10 h-80 w-80 rounded-full bg-orange-300/50 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-10 md:pt-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="anim-rise inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-widest text-orange-600 shadow-sm">
            <Wrench className="h-3.5 w-3.5" /> Nuestros servicios
          </p>

          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-gray-900 dark:text-white md:text-6xl">
            {words.map((w, i) => {
              const accent = i >= accentFrom
              const last = i === words.length - 1
              return (
                <span
                  key={i}
                  className={`anim-rise relative mr-[.25em] inline-block ${accent ? 'text-orange-600' : ''}`}
                  style={{ animationDelay: `${150 + i * 90}ms` }}
                >
                  {w}
                  {last && (
                    <svg viewBox="0 0 120 10" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-orange-400">
                      <path className="anim-draw" pathLength={300} d="M2 6 Q30 0 60 5 T118 4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
              )
            })}
          </h1>

          <p className="anim-rise mt-5 max-w-xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg" style={{ animationDelay: '700ms' }}>
            {subtitle}
          </p>

          <div className="anim-rise mt-7 flex flex-wrap items-center gap-3" style={{ animationDelay: '820ms' }}>
            <Link to="/agendar" className="group inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-gray-900/20 transition hover:bg-orange-600 hover:shadow-orange-600/30 dark:bg-orange-500 dark:hover:bg-orange-400">
              Agendar cita <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a href="#servicios-grid" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-sm font-bold text-gray-700 transition hover:border-orange-400 hover:text-orange-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
              Ver los {total || ''} servicios
            </a>
          </div>

          <ul className="anim-rise mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-gray-600 dark:text-gray-300" style={{ animationDelay: '940ms' }}>
            {['Garantía en cada servicio', 'Repuestos de calidad', 'Atención rápida'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="anim-rise relative mx-auto h-[360px] w-full max-w-md" style={{ animationDelay: '400ms' }}>
          <div className="absolute inset-3 rotate-3 rounded-[2rem] bg-orange-500 shadow-xl shadow-orange-500/30" />
          <div className="absolute inset-3 -rotate-2 overflow-hidden rounded-[2rem] border-4 border-white bg-gray-900 shadow-2xl dark:border-white/10">
            {images && images.length > 0 ? (
              <HeroBg images={images} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
                <Bike className="h-28 w-28 text-orange-500/80" strokeWidth={1.2} />
              </div>
            )}
          </div>

          <div className="anim-float absolute -left-2 top-10 flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 shadow-xl dark:border-white/10 dark:bg-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/15"><ShieldCheck className="h-5 w-5 text-orange-500" /></span>
            <span className="text-xs font-bold leading-tight text-gray-900 dark:text-white">Garantía<br /><span className="font-medium text-gray-500">en mano de obra</span></span>
          </div>
          <div className="anim-float absolute -right-2 bottom-12 flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 shadow-xl [animation-delay:1.5s] dark:border-white/10 dark:bg-gray-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/15"><BadgeCheck className="h-5 w-5 text-emerald-500" /></span>
            <span className="text-xs font-bold leading-tight text-gray-900 dark:text-white">{totalCats} categorías<br /><span className="font-medium text-gray-500">un solo taller</span></span>
          </div>

          <div className="absolute -right-3 -top-3 flex h-28 w-28 items-center justify-center rounded-full bg-white text-orange-600 shadow-xl dark:bg-gray-900">
            <svg viewBox="0 0 120 120" className="h-full w-full animate-[spin_18s_linear_infinite] motion-reduce:animate-none">
              <defs><path id="sello" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
              <text fontSize="9" fontWeight="800" fill="currentColor"><textPath href="#sello" textLength="272">SERVICIO CON GARANTÍA • TALLER CERTIFICADO •</textPath></text>
            </svg>
            <Wrench className="absolute h-7 w-7 text-gray-900 dark:text-white" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'nombre' | 'rapidos'>('nombre')
  const hero = useHero('services')
  const { workshop_name: siteName } = useSiteInfo()

  usePageMeta(
    `${siteName ? siteName + ' | ' : ''}Servicios para tu moto`,
    'Servicios de mantenimiento y reparación de motocicletas: cambios de aceite, frenos, motor, eléctrico y más, con garantía.',
  )

  useEffect(() => {
    api<Service[]>('/services').then(setServices).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of services) {
      const c = s.category || 'Otros'
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
  }, [services])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = services.filter((s) =>
      (!category || (s.category || 'Otros') === category) &&
      (!q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)),
    )
    return [...list].sort((a, b) =>
      sort === 'rapidos'
        ? (a.estimated_minutes ?? 9999) - (b.estimated_minutes ?? 9999)
        : a.name.localeCompare(b.name),
    )
  }, [services, category, query, sort])

  useEffect(() => { setPage(1) }, [category, query, sort])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function selectCategory(value: string) {
    setCategory(value)
    document.getElementById('servicios-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="bg-gray-50">
      <ServicesHeroLight
        title={hero.slides?.[0]?.title || 'Cuidamos tu moto como si fuera nuestra'}
        subtitle={hero.slides?.[0]?.subtitle || 'Explora los servicios que tenemos para tu moto'}
        images={hero.images}
        total={services.length}
        totalCats={categories.length}
      />

      <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-1 rounded-3xl border border-gray-100 bg-white p-2 shadow-xl shadow-orange-900/5 dark:border-white/10 dark:bg-gray-900 md:grid-cols-4">
          {[
            { icon: ShieldCheck, title: 'Garantía', desc: 'en cada servicio' },
            { icon: Package, title: 'Repuestos', desc: 'de calidad' },
            { icon: Zap, title: 'Atención rápida', desc: 'y personalizada' },
            { icon: User, title: 'Equipo certificado', desc: 'profesionales apasionados' },
          ].map((b) => (
            <div key={b.title} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-orange-50 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/15"><b.icon className="h-5 w-5 text-orange-500" /></span>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{b.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* lista de servicios */}
      <section id="servicios-grid" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white md:text-3xl">Elige tu servicio</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-900 dark:text-white">{filtered.length}</span> de {services.length} servicios
              {category && <> · <button onClick={() => selectCategory('')} className="font-semibold text-orange-600 hover:underline">quitar filtro</button></>}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 shadow-sm transition focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-500/10 sm:w-64 dark:border-white/10 dark:bg-white/5">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar servicio…" className="w-full bg-transparent text-sm focus:outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm shadow-sm dark:border-white/10 dark:bg-white/5">
              <span className="text-gray-400">Ordenar</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as 'nombre' | 'rapidos')} className="bg-transparent font-semibold text-gray-900 focus:outline-none dark:text-white">
                <option value="nombre">Nombre A–Z</option>
                <option value="rapidos">Más rápidos</option>
              </select>
            </label>
          </div>
        </div>

        <CategoryRail
          tone="dark"
          active={category}
          onPick={selectCategory}
          items={[
            { key: '', label: 'Todos', sub: `${services.length} servicios` },
            ...categories.map((c) => ({
              key: c.name,
              label: c.name,
              sub: `${c.count} ${c.count === 1 ? 'servicio' : 'servicios'}`,
              icon: <CatIcon name={c.name} className="h-6 w-6" />,
            })),
          ]}
        />

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((s, i) => (
            <Reveal key={s.id ?? i} delay={i * 60}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/40">
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 transition-transform duration-300 group-hover:scale-110">
                      <CatIcon name={s.category} className="h-6 w-6 text-orange-500" />
                    </div>
                    {s.category && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {s.category}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-500">
                    {s.description || 'Cotiza con nosotros y dejamos tu moto lista en el menor tiempo posible.'}
                  </p>
                  {s.estimated_minutes ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                      <Clock className="h-3.5 w-3.5 text-orange-500" /> ~{s.estimated_minutes} min
                    </p>
                  ) : null}
                  <Link
                    to={`/agendar?service=${encodeURIComponent(s.name)}`}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-600/25"
                  >
                    Agendar servicio
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
          {loaded && filtered.length === 0 && (
            <p className="col-span-full py-20 text-center text-gray-400">No hay servicios en esta categoría.</p>
          )}
          {!loaded && (
            <div className="col-span-full flex items-center justify-center gap-3 py-20 text-gray-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              Cargando servicios...
            </div>
          )}
        </div>

        <Pagination page={page} lastPage={lastPage} total={filtered.length} onChange={setPage} />
      </section>

      {/* porque elegirnos */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start">
          {/* Imagen */}
          <Reveal className="w-full flex-1">
            <div className="relative overflow-hidden rounded-3xl border border-gray-200 shadow-xl shadow-gray-200/50">
              <div className="relative h-[260px] sm:h-[320px] lg:h-[380px]">
                {hero.images && hero.images.length > 0 ? (
                  <HeroBg images={hero.images} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gray-950/30 via-transparent to-transparent" />
              </div>
            </div>
          </Reveal>

          {/* Tarjetas */}
          <div className="w-full flex-1">
            <Reveal>
              <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
                ¿Por qué elegir <span className="gradient-text">{siteName || APP_NAME}</span>?
              </h2>
              <p className="mt-3 text-gray-500">Nos mueve tu idea, nos mueve acompañarte. Tu moto, nuestro compromiso.</p>
            </Reveal>

            <div className="mt-8 space-y-4">
              {[
                { icon: ClipboardList, title: 'Hoja de vida digital', desc: 'Registramos cada servicio en la historia de tu moto para que tengas todo bajo control.' },
                { icon: CalendarDays, title: 'Agenda preferente', desc: 'Agenda prioritaria y recordatorios para que nunca pierdas tu cita.' },
                { icon: ShieldCheck, title: 'Garantía real', desc: 'Respaldo en mano de obra y los repuestos que instalamos.' },
              ].map((item, i) => (
                <Reveal key={item.title} delay={i * 100}>
                  <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/30">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 transition-colors group-hover:bg-orange-100">
                      <item.icon className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* pasos */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal>
          <div className="text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">
              ¿Cómo se <span className="gradient-text">cotiza</span> tu servicio?
            </h2>
          </div>
        </Reveal>
        <div className="relative mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Línea conectora */}
          <div className="absolute left-[12%] right-[12%] top-10 hidden h-px bg-gradient-to-r from-orange-200 via-orange-300 to-orange-200 md:block" />

          {[
            { n: '1', t: 'Diagnóstico inicial', d: 'Evaluamos tu moto y detectamos las necesidades.', icon: Search },
            { n: '2', t: 'Cotización clara', d: 'Te enviamos la mejor opción con precio justo y tiempo estimado.', icon: ClipboardList },
            { n: '3', t: 'Agendación y avance', d: 'Agendamos, realizamos el trabajo y te mantenemos al tanto.', icon: CalendarDays },
            { n: '4', t: 'Moto lista', d: 'Entregamos tu moto como nueva y con total seguridad.', icon: BadgeCheck },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="group relative text-center">
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-orange-200 bg-white shadow-sm transition-all duration-300 group-hover:border-orange-400 group-hover:shadow-md">
                  <s.icon className="h-7 w-7 text-orange-500" />
                  <span className="absolute -bottom-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white shadow-md">
                    {s.n}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{s.t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* cta final */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white px-8 py-10 shadow-sm sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50"><ShieldCheck className="h-6 w-6 text-orange-500" /></div>
              <div>
                <h2 className="text-lg font-black text-gray-900">¿Listo para dejar tu moto en las mejores manos?</h2>
                <p className="text-sm text-gray-500">Agenda tu cita ahora y recibe atención personalizada.</p>
              </div>
            </div>
            <Link
              to="/agendar"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-600/30"
            >
              Agenda tu cita
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
