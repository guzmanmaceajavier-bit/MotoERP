import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import type { ReactNode } from 'react'
import { Reveal } from '../../components/Reveal'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'

interface PostCard {
  id: number
  title: string
  slug: string
  excerpt?: string
  cover?: string
  published_at?: string
  author?: string
  read_minutes?: number
  category?: string
}

interface PostDetail extends PostCard {
  content: string
  related?: PostCard[]
}

const CATEGORY_META: Record<string, { icon: ReactNode; color: string }> = {
  Mantenimiento: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>,
    color: 'bg-orange-500',
  },
  Consejos: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    color: 'bg-blue-500',
  },
  Seguridad: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    color: 'bg-green-500',
  },
  Repuestos: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>,
    color: 'bg-purple-500',
  },
  Novedades: {
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
    color: 'bg-pink-500',
  },
}

const ALL_CATS = ['Mantenimiento', 'Consejos', 'Seguridad', 'Repuestos', 'Novedades']

export default function BlogPage() {
  const { slug } = useParams()
  const [list, setList] = useState<PostCard[]>([])
  const [post, setPost] = useState<PostDetail | null>(null)
  const { workshop_name: siteName } = useSiteInfo()
  const hero = useHero('blog')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  usePageMeta(
    post ? `${post.title} | ${siteName || 'MotoHouse'}` : `${siteName ? siteName + ' | ' : ''}Blog`,
    post?.excerpt || `Consejos, mantenimiento y novedades del taller ${siteName || 'MotoHouse'}.`,
  )

  useEffect(() => {
    if (slug) {
      api<PostDetail>(`/blog/${slug}`).then(setPost).catch(() => {})
    } else {
      api<{ data: PostCard[] }>('/blog').then((d) => setList(d.data)).catch(() => {})
    }
  }, [slug])

  const fmt = (d?: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

  const categories = useMemo(() => {
    const cats = new Set<string>()
    list.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats)
  }, [list])

  const filtered = useMemo(() => {
    if (!activeCat) return list
    return list.filter((p) => p.category === activeCat)
  }, [list, activeCat])

  if (slug) {
    if (!post) return <div className="p-16 text-center text-gray-500">Cargando publicación...</div>
    const postCat = post.category
    return (
      <div className="bg-gray-50">
        {/* Detail hero */}
        <section className="relative overflow-hidden bg-white pb-10 pt-14 md:pt-20">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />
          <div className="relative mx-auto max-w-4xl px-4">
            <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Volver al blog
            </Link>
            {postCat && (
              <span className="mt-4 inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">{postCat}</span>
            )}
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-gray-900 md:text-4xl lg:text-5xl">{post.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                  {(post.author || 'M')[0].toUpperCase()}
                </span>
                <span className="font-semibold text-gray-700">{post.author || 'MotoHouse'}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                {fmt(post.published_at)}
              </span>
              {post.read_minutes ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  {post.read_minutes} min de lectura
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {post.cover && (
          <div className="mx-auto max-w-4xl px-4 pt-8">
            <img src={post.cover} alt={post.title} className="w-full rounded-2xl object-cover shadow-lg" style={{ maxHeight: 440 }} />
          </div>
        )}

        <article className="mx-auto max-w-4xl px-4 py-10">
          <div className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed text-gray-700">{post.content}</div>

          <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 p-8 text-center">
            <p className="text-lg font-bold text-gray-900">¿Te gustó esta publicación?</p>
            <p className="mt-1 text-sm text-gray-500">Agenda una revisión y mantén tu moto en óptimas condiciones.</p>
            <Link to="/agendar" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-xl">
              Agenda una revisión
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>

          {post.related && post.related.length > 0 && (
            <div className="mt-14">
              <h2 className="text-2xl font-black text-gray-900">Artículos relacionados</h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {post.related.map((p) => {
                  const rc = p.category
                  return (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                      <div className="relative h-40 overflow-hidden">
                        {p.cover ? (
                          <img src={p.cover} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600" />
                        )}
                        {rc && (
                          <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold text-white">{rc}</span>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="line-clamp-2 font-bold text-gray-900 transition group-hover:text-orange-600">{p.title}</h3>
                        <p className="mt-1 text-xs text-gray-400">{fmt(p.published_at)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </article>
      </div>
    )
  }

  /* ──── LIST VIEW ──── */
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
                Consejos y guías <br className="hidden md:block" />
                <span className="gradient-text">para tu moto</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-500">
                Mantenemos tu pasión en movimiento con tips, guías y recomendaciones de expertos.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-5 md:justify-start">
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Contenido práctico</p>
                    <p className="text-xs text-gray-400">Consejos útiles para el cuidado de tu moto.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Expertos en motos</p>
                    <p className="text-xs text-gray-400">Información respaldada por mecánicos profesionales.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  </span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900">Actualizado constantemente</p>
                    <p className="text-xs text-gray-400">Nuevos artículos cada semana para ti.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative shrink-0">
              <div className="relative h-[220px] w-[320px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 sm:h-[280px] sm:w-[400px] md:h-[320px] md:w-[460px]">
                {hero.images && hero.images.length > 0 ? (
                  <img
                    src={hero.images[0]}
                    alt={`Blog ${siteName || 'MotoHouse'}`}
                    className="h-full w-full object-cover"
                  />
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

      {/* ──── CATEGORIES FILTER ──── */}
      <section className="border-b border-gray-100 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center gap-2">
            {ALL_CATS.map((cat) => {
              const meta = CATEGORY_META[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(activeCat === cat ? null : cat)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${activeCat === cat ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {meta?.icon}
                  {cat}
                </button>
              )
            })}
            {categories.length > ALL_CATS.length && (
              <button
                onClick={() => {
                  const nextCat = categories.find((c) => c !== activeCat && !ALL_CATS.includes(c))
                  if (nextCat) setActiveCat(nextCat)
                }}
                className="ml-auto text-sm font-semibold text-orange-500 hover:underline"
              >
                Ver todas →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ──── ARTICLES ──── */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Lo último en el blog</h2>
          </div>
          <Link to="/blog" className="hidden text-sm font-semibold text-orange-500 hover:underline sm:inline-flex items-center gap-1">
            Ver todos los artículos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-gray-400">Aún no hay publicaciones.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p, i) => {
              const cat = p.category
              const catMeta = cat ? CATEGORY_META[cat] : null
              return (
                <Reveal key={p.id} delay={i * 60}>
                  <Link
                    to={`/blog/${p.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative h-52 overflow-hidden">
                      {p.cover ? (
                        <img src={p.cover} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-4.6-4.6a2 2 0 00-2.8 0L6 18" /></svg>
                        </div>
                      )}
                      {cat && (
                        <span className={`absolute left-3 top-3 rounded-full ${catMeta?.color || 'bg-orange-500'} px-3 py-1 text-[11px] font-bold text-white uppercase shadow-md`}>
                          {cat}
                        </span>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                          {fmt(p.published_at)}
                        </span>
                        {p.read_minutes ? (
                          <span className="inline-flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                            {p.read_minutes} min
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-lg font-bold leading-snug text-gray-900 transition group-hover:text-orange-600">{p.title}</h3>
                      {p.excerpt && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">{p.excerpt}</p>
                      )}
                      <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">
                            {(p.author || 'M')[0].toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{p.author || 'MotoHouse'}</p>
                            <p className="text-[11px] text-gray-400">Equipo de expertos</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-orange-500">
                          Leer más
                          <span className="transition-transform group-hover:translate-x-1">→</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        )}
      </section>

      {/* ──── NEWSLETTER CTA ──── */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-8 sm:flex-row sm:justify-between sm:px-12">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">✉️</div>
              <div>
                <h2 className="text-lg font-black text-gray-900">¿Te gustan nuestros consejos?</h2>
                <p className="text-sm text-gray-500">Suscríbete y recibe los mejores tips y novedades directo en tu correo.</p>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); setEmail(''); alert('¡Gracias por suscribirte!') }}
              className="flex w-full max-w-sm items-center gap-2"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu correo electrónico"
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition hover:bg-orange-600 hover:shadow-lg"
              >
                Suscribirme
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
