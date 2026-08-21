import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import PageHero from '../../components/PageHero'
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
}

interface PostDetail extends PostCard {
  content: string
  related?: PostCard[]
}

export default function BlogPage() {
  const { slug } = useParams()
  const [list, setList] = useState<PostCard[]>([])
  const [post, setPost] = useState<PostDetail | null>(null)
  const hero = useHero('blog')
  const { workshop_name: siteName } = useSiteInfo()

  usePageMeta(
    post ? `${post.title} | ${siteName || 'MotoSystem'}` : `${siteName ? siteName + ' | ' : ''}Blog`,
    post?.excerpt || `Consejos, mantenimiento y novedades del taller ${siteName || 'MotoSystem'}.`,
  )

  useEffect(() => {
    if (slug) {
      api<PostDetail>(`/blog/${slug}`).then(setPost).catch(() => {})
    } else {
      api<{ data: PostCard[] }>('/blog').then((d) => setList(d.data)).catch(() => {})
    }
  }, [slug])

  const fmt = (d?: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

  if (slug) {
    if (!post) return <div className="p-16 text-center text-carbon-500">Cargando publicación...</div>
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link to="/blog" className="text-sm font-semibold text-brand-600 hover:underline">← Todas las publicaciones</Link>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-carbon-900 md:text-4xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-carbon-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {(post.author || 'A')[0]}
            </span>
            <span className="font-semibold text-carbon-700">{post.author || 'Taller'}</span>
          </span>
          <span>·</span>
          <span>📅 {fmt(post.published_at)}</span>
          {post.read_minutes ? <span>· ⏱ {post.read_minutes} min de lectura</span> : null}
        </div>
        {post.cover && <img src={post.cover} alt={post.title} className="mt-6 h-64 w-full rounded-2xl object-cover shadow-lg" />}
        <div className="mt-6 whitespace-pre-wrap leading-relaxed text-carbon-700">{post.content}</div>

        <div className="mt-8 rounded-2xl bg-brand-50 p-6 text-center">
          <p className="font-semibold text-carbon-800">¿Te gustó esta publicación?</p>
          <Link to="/agendar?service=Diagnóstico%20general" className="btn-primary btn-shine mt-3">Agenda una revisión</Link>
        </div>

        {post.related && post.related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-black text-carbon-900">Artículos relacionados</h2>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {post.related.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="group card lift block h-full overflow-hidden hover:border-brand-200">
                  {p.cover ? (
                    <img src={p.cover} alt={p.title} className="h-28 w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="h-28 w-full bg-gradient-to-br from-brand-500 to-brand-800" />
                  )}
                  <div className="p-4">
                    <h3 className="line-clamp-2 text-sm font-bold text-carbon-900 transition group-hover:text-brand-600">{p.title}</h3>
                    <p className="mt-1 text-[11px] text-carbon-400">📅 {fmt(p.published_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-carbon-50">
      <PageHero
        title={
          hero.title ? (
            <>{hero.title}</>
          ) : (
            <>Consejos para tu <span className="gradient-text">moto</span></>
          )
        }
        subtitle={hero.subtitle || `Mantenimiento, noticias y recomendaciones de ${siteName || 'MotoSystem'}.`}
        images={hero.images}
        badge={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">📖</span>
            <div>
              <p className="text-sm font-bold text-carbon-900">Blog del taller</p>
              <p className="text-xs text-carbon-500">Tips y novedades</p>
            </div>
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-12">
        {list.length === 0 ? (
          <p className="py-16 text-center text-carbon-400">Aún no hay publicaciones.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p, i) => {
              const featured = i === 0 && list.length >= 3
              return (
                <Reveal key={p.id} delay={i * 60} className={featured ? 'sm:col-span-2 lg:col-span-2' : ''}>
                  <Link
                    to={`/blog/${p.slug}`}
                    className={`group card lift block h-full overflow-hidden hover:border-brand-200 ${
                      featured ? 'sm:flex lg:flex' : ''
                    }`}
                  >
                    <div className={`relative overflow-hidden ${featured ? 'sm:w-1/2 lg:w-1/2' : ''}`}>
                      {p.cover ? (
                        <img
                          src={p.cover}
                          alt={p.title}
                          className={`h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105 ${featured ? 'sm:h-full' : ''}`}
                        />
                      ) : (
                        <div className="h-44 w-full bg-gradient-to-br from-brand-500 to-brand-800" />
                      )}
                      {featured && (
                        <span className="absolute left-3 top-3 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                          Destacado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col p-5">
                      <p className="text-xs font-medium text-brand-600">📅 {fmt(p.published_at)}</p>
                      <h2 className={`mt-1 font-bold text-carbon-900 group-hover:text-brand-600 ${featured ? 'text-2xl' : 'text-lg'}`}>{p.title}</h2>
                      {p.excerpt && (
                        <p className={`mt-1 text-sm text-carbon-600 ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>{p.excerpt}</p>
                      )}
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-carbon-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                            {(p.author || 'A')[0]}
                          </span>
                          <span className="font-medium text-carbon-500">{p.author || 'Taller'}</span>
                        </span>
                        {p.read_minutes ? <span>· ⏱ {p.read_minutes} min</span> : null}
                      </div>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                        Leer más
                        <span className="transition-transform group-hover:translate-x-1">→</span>
                      </span>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}