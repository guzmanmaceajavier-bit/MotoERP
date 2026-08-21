import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../../components/Reveal'
import Pagination from '../../components/Pagination'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import PageHero from '../../components/PageHero'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'

interface Service {
  id: number
  name: string
  price: number
  category?: string | null
  estimated_minutes?: number | null
  description?: string | null
}

const icon = ['🛢️', '⚙️', '⛓️', '💨', '🛑', '🔍', '🛵']

const PER_PAGE = 6

const highlights = [
  { k: 'Hoja de vida digital', v: 'Registramos cada servicio en la historia de tu moto para que tengas todo documentado.' },
  { k: 'Agenda preferente', v: 'Agenda previa y prioridad para reparaciones que lo requieren.' },
  { k: 'Garantía real', v: 'Respaldamos la mano de obra y los repuestos que instalamos.' },
]

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
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

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function selectCategory(value: string) {
    setCategory(value)
    setFilterOpen(false)
  }

  const activeCategory = category ? categories.find((c) => c.name === category) : null

  return (
    <div className="bg-carbon-50">
      <PageHero
        title={
          hero.title ? (
            <>{hero.title}</>
          ) : (
            <>Cuidamos tu moto de <span className="gradient-text">principio a fin</span></>
          )
        }
        subtitle={hero.subtitle || 'Todos nuestros servicios tienen acompañamiento con la hoja de vida digital de tu moto.'}
        images={hero.images}
        badge={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">🛵</span>
            <div>
              <p className="text-sm font-bold text-carbon-900">Servicio técnico</p>
              <p className="text-xs text-carbon-500">Mano de obra con garantía</p>
            </div>
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-14">
        {/* Filtro por categoría */}
        {categories.length > 1 && (
          <div className="relative mb-8 inline-block">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-carbon-400">Filtrar servicios</span>
              {category && (
                <button onClick={() => selectCategory('')} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100">
                  {category} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex w-full items-center justify-between gap-6 rounded-2xl border-2 bg-white px-5 py-3.5 shadow-sm transition sm:min-w-[320px] ${
                filterOpen ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-brand-300 hover:border-brand-500'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                </span>
                <span className="text-left">
                  <span className="block text-sm font-black text-carbon-900">{activeCategory ? activeCategory.name : 'Todos los servicios'}</span>
                  <span className="block text-xs text-carbon-500">{activeCategory ? `${activeCategory.count} disponibles` : `${services.length} servicios disponibles`}</span>
                </span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`text-brand-600 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {filterOpen && (
              <div className="anim-fade-up absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-xl">
                <button onClick={() => selectCategory('')} className={`flex w-full items-center justify-between px-5 py-3 text-sm font-semibold transition hover:bg-brand-50 ${!category ? 'bg-brand-50 text-brand-700' : 'text-carbon-700'}`}>
                  <span>Todos los servicios</span>
                  <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-[11px] text-carbon-500">{services.length}</span>
                </button>
                {categories.map((c) => (
                  <button key={c.name} onClick={() => selectCategory(c.name)} className={`flex w-full items-center justify-between border-t border-carbon-100 px-5 py-3 text-sm font-semibold transition hover:bg-brand-50 ${category === c.name ? 'bg-brand-50 text-brand-700' : 'text-carbon-700'}`}>
                    <span>{c.name}</span>
                    <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-[11px] text-carbon-500">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((s, i) => (
            <Reveal key={s.id ?? i} delay={i * 60}>
              <div className="group card lift flex h-full flex-col justify-between p-6">
                <div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl transition-transform group-hover:scale-110">
                    {icon[i % icon.length]}
                  </span>
                  <span className="mt-4 block text-xs font-semibold uppercase tracking-wider text-brand-600">{s.category || 'Servicio'}</span>
                  <h3 className="mt-1 text-lg font-bold text-carbon-900">{s.name}</h3>
                  <p className="mt-2 text-sm text-carbon-600">{s.description || 'Cotiza con nosotros y dejamos tu moto lista en el menor tiempo posible.'}</p>
                </div>
                <div className="mt-5 space-y-3 border-t border-carbon-100 pt-4">
                  <div className="flex items-center justify-between rounded-xl bg-carbon-50 px-3 py-2.5">
                    <span className="flex items-center gap-2 text-xs font-semibold text-carbon-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></svg>
                      Cotización en el taller
                    </span>
                    <span className="text-[11px] font-semibold text-carbon-400">Sin compromiso</span>
                  </div>
                  <Link to={`/agendar?service=${encodeURIComponent(s.name)}`} className="btn-primary btn-shine w-full">
                    Agendar →
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
          {loaded && filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-carbon-400">No hay servicios en esta categoría.</p>
          )}
          {!loaded && (
            <div className="col-span-full flex items-center justify-center gap-2 py-10 text-carbon-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Cargando servicios...
            </div>
          )}
        </div>

        {/* Paginación */}
        <Pagination page={page} lastPage={lastPage} total={filtered.length} onChange={setPage} />
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <h2 className="text-center text-2xl font-black text-carbon-900">
              La diferencia <span className="gradient-text">{siteName || 'MotoSystem'}</span>
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {highlights.map((h, i) => (
              <Reveal key={h.k} delay={i * 100}>
                <div className="card lift h-full p-6">
                  <span className="text-2xl">{['📋', '📅', '🛡️'][i]}</span>
                  <h3 className="mt-3 font-bold text-carbon-900">{h.k}</h3>
                  <p className="mt-1 text-sm text-carbon-600">{h.v}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CÓMO SE COTIZA ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Transparencia total
          </span>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">¿Cómo se <span className="gradient-text">cotiza</span> tu servicio?</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { n: '01', t: 'Diagnóstico inicial', d: 'Evaluamos tu moto y detectamos lo que necesita antes de tocar una herramienta.' },
            { n: '02', t: 'Cotización clara', d: 'Recibes el detalle de repuestos y mano de obra para que apruebes sin sorpresas.' },
            { n: '03', t: 'Aprobación y avance', d: 'Al aprobar, iniciamos el trabajo y te notificamos el avance en cada etapa.' },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="group relative h-full card lift p-7">
                <div className="absolute right-5 top-5 text-5xl font-black text-carbon-100 transition-all duration-300 group-hover:scale-125 group-hover:text-brand-500">{s.n}</div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
                  {['🔍', '📋', '✅'][i]}
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-carbon-500">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <div className="cta-card card p-8 sm:p-12">
            <div className="ml-4 text-center sm:ml-8">
              <h2 className="text-2xl font-black text-carbon-900 md:text-3xl">¿Listo para tu próxima revisión?</h2>
              <p className="mx-auto mt-2 max-w-md text-carbon-500">Agenda tu cita y dejamos tu moto lista para la carretera.</p>
              <Link to="/agendar" className="btn-primary mt-6 inline-flex">
                Agendar cita ahora
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}