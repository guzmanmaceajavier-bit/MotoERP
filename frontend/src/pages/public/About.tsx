import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import PageHero from '../../components/PageHero'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'

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
    <div className="bg-carbon-50">
      <PageHero
        title={
          hero.title ? (
            <>{hero.title}</>
          ) : (
            <>Las personas que <span className="gradient-text">cuidan tu moto</span></>
          )
        }
        subtitle={hero.subtitle || 'Mecánicos certificados, trato cercano y un servicio que puedes seguir desde tu teléfono.'}
        images={hero.images}
        badge={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">🔧</span>
            <div>
              <p className="text-sm font-bold text-carbon-900">Equipo certificado</p>
              <p className="text-xs text-carbon-500">Mecánicos especializados</p>
            </div>
          </>
        }
      />

      {/* ═══════════ GALERÍA DE TRABAJOS ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black text-carbon-900">Nuestros <span className="gradient-text">trabajos</span></h2>
          <p className="mx-auto mt-1 max-w-xl text-carbon-500">
            Una muestra de los trabajos que realizamos a diario en el taller.
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {gallery.length > 0 ? (
            gallery.map((img, i) => (
              <Reveal key={img + i} delay={i * 60}>
                <button
                  onClick={() => setLightbox(img)}
                  className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-carbon-200 bg-carbon-100"
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
              <div key={i} className="aspect-square w-full animate-pulse rounded-2xl border border-carbon-200 bg-carbon-100" />
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

      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black text-carbon-900">Las personas que cuidan tu moto</h2>
          <p className="mx-auto mt-1 max-w-xl text-carbon-500">
            {siteName || 'Nuestro taller'} está formado por especialistas apasionados por las motos.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <Reveal key={m.id} delay={i * 70}>
              <div className="group card lift h-full p-6 text-center hover:border-brand-200">
                {m.photo ? (
                  <img src={m.photo} alt={m.name} className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-brand-100" />
                ) : (
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-4xl font-bold text-white shadow-lg shadow-brand-600/25">
                    {(m.name || 'S')[0]}
                  </div>
                )}
                <h3 className="mt-4 text-lg font-bold text-carbon-900">{m.name}</h3>
                <p className="text-sm font-medium text-brand-600">{roleLabel[m.role] || m.role}</p>
                {m.specialty && <p className="mt-1 text-xs text-carbon-500">🔧 {m.specialty}</p>}
                {m.bio && <p className="mt-3 text-sm text-carbon-600">{m.bio}</p>}
              </div>
            </Reveal>
          ))}
          {team.length === 0 && (
            <p className="col-span-full py-10 text-center text-carbon-400">El equipo se mostrará aquí.</p>
          )}
        </div>

        <Reveal>
          <div className="mt-12 text-center">
            <Link to="/agendar" className="btn-primary btn-shine">
              Agenda una cita y conoce al equipo
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}