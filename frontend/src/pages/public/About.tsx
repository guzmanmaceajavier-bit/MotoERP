import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'
import { HeroBg } from '../../components/HeroBg'
import PageHero from '../../components/PageHero'
import { Eye, ShieldCheck, Wrench } from 'lucide-react'

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
  trabajos_gallery?: { image: string; title: string; description?: string }[]
}

const roleLabel: Record<string, string> = {
  admin: 'Administrador',
  mechanic: 'Mecánico',
  receptionist: 'Recepcionista',
}

export default function About() {
  const [team, setTeam] = useState<TeamMember[]>([])
  const [gallery, setGallery] = useState<{ image: string; title: string; description?: string }[]>([])
  const [lightbox, setLightbox] = useState<{ image: string; title: string } | null>(null)
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
        if (d.trabajos_gallery && d.trabajos_gallery.length > 0) {
          setGallery(d.trabajos_gallery.filter((g) => g.image))
        } else {
          const imgs: string[] = []
          for (const b of d.banners ?? []) if (b.image) imgs.push(b.image)
          for (const page of ['home', 'about', 'services', 'contact']) {
            for (const u of d.hero_images?.[page] ?? []) if (u) imgs.push(u)
          }
          setGallery([...new Set(imgs)].slice(0, 8).map((image) => ({ image, title: '' })))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="bg-gray-50">
      <PageHero
        eyebrow="Nosotros"
        title={hero.slides?.[0]?.title ? <>{hero.slides[0].title}</> : <>Las personas que <span className="gradient-text">cuidan tu moto</span></>}
        subtitle={hero.slides?.[0]?.subtitle || 'Mecánicos certificados, trato cercano y un servicio que puedes seguir desde tu teléfono.'}
        points={[
          { icon: Wrench, title: 'Equipo certificado', desc: 'Mecánicos especializados en todas las marcas.' },
          { icon: Eye, title: 'Servicio transparente', desc: 'Sigue cada paso del proceso en tiempo real.' },
          { icon: ShieldCheck, title: 'Garantía incluida', desc: 'Todos nuestros trabajos cuentan con garantía.' },
        ]}
        visual={
          <div className="relative h-[220px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-xl shadow-gray-200/50 sm:h-[280px] md:h-[320px]">
            {hero.images && hero.images.length > 0 && <HeroBg images={hero.images} />}
          </div>
        }
      />

      {/* galeria */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black text-gray-900">Nuestros <span className="gradient-text">trabajos</span></h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-500">
            Una muestra de los trabajos que realizamos a diario en el taller.
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {gallery.length > 0 ? (
            gallery.map((g, i) => (
              <Reveal key={g.image + i} delay={i * 60}>
                <button
                  onClick={() => setLightbox({ image: g.image, title: g.title })}
                  className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
                  aria-label="Ver imagen de trabajo"
                >
                  <img
                    src={g.image}
                    alt={g.title || `Trabajo ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition group-hover:opacity-100">
                    {g.title && <span className="px-3 pb-1 text-sm font-bold text-white">{g.title}</span>}
                    {g.description && <span className="px-3 pb-3 text-xs text-white/80">{g.description}</span>}
                    {!g.title && !g.description && (
                      <span className="flex items-center gap-1.5 p-3 text-xs font-semibold text-white">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        Ver
                      </span>
                    )}
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
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox.image} alt={lightbox.title || 'Trabajo realizado'} className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl" />
          {lightbox.title && <p className="mt-4 text-lg font-bold text-white">{lightbox.title}</p>}
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* equipo */}
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
                {m.specialty && <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-500"><Wrench className="h-3 w-3" /> {m.specialty}</p>}
                {m.bio && <p className="mt-3 text-sm leading-relaxed text-gray-600">{m.bio}</p>}
              </div>
            </Reveal>
          ))}
          {team.length === 0 && (
            <p className="col-span-full py-10 text-center text-gray-400">El equipo se mostrará aquí.</p>
          )}
        </div>
      </section>

      {/* cta final */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50"><Wrench className="h-7 w-7 text-orange-500" /></div>
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
