import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Newspaper, Star, MessageSquare } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import Blog from './Blog'
import Ratings from './Ratings'
import Messages from './Messages'

type SubTab = 'blog' | 'ratings' | 'messages'

export default function WebContent() {
  const [searchParams] = useSearchParams()
  const [sub, setSub] = useState<SubTab>(() => {
    const sub = searchParams.get('sub')
    if (sub === 'ratings' || sub === 'messages') return sub
    const t = searchParams.get('tab')
    return t === 'ratings' || t === 'messages' ? t : 'blog'
  })
  const [counts, setCounts] = useState({ posts: 0, ratings: 0, messages: 0, unread: 0 })

  useEffect(() => {
    let alive = true
    Promise.all([
      api<{ meta: { total: number } }>('/staff/posts?per_page=1'),
      api<{ meta: { total: number } }>('/staff/ratings?per_page=1'),
      api<{ meta: { total: number } }>('/staff/messages?per_page=1'),
      api<{ meta: { total: number } }>('/staff/messages?per_page=1&unread_only=1'),
    ])
      .then(([p, r, m, u]) => {
        if (!alive) return
        setCounts({
          posts: p.meta.total,
          ratings: r.meta.total,
          messages: m.meta.total,
          unread: u.meta.total,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: { key: SubTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'blog', label: `Blog (${counts.posts})`, icon: <Newspaper className="h-4 w-4" /> },
    { key: 'ratings', label: `Reseñas (${counts.ratings})`, icon: <Star className="h-4 w-4" /> },
    {
      key: 'messages',
      label: `Mensajes (${counts.messages})`,
      icon: <MessageSquare className="h-4 w-4" />,
      badge: counts.unread > 0 ? `${counts.unread} sin leer` : undefined,
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              sub === t.key
                ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20'
                : 'border-brand-300 bg-white text-carbon-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${sub === t.key ? 'bg-white/20' : 'bg-brand-600 text-white'}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {sub === 'blog' && <Blog />}
        {sub === 'ratings' && <Ratings />}
        {sub === 'messages' && <Messages />}
      </div>
    </div>
  )
}
