import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import Pagination from '../../components/Pagination'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { HeroBg } from '../../components/HeroBg'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { APP_NAME } from '../../lib/config'

interface Service {
  id: number
  name: string
  price: number
  category?: string | null
  estimated_minutes?: number | null
  description?: string | null
}

const categoryIcons: Record<string, string> = {
  'Motor': '⚙️',
  'Frenos': '🛑',
  'Eléctrico': '⚡',
  'Suspensión': '🔧',
  'Transmisión': '⛓️',
  'Carrocería': '🎨',
  'Llantas': '🛞',
  'Aceite': '🛢️',
  'General': '🔍',
  'Mecánico': '🔧',
  'Limpieza': '🧹',
  'Confort': '🪑',
  'Rendimiento': '🏎️',
  'Protección': '🛡️',
}

const PER_PAGE = 6

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sort, setSort] = useState('populares')
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

  const filtered = useMemo(
    () => (category ? services.filter((s) => (s.category || 'Otros') === category) : services),
    [services, category],
  )

  useEffect(() => { setPage(1) }, [category])

  useEffect(() => {
    if (!filterOpen) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-filter-dropdown]')) setFilterOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [filterOpen])

  useEffect(() => {
    if (!sortOpen) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-sort-dropdown]')) setSortOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [sortOpen])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function selectCategory(value: string) {
    setCategory(value)
    setFilterOpen(false)
  }

  const activeCategory = category ? categories.find((c) => c.name === category) : null

  return (
    <div className="bg-gray-50">
      {/* ═══════════ TÍTULO + CTAs ═══════════ */}
      <section className="relative overflow-hidden bg-white pb-10 pt-16 md:pt-24">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
            Cuidamos tu moto como si fuera <span className="gradient-text">nuestra</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-500 md:text-lg">
            Explora los servicios que tenemos para tu moto.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/agendar" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-600/30">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              Agenda ahora
            </Link>
            <Link to="/contacto" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-7 py-3.5 text-sm font-bold text-gray-700 transition-all duration-300 hover:border-orange-300 hover:text-orange-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Contáctanos
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ FRANJA DE BENEFICIOS ═══════════ */}
      <section className="border-y border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { icon: '🛡️', title: 'Garantía', desc: 'en cada servicio' },
              { icon: '🔧', title: 'Repuestos', desc: 'de calidad' },
              { icon: '⚡', title: 'Atención rápida', desc: 'y personalizada' },
              { icon: '👨‍🔧', title: 'Equipo certificado', desc: 'profesionales apasionados' },
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg">{b.icon}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{b.title}</p>
                  <p className="text-xs text-gray-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CONTROLES + GRID ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        {/* Controles */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative" data-filter-dropdown>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-all ${
                filterOpen || category ? 'border-gray-900 shadow-md' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
              {activeCategory ? activeCategory.name : 'Todas las categorías'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {filterOpen && (
              <div className="anim-fade-up absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <button onClick={() => selectCategory('')} className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition hover:bg-orange-50 ${!category ? 'bg-orange-50 text-orange-700' : 'text-gray-700'}`}>
                  Todas las categorías
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{services.length}</span>
                </button>
                {categories.map((c) => (
                  <button key={c.name} onClick={() => selectCategory(c.name)} className={`flex w-full items-center justify-between border-t border-gray-100 px-4 py-2.5 text-sm font-medium transition hover:bg-orange-50 ${category === c.name ? 'bg-orange-50 text-orange-700' : 'text-gray-700'}`}>
                    <span className="flex items-center gap-2">
                      <span>{categoryIcons[c.name] || '📋'}</span>
                      {c.name}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" data-sort-dropdown>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:border-gray-300"
            >
              <span className="text-gray-400">Ordenar por</span>
              <span className="text-gray-900">{sort === 'populares' ? 'Más populares' : sort === 'nombre' ? 'Nombre' : 'Recientes'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {sortOpen && (
              <div className="anim-fade-up absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                {[{ v: 'populares', l: 'Más populares' }, { v: 'nombre', l: 'Nombre' }, { v: 'recientes', l: 'Recientes' }].map((o) => (
                  <button key={o.v} onClick={() => { setSort(o.v); setSortOpen(false) }} className={`flex w-full items-center px-4 py-2.5 text-sm font-medium transition hover:bg-orange-50 ${sort === o.v ? 'bg-orange-50 text-orange-700' : 'text-gray-700'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((s, i) => (
            <Reveal key={s.id ?? i} delay={i * 60}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/40">
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-2xl transition-transform duration-300 group-hover:scale-110">
                      {categoryIcons[s.category || ''] || '🔧'}
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
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Incluye revisión de seguridad
                  </div>
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

      {/* ═══════════ POR QUÉ ELEGIRNOS ═══════════ */}
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
                { icon: '📋', title: 'Hoja de vida digital', desc: 'Registramos cada servicio en la historia de tu moto para que tengas todo bajo control.' },
                { icon: '📅', title: 'Agenda preferente', desc: 'Agenda prioritaria y recordatorios para que nunca pierdas tu cita.' },
                { icon: '🛡️', title: 'Garantía real', desc: 'Respaldo en mano de obra y los repuestos que instalamos.' },
              ].map((item, i) => (
                <Reveal key={item.title} delay={i * 100}>
                  <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/30">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-xl transition-colors group-hover:bg-orange-100">
                      {item.icon}
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

      {/* ═══════════ PROCESO — 4 PASOS ═══════════ */}
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
            { n: '1', t: 'Diagnóstico inicial', d: 'Evaluamos tu moto y detectamos las necesidades.', icon: '🔍' },
            { n: '2', t: 'Cotización clara', d: 'Te enviamos la mejor opción con precio justo y tiempo estimado.', icon: '📋' },
            { n: '3', t: 'Agendación y avance', d: 'Agendamos, realizamos el trabajo y te mantenemos al tanto.', icon: '📅' },
            { n: '4', t: 'Moto lista', d: 'Entregamos tu moto como nueva y con total seguridad.', icon: '✅' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="group relative text-center">
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-orange-200 bg-white text-2xl shadow-sm transition-all duration-300 group-hover:border-orange-400 group-hover:shadow-md">
                  {s.icon}
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

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white px-8 py-10 shadow-sm sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-2xl">🛡️</div>
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
