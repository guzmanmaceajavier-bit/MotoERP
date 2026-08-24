import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { HeroBg } from '../../components/HeroBg'

interface TeamMember {
  id: number
  name: string
  role: string
  photo?: string | null
  specialty?: string | null
  bio?: string | null
  phone?: string | null
}

interface SiteGallery {
  banners?: { image?: string | null }[]
  hero_images?: Record<string, string[]>
}

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  mechanic: 'Mecánico',
  receptionist: 'Recepcionista',
}

export default function About() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [gallery, setGallery] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)
  const hero = useHero('about')
  const { workshop_name: siteName } = useSiteInfo()

  usePageMeta(
    `${siteName ? siteName + ' | ' : ''}Nuestro equipo`,
    'Conoce al equipo de mecánicos certificados que cuidan tu motocicleta con un servicio cercano y transparente.',
  )

  useEffect(() => {
    api<TeamMember[]>('/team').then(setTeam).catch(() => {})
  }, [])

  useEffect(() => {
    api<SiteGallery>('/site-info')
      .then((d) => {
        const imgs: string[] = []
        for (const b of d.banners ?? []) if (b.image) imgs.push(b.image)
        for (const page of ['home', 'about', 'services', 'contact']) {
          for (const u of d.hero_images?.[page] ?? []) if (u) imgs.push(u)
        }
        setGallery([...new Set(imgs)].slice(0, 8))
      })
      .catch(() => {})
  }, [])

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
                Las personas que <br className="hidden md:block" />
                <span className="gradient-text">cuidan tu moto</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-500">
                Mecánicos certificados, trato cercano y un servicio que puedes seguir desde tu teléfono.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-5 md:justify-start">
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">🔧</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Equipo certificado</p>
                    <p className="text-xs text-gray-400">Mecánicos especializados en todas las marcas.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">👁️</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Servicio transparente</p>
                    <p className="text-xs text-gray-400">Sigue cada paso del proceso en tiempo real.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">🛡️</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Garantía incluida</p>
                    <p className="text-xs text-gray-400">Todos nuestros trabajos cuentan con garantía.</p>
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

      {/* ═══════════ GALERÍA DE TRABAJOS ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black text-gray-900">Nuestros <span className="gradient-text">trabajos</span></h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-500">
            Una muestra de los trabajos que realizamos a diario en el taller.
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {gallery.length > 0 ? (
            gallery.map((img, i) => (
              <Reveal key={img + i} delay={i * 60}>
                <button
                  onClick={() => setLightbox(img)}
                  className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
                  aria-label="Ver imagen de trabajo"
                >
                  <img
                    src={img}
                    alt={`Trabajo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent opacity-0 transition group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 p-3 text-xs font-semibold text-white">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      Ver
                    </span>
                  </span>
                </button>
              </Reveal>
            ))
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square w-full animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />
            ))
          )}
        </div>
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Trabajo realizado" className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ═══════════ EQUIPO ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="text-center">
          <h2 className="mt-1 text-3xl font-black text-gray-900">Las personas que <span className="gradient-text">cuidan tu moto</span></h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-500">
            {siteName || 'Nuestro taller'} está formado por especialistas apasionados por las motos.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <Reveal key={m.id} delay={i * 70}>
              <div className="group h-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                {m.photo ? (
                  <img src={m.photo} alt={m.name} className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-orange-100" />
                ) : (
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-4xl font-bold text-white shadow-lg shadow-orange-500/25">
                    {(m.name || 'S')[0]}
                  </div>
                )}
                <h3 className="mt-4 text-lg font-bold text-gray-900">{m.name}</h3>
                <p className="text-sm font-medium text-orange-600">{roleLabel[m.role] || m.role}</p>
                {m.specialty && <p className="mt-1 text-xs text-gray-500">🔧 {m.specialty}</p>}
                {m.bio && <p className="mt-3 text-sm leading-relaxed text-gray-600">{m.bio}</p>}
              </div>
            </Reveal>
          ))}
          {team.length === 0 && (
            <p className="col-span-full py-10 text-center text-gray-400">El equipo se mostrará aquí.</p>
          )}
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">🔧</div>
              <div>
                <h2 className="text-lg font-black text-gray-900">¿Necesitas servicio técnico?</h2>
                <p className="text-sm text-gray-500">Agenda tu cita y déjalo en manos de nuestros expertos.</p>
              </div>
            </div>
            <Link
              to="/agendar"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-xl"
            >
              Agendar cita
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
