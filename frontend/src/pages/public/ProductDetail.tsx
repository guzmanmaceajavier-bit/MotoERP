import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, getToken } from '../../lib/api'
import { setLastProductName } from '../../lib/pageMeta'
import { useCart } from '../../lib/cart'
import BackLink from '../../components/BackLink'
import type { Product } from '../../lib/types'

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { add } = useCart()
  const hasToken = !!getToken()
  const inPortal = hasToken
  const homePath = inPortal ? '/panel' : '/'
  const storePath = inPortal ? '/panel/tienda' : '/tienda'
  const cartPath = hasToken ? '/panel/carrito' : '/carrito'
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qty, setQty] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setQty(1)
    setSelectedVariant(null)
    api<Product>(`/products/${slug}`)
      .then((p) => {
        setProduct(p)
        setLastProductName(p.name)
      })
      .catch(() => setError('No pudimos encontrar este producto.'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const [imgBroken, setImgBroken] = useState(false)

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-4 w-32 animate-pulse rounded bg-carbon-200" />
        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-carbon-200" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-carbon-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-carbon-200" />
            <div className="h-24 w-full animate-pulse rounded bg-carbon-200" />
            <div className="h-10 w-1/2 animate-pulse rounded bg-carbon-200" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-carbon-900">Producto no encontrado</h1>
        <p className="mt-2 text-carbon-500">{error}</p>
        <Link to={storePath} className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700">
          Volver a la tienda
        </Link>
      </div>
    )
  }

  const hasPromo = product.promo_price != null && product.promo_price < product.price
  const price = product.final_price ?? product.price
  const show = product.image && !imgBroken

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-carbon-500">
        <Link to={homePath} className="hover:text-brand-600">Inicio</Link>
        <span>›</span>
        <Link to={storePath} className="hover:text-brand-600">Tienda</Link>
        <span>›</span>
        {product.category && (
          <>
            <span className="hover:text-brand-600">{product.category}</span>
            <span>›</span>
          </>
        )}
        <span className="font-medium text-carbon-900">{product.name}</span>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex items-center justify-center overflow-hidden rounded-2xl border border-carbon-200 bg-carbon-50">
          {show ? (
            <img
              src={product.image}
              alt={product.name}
              onError={() => setImgBroken(true)}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-carbon-400">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-4.6-4.6a2 2 0 00-2.8 0L6 18" />
              </svg>
              <span className="text-sm">{product.category || 'Producto'}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex flex-wrap gap-2">
            {product.category && <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-xs font-medium text-carbon-600">{product.category}</span>}
            {product.brand && <span className="rounded-full bg-carbon-100 px-2 py-0.5 text-xs font-medium text-carbon-600">{product.brand}</span>}
            {product.part_type === 'alternativo' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Alternativo</span>}
            {hasPromo && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">Oferta</span>}
          </div>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-carbon-900">{product.name}</h1>

          <div className="mt-3">
            {hasPromo && <span className="mr-2 text-lg line-through text-carbon-400">{fmt(product.price)}</span>}
            <span className="text-3xl font-black text-brand-600">
              {fmt(price)} <span className="text-base font-normal text-carbon-400">/ {product.unit}</span>
            </span>
          </div>

          <p className={`mt-2 text-sm font-medium ${product.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {product.available > 0 ? `${product.available} unidades disponibles` : 'Agotado'}
          </p>

          <p className="mt-5 leading-relaxed text-carbon-700">{product.description}</p>

          {product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <span className="text-sm font-semibold text-carbon-800">Color</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setSelectedVariant(v.name)}
                    title={v.name}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                      selectedVariant === v.name
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-carbon-200 text-carbon-700 hover:border-carbon-400'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full border border-carbon-300" style={{ backgroundColor: v.hex }} />
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.available > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm font-medium text-carbon-700">Cantidad:</span>
              <div className="flex items-center rounded-lg border border-carbon-200">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-l-lg text-carbon-600 transition hover:bg-carbon-100"
                >
                  −
                </button>
                <span className="flex h-10 w-14 items-center justify-center border-x border-carbon-200 text-sm font-semibold text-carbon-900">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(product.available, q + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-r-lg text-carbon-600 transition hover:bg-carbon-100"
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              disabled={product.available <= 0}
              onClick={() => {
                const vObj = product.variants?.find((v) => v.name === selectedVariant)
                add(
                  { productId: product.id, name: product.name, price, unit: product.unit, available: product.available, image: product.image, brand: product.brand, variant: vObj ? { name: vObj.name, hex: vObj.hex } : undefined },
                  qty,
                )
                navigate(cartPath)
              }}
              className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Comprar ahora
            </button>
            <button
              disabled={product.available <= 0}
              onClick={() => {
                const vObj = product.variants?.find((v) => v.name === selectedVariant)
                add(
                  { productId: product.id, name: product.name, price, unit: product.unit, available: product.available, image: product.image, brand: product.brand, variant: vObj ? { name: vObj.name, hex: vObj.hex } : undefined },
                  qty,
                )
              }}
              className="flex-1 rounded-xl border-2 border-brand-600 py-3 font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Agregar al carrito
            </button>
          </div>

          <div className="mt-4">
            <BackLink>Volver a la tienda</BackLink>
          </div>
        </div>
      </div>
    </div>
  )
}
