import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, getToken } from '../../lib/api'
import { useCart } from '../../lib/cart'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../lib/toast'
import { usePageMeta } from '../../lib/usePageMeta'
import Pagination from '../../components/Pagination'
import { GridSkeleton } from '../../components/Skeletons'
import type { Paginated } from '../../lib/pagination'
import type { Category, Product, RecommendedCatalog } from '../../lib/types'
import { CategoryIcon } from '../../lib/categoryIcons'
import { useHero } from '../../lib/useSiteImages'
import { HeroBg } from '../../components/HeroBg'

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

/* ─────── image ─────── */
function ProductImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false)
  const show = src && !err
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-gray-100 ${className || 'h-48 w-full'}`}>
      {show ? (
        <img src={src} alt={alt} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 px-2 text-gray-300">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-4.6-4.6a2 2 0 00-2.8 0L6 18" />
          </svg>
        </div>
      )}
    </div>
  )
}

/* ─────── heart ─────── */
function HeartButton({ active, loading, onClick }: { active: boolean; loading?: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      disabled={loading}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white active:scale-90 disabled:opacity-50"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={active ? '#f43f5e' : 'none'} stroke={active ? '#f43f5e' : '#666'} strokeWidth="2" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    </button>
  )
}

/* ─────── new ProductCard (reference style) ─────── */
function ProductCard({ p, onDetail, isFavorite, onToggleFav, favLoading }: {
  p: Product
  onDetail: (p: Product) => void
  isFavorite?: boolean
  onToggleFav?: (e: React.MouseEvent, p: Product) => void
  favLoading?: boolean
}) {
  const { add } = useCart()
  const hasPromo = p.promo_price != null && p.promo_price < p.price
  const price = p.final_price ?? p.price
  const partType = p.part_type ?? 'original'

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      {/* image area */}
      <div className="relative">
        <ProductImage src={p.image} alt={p.name} className="h-48 w-full" />

        {/* badge: ORIGINAL / ALTERNATIVO */}
        <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          partType === 'original' ? 'bg-orange-600 text-white' : 'bg-amber-400 text-white'
        }`}>
          {partType === 'original' ? 'ORIGINAL' : 'ALTERNATIVO'}
        </span>

        {/* brand tag */}
        {p.brand && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 shadow-sm backdrop-blur">
            {p.brand}
          </span>
        )}

        {/* heart */}
        <div className="absolute right-3 bottom-3 opacity-0 transition group-hover:opacity-100">
          <HeartButton
            active={!!isFavorite}
            loading={favLoading}
            onClick={(e) => { e.stopPropagation(); onToggleFav?.(e, p) }}
          />
        </div>
      </div>

      {/* content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">{p.name}</h3>

        {p.description && (
          <p className="line-clamp-2 text-xs text-gray-400">{p.description}</p>
        )}

        {/* price */}
        <div className="mt-auto flex items-baseline gap-2">
          {hasPromo && (
            <span className="text-xs text-gray-400 line-through">{fmt(p.price)}</span>
          )}
          <span className="text-lg font-black text-orange-600">{fmt(price)}</span>
        </div>

        {/* stock */}
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${p.available > 0 ? 'bg-emerald-500' : 'bg-rose-400'}`} />
          <span className={`text-[11px] font-medium ${p.available > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
            {p.available > 0 ? 'En stock' : 'Agotado'}
          </span>
        </div>

        {/* actions */}
        <div className="mt-1 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(p) }}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            Ver detalle
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); add({ productId: p.id, name: p.name, price, unit: p.unit, available: p.available, image: p.image, brand: p.brand }) }}
            disabled={p.available === 0}
            className="flex-1 rounded-xl bg-orange-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 hover:shadow active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────── sidebar filter section (collapsible) ─────── */
function FilterSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 py-4 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-500">
        {title}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

/* ─────── radio option with count ─────── */
function RadioOption({ label, count, checked, onChange }: { label: string; count?: number; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${checked ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-orange-600' : 'border-gray-300'}`}>
        {checked && <span className="h-2 w-2 rounded-full bg-orange-600" />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-[11px] text-gray-400">({count})</span>}
    </button>
  )
}

/* ─────── row list card ─────── */
function RowCard({ p, onDetail, isFavorite, onToggleFav, favLoading }: {
  p: Product; onDetail: (p: Product) => void; isFavorite?: boolean; onToggleFav?: (e: React.MouseEvent, p: Product) => void; favLoading?: boolean
}) {
  const { add } = useCart()
  const price = p.final_price ?? p.price
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow-md">
      <ProductImage src={p.image} alt={p.name} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{p.name}</h3>
        <div className="flex items-center gap-2">
          {p.brand && <span className="text-[10px] font-bold uppercase text-orange-600">{p.brand}</span>}
          <span className={`text-[10px] font-bold uppercase ${p.part_type === 'original' ? 'text-orange-500' : 'text-amber-500'}`}>{p.part_type ?? 'original'}</span>
        </div>
        <span className="text-lg font-black text-orange-600">{fmt(price)}</span>
      </div>
      <div className="flex items-center gap-2">
        <HeartButton active={!!isFavorite} loading={favLoading} onClick={(e) => { e.stopPropagation(); onToggleFav?.(e, p) }} />
        <button onClick={() => onDetail(p)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700">Ver</button>
        <button onClick={() => add({ productId: p.id, name: p.name, price, unit: p.unit, available: p.available, image: p.image, brand: p.brand })} disabled={p.available === 0} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700 active:scale-[0.97] disabled:opacity-50">Agregar</button>
      </div>
    </div>
  )
}

/* ─────── section (recommended) ─────── */
function Section({ subtitle, products: items, onDetail, isFavorite, onToggleFav, favLoading }: {
  subtitle: string; products: Product[]; onDetail: (p: Product) => void
  isFavorite?: (id: number) => boolean; onToggleFav?: (e: React.MouseEvent, p: Product) => void; favLoading?: boolean
}) {
  if (!items.length) return null
  return (
    <div className="mb-6">
      <p className="mb-3 text-sm font-semibold text-gray-600">{subtitle}</p>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <div key={p.id} className="w-44 shrink-0">
            <ProductCard p={p} onDetail={onDetail} isFavorite={isFavorite?.(p.id)} onToggleFav={onToggleFav} favLoading={favLoading} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Store() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast().toast
  const hero = useHero('store')
  const [workshopPhone, setWorkshopPhone] = useState('')

  useEffect(() => {
    api<{ workshop_phone: string }>('/site-info').then((d) => setWorkshopPhone(d.workshop_phone || '')).catch(() => {})
  }, [])

  /* data */
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [recommended, setRecommended] = useState<RecommendedCatalog | null>(null)
  const [storeFilters, setStoreFilters] = useState<{ brands: { id: number; name: string; count: number }[]; models: { id: number; name: string; brand_id: number; count: number }[]; part_types: { type: string; count: number }[]; price_range: { min: number; max: number } } | null>(null)

  /* filters */
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState(searchParams.get('brand') ?? '')
  const [model, setModel] = useState('')
  const [partType, setPartType] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [debouncedPrice, setDebouncedPrice] = useState<{ min: string; max: string }>({ min: '', max: '' })
  const [sort, setSort] = useState('name')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '')
  const [loading, setLoading] = useState(true)
  const [perPage, setPerPage] = useState(12)
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { const v = localStorage.getItem('tienda_view'); return v === 'list' || v === 'grid' ? v : 'grid' } catch { return 'grid' }
  })

  /* sidebar search */
  const [brandSearch, setBrandSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState({ brand: false, model: false, partType: false, category: false, price: false })
  const [catsOpen, setCatsOpen] = useState(false)

  /* favorites */
  const [favIds, setFavIds] = useState<Set<number>>(new Set())
  const [favToggling, setFavToggling] = useState<number | null>(null)
  const { user } = useAuth()
  const hasToken = !!getToken()
  const isPortal = hasToken
  const goDetail = (p: Product) => navigate(isPortal ? `/panel/producto/${p.slug}` : `/producto/${p.slug}`)

  usePageMeta(
    'Tienda de repuestos y accesorios para tu moto',
    'Repuestos originales y alternativos, accesorios y más con stock en vivo, envíos e instalación en el taller.',
  )

  /* ─── fetch products ─── */
  const fetchProducts = useCallback(
    (targetPage: number) => {
      setLoading(true)
      const params = new URLSearchParams({ per_page: String(perPage), page: String(targetPage) })
      if (category) params.set('category', category)
      if (brand) params.set('brand', brand)
      if (model) params.set('model', model)
      if (partType) params.set('part_type', partType)
      if (debouncedPrice.min) params.set('price_min', debouncedPrice.min)
      if (debouncedPrice.max) params.set('price_max', debouncedPrice.max)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (sort !== 'name') params.set('sort', sort)
      api<Paginated<Product>>(`/products?${params.toString()}`)
        .then((res) => {
          setProducts(res.data)
          setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [category, brand, model, partType, debouncedPrice.min, debouncedPrice.max, debouncedSearch, sort, perPage],
  )

  /* ─── initial data ─── */
  useEffect(() => {
    api<Category[]>('/categories').then(setCategories).catch(() => {})
    api<{ brands: any[]; models: any[]; part_types: any[]; price_range: any }>('/store/filters').then(setStoreFilters).catch(() => {})
  }, [])

  /* ─── recommended ─── */
  useEffect(() => {
    if (hasToken) api<RecommendedCatalog>('/store/recommended').then(setRecommended).catch(() => {})
  }, [hasToken])

  /* ─── favorites ─── */
  useEffect(() => {
    if (!hasToken) return
    api<{ data: Product[] }>('/favorites').then((r) => setFavIds(new Set((r.data ?? []).map((p) => p.id)))).catch(() => {})
  }, [hasToken])

  /* ─── debounce search ─── */
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t) }, [search])

  /* ─── debounce price ─── */
  useEffect(() => { const t = setTimeout(() => setDebouncedPrice({ min: priceMin, max: priceMax }), 400); return () => clearTimeout(t) }, [priceMin, priceMax])

  /* ─── fetch on filter change ─── */
  useEffect(() => { fetchProducts(1) }, [fetchProducts])

  /* ─── persist view preference ─── */
  useEffect(() => { try { localStorage.setItem('tienda_view', view) } catch {} }, [view])

  /* ─── derived ─── */
  const hasFilters = Boolean(category || brand || model || partType || priceMin || priceMax || search.trim())
  const clearFilters = () => { setCategory(''); setBrand(''); setModel(''); setPartType(''); setPriceMin(''); setPriceMax(''); setSort('name'); setSearch('') }

  const filteredBrands = useMemo(() => {
    if (!storeFilters) return []
    const q = brandSearch.toLowerCase()
    return q ? storeFilters.brands.filter((b) => b.name.toLowerCase().includes(q)) : storeFilters.brands
  }, [storeFilters, brandSearch])

  const filteredModels = useMemo(() => {
    if (!storeFilters) return []
    const q = modelSearch.toLowerCase()
    const list = brand ? storeFilters.models.filter((m) => m.brand_id === Number(brand)) : storeFilters.models
    return q ? list.filter((m) => m.name.toLowerCase().includes(q)) : list
  }, [storeFilters, brand, modelSearch])

  const catScrollRef = useRef<HTMLDivElement>(null)
  function scrollCats(dir: -1 | 1) {
    if (catScrollRef.current) catScrollRef.current.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }
  const filterCount = (brand ? 1 : 0) + (model ? 1 : 0) + (partType ? 1 : 0) + (priceMin || priceMax ? 1 : 0)

  /* ─── favorites handlers ─── */
  async function toggleFav(e: React.MouseEvent, p: Product) {
    e.preventDefault(); e.stopPropagation()
    if (!user) { toast.info('Inicia sesión para guardar favoritos'); navigate('/login'); return }
    const wasFav = favIds.has(p.id)
    setFavIds((prev) => { const n = new Set(prev); wasFav ? n.delete(p.id) : n.add(p.id); return n })
    setFavToggling(p.id)
    try {
      const res = await api<{ favorite: boolean }>('/favorites/toggle', { method: 'POST', body: JSON.stringify({ product_id: p.id }) })
      setFavIds((prev) => { const n = new Set(prev); res.favorite ? n.add(p.id) : n.delete(p.id); return n })
      toast.success(res.favorite ? 'Agregado a favoritos' : 'Quitado de favoritos')
    } catch {
      setFavIds((prev) => { const n = new Set(prev); wasFav ? n.add(p.id) : n.delete(p.id); return n })
      toast.error('No se pudo actualizar tus favoritos')
    } finally { setFavToggling(null) }
  }

  const fav = (id: number) => favIds.has(id)
  const favProps = { isFavorite: fav, onToggleFav: toggleFav, favLoading: favToggling !== null }

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div>
      {/* ──── HERO ──── */}
      <section className="relative overflow-hidden bg-white pb-10 pt-14 md:pt-20">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />

        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl text-center md:text-left">
              <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
                Tienda de repuestos <span className="gradient-text">y accesorios para tu moto</span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-500">
                Encuentra repuestos originales y accesorios de alta calidad para mantener tu moto siempre en su mejor versión.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:justify-start">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-500">🛡️</span>
                  Productos de calidad
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-500">🚚</span>
                  Envíos rápidos
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-500">↩️</span>
                  Devoluciones
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-500">🎧</span>
                  ¿Necesitas ayuda?
                </div>
              </div>
              <div className="relative mt-6 w-full max-w-sm mx-auto md:mx-0">
                <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto…"
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600" aria-label="Limpiar búsqueda">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
            {hero.images && hero.images.length > 0 && (
              <div className="relative shrink-0">
                <div className="relative h-[200px] w-[280px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 sm:h-[240px] sm:w-[340px] md:h-[280px] md:w-[400px]">
                  <HeroBg images={hero.images} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ──── CATEGORY TILES (collapsible) ──── */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <button
              onClick={() => setCatsOpen((v) => !v)}
              className="flex flex-1 items-center gap-3 text-left"
              aria-expanded={catsOpen}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-gray-900">Categorías</span>
                <span className="block text-xs text-gray-500">
                  {category
                    ? `Filtrando: ${categories.find((c) => c.slug === category)?.name ?? ''}`
                    : 'Mostrando todos los productos'}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {hasFilters && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-500 transition hover:border-rose-300 hover:text-rose-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setCatsOpen((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${catsOpen ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}
                aria-label={catsOpen ? 'Ocultar categorías' : 'Mostrar categorías'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${catsOpen ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          {catsOpen && (
            <div className="anim-fade-up mt-3">
              <div className="flex items-center gap-2">
                <button onClick={() => scrollCats(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-orange-300 hover:text-orange-600" aria-label="Categorías anteriores">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div ref={catScrollRef} className="flex gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCategory(c.slug)} className={`flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-3 transition ${category === c.slug ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${category === c.slug ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-600'}`}>
                      <CategoryIcon name={c.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-center text-xs font-semibold leading-tight">{c.name}</span>
                    {c.products_count > 0 && (
                      <span className={`text-[10px] font-medium ${category === c.slug ? 'text-orange-600' : 'text-gray-400'}`}>{c.products_count} items</span>
                    )}
                  </button>
                ))}
              </div>
                <button onClick={() => scrollCats(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:border-orange-300 hover:text-orange-600" aria-label="Siguientes categorías">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ──── SIDEBAR + PRODUCTS LAYOUT ──── */}
        <div className="flex gap-6">
          {/* ── SIDEBAR ── */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="sticky top-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900">FILTRAR PRODUCTOS</h3>
                {filterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">{filterCount}</span>
                )}
              </div>

              {/* Category */}
              <FilterSection title="Categoría" open={sidebarOpen.category} onToggle={() => setSidebarOpen((s) => ({ ...s, category: !s.category }))}>
                <div className="space-y-0.5">
                  {categories.map((c) => (
                    <RadioOption key={c.id} label={c.name} count={c.products_count} checked={category === c.slug} onChange={() => setCategory(c.slug)} />
                  ))}
                </div>
              </FilterSection>

              {/* Brand */}
              <FilterSection title="Marca de moto" open={sidebarOpen.brand} onToggle={() => setSidebarOpen((s) => ({ ...s, brand: !s.brand }))}>
                <div className="relative mb-2">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} placeholder="Buscar marca…" className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10" />
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  <RadioOption label="Todas las marcas" checked={!brand} onChange={() => setBrand('')} />
                  {filteredBrands.map((b) => (
                    <RadioOption key={b.id} label={b.name} count={b.count} checked={brand === String(b.id)} onChange={() => setBrand(String(b.id))} />
                  ))}
                  {filteredBrands.length === 0 && <p className="py-2 text-center text-xs text-gray-400">Sin resultados</p>}
                </div>
              </FilterSection>

              {/* Model */}
              <FilterSection title="Modelo de moto" open={sidebarOpen.model} onToggle={() => setSidebarOpen((s) => ({ ...s, model: !s.model }))}>
                <div className="relative mb-2">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Buscar modelo…" className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10" />
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  <RadioOption label={brand ? 'Todos los modelos' : 'Elige una marca'} checked={!model} onChange={() => setModel('')} />
                  {brand ? (
                    filteredModels.length > 0 ? (
                      filteredModels.map((m) => (
                        <RadioOption key={m.id} label={m.name} count={m.count} checked={model === String(m.id)} onChange={() => setModel(String(m.id))} />
                      ))
                    ) : (
                      <p className="py-2 text-center text-xs text-gray-400">Sin modelos</p>
                    )
                  ) : (
                    <p className="py-2 text-center text-xs text-gray-400">Selecciona una marca</p>
                  )}
                </div>
              </FilterSection>

              {/* Part type */}
              <FilterSection title="Tipo de repuesto" open={sidebarOpen.partType} onToggle={() => setSidebarOpen((s) => ({ ...s, partType: !s.partType }))}>
                <div className="space-y-0.5">
                  <RadioOption label="Todos" checked={!partType} onChange={() => setPartType('')} />
                  {storeFilters?.part_types.map((pt) => (
                    <RadioOption key={pt.type} label={pt.type === 'original' ? 'Original' : 'Alternativo'} count={pt.count} checked={partType === pt.type} onChange={() => setPartType(pt.type)} />
                  ))}
                </div>
              </FilterSection>

              {/* Price */}
              <FilterSection title="Precio" open={sidebarOpen.price} onToggle={() => setSidebarOpen((s) => ({ ...s, price: !s.price }))}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder={storeFilters ? String(Math.floor(storeFilters.price_range.min)) : 'Mín'}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-6 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                    />
                  </div>
                  <span className="text-gray-400">–</span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder={storeFilters ? String(Math.ceil(storeFilters.price_range.max)) : 'Máx'}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-6 pr-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  Rango disponible: {storeFilters ? `$${Math.floor(storeFilters.price_range.min).toLocaleString('es-CO')} – $${Math.ceil(storeFilters.price_range.max).toLocaleString('es-CO')}` : '…'}
                </p>
              </FilterSection>

              {/* Clear */}
              {filterCount > 0 && (
                <button onClick={clearFilters} className="mt-4 w-full rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700">
                  Limpiar filtros
                </button>
              )}
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <div className="min-w-0 flex-1">
            {/* toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-gray-800">{meta.total}</span> producto{meta.total === 1 ? '' : 's'}
                {category && ` en «${categories.find((c) => c.slug === category)?.name ?? ''}»`}
                {brand && ` · ${storeFilters?.brands.find((b) => String(b.id) === brand)?.name ?? ''}`}
                {model && ` · ${storeFilters?.models.find((m) => String(m.id) === model)?.name ?? ''}`}
                {partType && ` · ${partType === 'original' ? 'Original' : 'Alternativo'}`}
                {search.trim() && ` · "${search.trim()}"`}
              </p>
              <div className="flex items-center gap-2">
                <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="rounded-xl border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15" title="Productos por página">
                  <option value={12}>12 / pág</option>
                  <option value={24}>24 / pág</option>
                  <option value={48}>48 / pág</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/15">
                  <option value="name">Nombre A-Z</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                  <option value="newest">Más recientes</option>
                </select>
                <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
                  <button onClick={() => setView('grid')} title="Vista cuadrícula" className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === 'grid' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
                  </button>
                  <button onClick={() => setView('list')} title="Vista lista" className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === 'list' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:bg-orange-50 hover:text-orange-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* recommended */}
            {user && recommended && (
              <div className="mb-8 rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-white p-5 md:p-7">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </span>
                    Recomendado para ti
                  </h2>
                  <span className="hidden rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 shadow-sm sm:block">Basado en tu garaje</span>
                </div>
                {recommended.compatible && recommended.compatible.length > 0 && <Section subtitle="Compatible con tu garaje." products={recommended.compatible} onDetail={goDetail} {...favProps} />}
                {recommended.lubricants && recommended.lubricants.length > 0 && <Section subtitle="Los adecuados para tu tipo de motor." products={recommended.lubricants} onDetail={goDetail} {...favProps} />}
                {recommended.accessories && recommended.accessories.length > 0 && <Section subtitle="Para complementar tu moto." products={recommended.accessories} onDetail={goDetail} {...favProps} />}
                {recommended.promotions && recommended.promotions.length > 0 && <Section subtitle="Ofertas seleccionadas para ti." products={recommended.promotions} onDetail={goDetail} {...favProps} />}
                {recommended.alternatives && recommended.alternatives.length > 0 && <Section subtitle="Alternativas de buena relación calidad-precio." products={recommended.alternatives} onDetail={goDetail} {...favProps} />}
                {recommended.suggestions && recommended.suggestions.length > 0 && <Section subtitle="Otras sugerencias disponibles." products={recommended.suggestions} onDetail={goDetail} {...favProps} />}
              </div>
            )}

            {/* products */}
            {loading ? (
              <div className="mt-2"><GridSkeleton count={9} /></div>
            ) : products.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                </span>
                <p className="text-sm font-medium text-gray-600">No hay productos que coincidan con tu búsqueda.</p>
                <button onClick={clearFilters} className="btn-outline">Limpiar filtros</button>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} onDetail={goDetail} isFavorite={fav(p.id)} onToggleFav={toggleFav} favLoading={favToggling === p.id} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {products.map((p) => (
                  <RowCard key={p.id} p={p} onDetail={goDetail} isFavorite={fav(p.id)} onToggleFav={toggleFav} favLoading={favToggling === p.id} />
                ))}
              </div>
            )}

            <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={(p) => fetchProducts(p)} />
          </div>
        </div>

        {/* ──── TRUST BAR ──── */}
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: '🛡️', label: 'Productos 100% originales', sub: 'Trabajamos con las mejores marcas del mercado.' },
            { icon: '✅', label: 'Garantía asegurada', sub: 'Todos nuestros productos cuentan con garantía.' },
            { icon: '📦', label: 'Empaque seguro', sub: 'Tus pedidos llegan en perfectas condiciones.' },
            { icon: '🎧', label: 'Atención personalizada', sub: 'Te ayudamos a encontrar lo que tu moto necesita.' },
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg">{t.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-900">{t.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ──── CTA WHATSAPP ──── */}
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-gray-100 bg-white px-8 py-8 shadow-sm sm:flex-row sm:justify-between sm:px-12">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-2xl">🔍</div>
            <div>
              <h2 className="text-lg font-black text-gray-900">¿No encuentras lo que buscas?</h2>
              <p className="text-sm text-gray-500">Escríbenos y te ayudamos a encontrar el repuesto ideal para tu moto.</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${workshopPhone || '3000000000'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all duration-300 hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-600/30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contáctanos por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
