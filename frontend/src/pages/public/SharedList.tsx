import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Product, SharedFavorites } from '../../lib/types'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function ProductImage({ p }: { p: Product }) {
  const [err, setErr] = useState(false)
  return (
    <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-carbon-100">
      {p.image && !err ? (
        <img src={p.image} alt={p.name} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm text-carbon-400">{p.category || 'Producto'}</span>
      )}
    </div>
  )
}

export default function SharedList() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedFavorites | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const res = await api<SharedFavorites>(`/shared-favorites/${token}`)
        setData(res)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lista no encontrada')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {loading ? (
        <div className="flex items-center gap-3 py-16 text-carbon-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Cargando lista…
        </div>
      ) : error || !data ? (
        <div className="rounded-3xl border border-dashed border-carbon-300 bg-white p-12 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-carbon-100 text-carbon-400">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          </span>
          <h1 className="text-xl font-bold text-carbon-800">Lista no encontrada</h1>
          <p className="mt-1 text-sm text-carbon-500">El enlace no es válido o la lista fue eliminada.</p>
          <Link to="/tienda" className="btn-primary mt-6">Ir a la tienda</Link>
        </div>
      ) : (
        <div>
          <section className="relative overflow-hidden rounded-3xl border border-carbon-200 bg-white p-6 shadow-lg shadow-carbon-900/5 md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-500/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip bg-rose-100 text-rose-700">Wishlist compartida</span>
                  </div>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-carbon-900 md:text-3xl">
                    Los favoritos de <span className="gradient-text">{data.owner || 'un cliente'}</span>
                  </h1>
                  <p className="mt-1 text-sm text-carbon-500">
                    {data.data.length} producto{data.data.length === 1 ? '' : 's'} guardados en la tienda.
                  </p>
                </div>
              </div>
              <Link to="/tienda" className="btn-primary shrink-0">Explorar la tienda</Link>
            </div>
          </section>

          {data.data.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-carbon-300 bg-white p-10 text-center text-carbon-500">
              Esta lista está vacía.
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((p) => {
                const hasPromo = p.promo_price != null && p.promo_price < p.price
                const price = p.final_price ?? p.price
                const off = hasPromo ? Math.round((1 - p.promo_price! / p.price) * 100) : 0
                return (
                  <div key={p.id} className="card flex flex-col p-4">
                    <Link to={`/producto/${p.slug}`} className="flex-1">
                      <div className="relative">
                        {hasPromo && (
                          <span className="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                            -{off}%
                          </span>
                        )}
                        <ProductImage p={p} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.category && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.category}</span>}
                        {p.brand && <span className="text-xs text-carbon-400">{p.brand}</span>}
                      </div>
                      <h3 className="mt-2 line-clamp-1 font-semibold text-carbon-900">{p.name}</h3>
                    </Link>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        {hasPromo && <span className="block text-xs line-through text-carbon-400">{fmt(p.price)}</span>}
                        <span className="text-lg font-bold text-carbon-900">{fmt(price)}</span>
                        <span className="text-xs text-carbon-400"> / {p.unit}</span>
                      </div>
                      <span className={`text-xs font-medium ${p.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {p.available > 0 ? 'Disponible' : 'Agotado'}
                      </span>
                    </div>
                    <Link
                      to={`/producto/${p.slug}`}
                      className="mt-4 rounded-xl bg-brand-600 py-2.5 text-center font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      Ver producto
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}