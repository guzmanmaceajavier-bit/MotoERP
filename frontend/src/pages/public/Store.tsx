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
import type { Brand, Category, MotorcycleModel, Product, RecommendedCatalog } from '../../lib/types'
import { CategoryIcon } from '../../lib/categoryIcons'

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

/* ─────── image ─────── */
function ProductImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false)
  const show = src && !err
  return (
    <div className={`flex items-center justify-center overflow-hidden bg-carbon-100 ${className || 'h-48 w-full'}`}>
      {show ? (
        <img src={src} alt={alt} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 px-2 text-carbon-300">
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
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-carbon-100 bg-white shadow-sm transition hover:shadow-md">
      {/* image area */}
      <div className="relative">
        <ProductImage src={p.image} alt={p.name} className="h-48 w-full" />

        {/* badge: ORIGINAL / ALTERNATIVO */}
        <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          partType === 'original' ? 'bg-brand-600 text-white' : 'bg-amber-400 text-white'
        }`}>
          {partType === 'original' ? 'ORIGINAL' : 'ALTERNATIVO'}
        </span>

        {/* brand tag */}
        {p.brand && (
          <span className="absolute right-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-carbon-600 shadow-sm backdrop-blur">
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
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-carbon-900">{p.name}</h3>

        {p.description && (
          <p className="line-clamp-2 text-xs text-carbon-400">{p.description}</p>
        )}

        {/* price */}
        <div className="mt-auto flex items-baseline gap-2">
          {hasPromo && (
            <span className="text-xs text-carbon-400 line-through">{fmt(p.price)}</span>
          )}
          <span className="text-lg font-black text-brand-600">{fmt(price)}</span>
        </div>

        {/* stock */}
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${p.available !== false ? 'bg-emerald-500' : 'bg-rose-400'}`} />
          <span className={`text-[11px] font-medium ${p.available !== false ? 'text-emerald-600' : 'text-rose-500'}`}>
            {p.available !== false ? 'En stock' : 'Agotado'}
          </span>
        </div>

        {/* actions */}
        <div className="mt-1 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(p) }}
            className="flex-1 rounded-xl border border-carbon-200 bg-white px-3 py-2.5 text-xs font-semibold text-carbon-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            Ver detalle
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); add(p) }}
            disabled={p.available === false}
            className="flex-1 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="border-b border-carbon-100 py-4 first:pt-0">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-widest text-carbon-500">
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
    <button type="button" onClick={onChange} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${checked ? 'bg-brand-50 text-brand-700' : 'text-carbon-600 hover:bg-carbon-50'}`}>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-brand-600' : 'border-carbon-300'}`}>
        {checked && <span className="h-2 w-2 rounded-full bg-brand-600" />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-[11px] text-carbon-400">({count})</span>}
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
    <div className="flex items-center gap-4 rounded-2xl border border-carbon-100 bg-white p-3 shadow-sm transition hover:shadow-md">
      <ProductImage src={p.image} alt={p.name} className="h-20 w-20 shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-sm font-bold text-carbon-900 line-clamp-1">{p.name}</h3>
        <div className="flex items-center gap-2">
          {p.brand && <span className="text-[10px] font-bold uppercase text-brand-600">{p.brand}</span>}
          <span className={`text-[10px] font-bold uppercase ${p.part_type === 'original' ? 'text-brand-500' : 'text-amber-500'}`}>{p.part_type ?? 'original'}</span>
        </div>
        <span className="text-lg font-black text-brand-600">{fmt(price)}</span>
      </div>
      <div className="flex items-center gap-2">
        <HeartButton active={!!isFavorite} loading={favLoading} onClick={(e) => { e.stopPropagation(); onToggleFav?.(e, p) }} />
        <button onClick={() => onDetail(p)} className="rounded-xl border border-carbon-200 px-3 py-2 text-xs font-semibold text-carbon-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">Ver</button>
        <button onClick={() => add(p)} disabled={p.available === false} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">Agregar</button>
      </div>
    </div>
  )
}

/* ─────── section (recommended) ─────── */
function Section({ subtitle, products: items, highlight, onDetail, isFavorite, onToggleFav, favLoading }: {
  subtitle: string; products: Product[]; highlight?: string; onDetail: (p: Product) => void
  isFavorite?: (id: number) => boolean; onToggleFav?: (e: React.MouseEvent, p: Product) => void; favLoading?: boolean
}) {
  if (!items.length) return null
  return (
    <div className="mb-6">
      <p className="mb-3 text-sm font-semibold text-carbon-600">{subtitle}</p>
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

  /* data */
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [models, setModels] = useState<MotorcycleModel[]>([])
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
  const [sidebarOpen, setSidebarOpen] = useState({ brand: true, model: true, partType: true, category: true, price: false })
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
    api<Brand[]>('/brands').then(setBrands).catch(() => {})
    api<{ brands: any[]; models: any[]; part_types: any[]; price_range: any }>('/store/filters').then(setStoreFilters).catch(() => {})
  }, [])

  /* ─── models for selected brand ─── */
  useEffect(() => {
    setModel('')
    if (!brand) { setModels([]); return }
    api<MotorcycleModel[]>(`/brands/${brand}/models`).then(setModels).catch(() => setModels([]))
  }, [brand])

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
      <section className="relative flex min-h-[280px] items-center overflow-hidden bg-carbon-950 md:h-[340px]">
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,rgba(229,57,53,0.35)_0,transparent_42%),radial-gradient(circle_at_80%_70%,rgba(255,92,92,0.22)_0,transparent_40%)]" />
        <div className="absolute inset-0 dot-grid opacity-20" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                Stock en vivo
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
              Repuestos y accesorios <span className="gradient-text">para tu moto</span>
            </h1>
            <div className="mt-3 h-1 w-16 rounded-full bg-brand-500" />
            <p className="mt-5 max-w-md text-lg leading-relaxed text-carbon-300">
              Todos nuestros productos listos para envío o instalación en el taller. Busca, filtra y agrega a tu carrito.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-carbon-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full rounded-xl border border-carbon-700 bg-white/10 py-3 pl-11 pr-10 text-sm text-white placeholder:text-carbon-400 backdrop-blur transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-carbon-300 transition hover:bg-white/20" aria-label="Limpiar búsqueda">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ──── CATEGORY TILES (collapsible) ──── */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-carbon-200 bg-white p-3 shadow-sm">
            <button
              onClick={() => setCatsOpen((v) => !v)}
              className="flex flex-1 items-center gap-3 text-left"
              aria-expanded={catsOpen}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-carbon-900">Categorías</span>
                <span className="block text-xs text-carbon-500">
                  {category
                    ? `Filtrando: ${categories.find((c) => c.slug === category)?.name ?? 'Todas'}`
                    : 'Mostrando todas las categorías'}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {hasFilters && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-200 px-2.5 py-2 text-xs font-semibold text-carbon-500 transition hover:border-rose-300 hover:text-rose-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setCatsOpen((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${catsOpen ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-carbon-200 bg-white text-carbon-600 hover:border-brand-300 hover:text-brand-600'}`}
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
                <button onClick={() => scrollCats(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-carbon-200 bg-white text-carbon-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600" aria-label="Categorías anteriores">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div ref={catScrollRef} className="flex gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button onClick={() => setCategory('')} className={`flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-3 transition ${!category ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-carbon-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'}`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${!category ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-600'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>
                  </span>
                  <span className="text-center text-xs font-semibold leading-tight">Todas</span>
                </button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCategory(c.slug)} className={`flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-3 transition ${category === c.slug ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-carbon-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'}`}>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${category === c.slug ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-600'}`}>
                      <CategoryIcon name={c.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-center text-xs font-semibold leading-tight">{c.name}</span>
                    {c.products_count > 0 && (
                      <span className={`text-[10px] font-medium ${category === c.slug ? 'text-brand-600' : 'text-carbon-400'}`}>{c.products_count} items</span>
                    )}
                  </button>
                ))}
              </div>
                <button onClick={() => scrollCats(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-carbon-200 bg-white text-carbon-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600" aria-label="Siguientes categorías">
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
            <div className="sticky top-4 rounded-2xl border border-carbon-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-black text-carbon-900">FILTRAR PRODUCTOS</h3>
                {filterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{filterCount}</span>
                )}
              </div>

              {/* Category */}
              <FilterSection title="Categoría" open={sidebarOpen.category} onToggle={() => setSidebarOpen((s) => ({ ...s, category: !s.category }))}>
                <div className="space-y-0.5">
                  <RadioOption label="Todas las categorías" checked={!category} onChange={() => setCategory('')} />
                  {categories.map((c) => (
                    <RadioOption key={c.id} label={c.name} count={c.products_count} checked={category === c.slug} onChange={() => setCategory(c.slug)} />
                  ))}
                </div>
              </FilterSection>

              {/* Brand */}
              <FilterSection title="Marca de moto" open={sidebarOpen.brand} onToggle={() => setSidebarOpen((s) => ({ ...s, brand: !s.brand }))}>
                <div className="relative mb-2">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-carbon-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} placeholder="Buscar marca…" className="w-full rounded-lg border border-carbon-200 bg-carbon-50 py-1.5 pl-8 pr-2.5 text-xs text-carbon-700 placeholder:text-carbon-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10" />
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  <RadioOption label="Todas las marcas" checked={!brand} onChange={() => setBrand('')} />
                  {filteredBrands.map((b) => (
                    <RadioOption key={b.id} label={b.name} count={b.count} checked={brand === String(b.id)} onChange={() => setBrand(String(b.id))} />
                  ))}
                  {filteredBrands.length === 0 && <p className="py-2 text-center text-xs text-carbon-400">Sin resultados</p>}
                </div>
              </FilterSection>

              {/* Model */}
              <FilterSection title="Modelo de moto" open={sidebarOpen.model} onToggle={() => setSidebarOpen((s) => ({ ...s, model: !s.model }))}>
                <div className="relative mb-2">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-carbon-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="Buscar modelo…" className="w-full rounded-lg border border-carbon-200 bg-carbon-50 py-1.5 pl-8 pr-2.5 text-xs text-carbon-700 placeholder:text-carbon-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10" />
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  <RadioOption label={brand ? 'Todos los modelos' : 'Elige una marca'} checked={!model} onChange={() => setModel('')} />
                  {brand ? (
                    filteredModels.length > 0 ? (
                      filteredModels.map((m) => (
                        <RadioOption key={m.id} label={m.name} count={m.count} checked={model === String(m.id)} onChange={() => setModel(String(m.id))} />
                      ))
                    ) : (
                      <p className="py-2 text-center text-xs text-carbon-400">Sin modelos</p>
                    )
                  ) : (
                    <p className="py-2 text-center text-xs text-carbon-400">Selecciona una marca</p>
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
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-carbon-400">$</span>
                    <input
                      type="number"
                      min={0}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder={storeFilters ? String(Math.floor(storeFilters.price_range.min)) : 'Mín'}
                      className="w-full rounded-lg border border-carbon-200 bg-carbon-50 py-2 pl-6 pr-2 text-xs text-carbon-700 placeholder:text-carbon-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                    />
                  </div>
                  <span className="text-carbon-400">–</span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-carbon-400">$</span>
                    <input
                      type="number"
                      min={0}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder={storeFilters ? String(Math.ceil(storeFilters.price_range.max)) : 'Máx'}
                      className="w-full rounded-lg border border-carbon-200 bg-carbon-50 py-2 pl-6 pr-2 text-xs text-carbon-700 placeholder:text-carbon-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-carbon-400">
                  Rango disponible: {storeFilters ? `$${Math.floor(storeFilters.price_range.min).toLocaleString('es-CO')} – $${Math.ceil(storeFilters.price_range.max).toLocaleString('es-CO')}` : '…'}
                </p>
              </FilterSection>

              {/* Clear */}
              {filterCount > 0 && (
                <button onClick={clearFilters} className="mt-4 w-full rounded-xl border border-carbon-200 bg-white py-2.5 text-xs font-semibold text-carbon-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                  Limpiar filtros
                </button>
              )}
            </div>
          </aside>

          {/* ── CONTENT ── */}
          <div className="min-w-0 flex-1">
            {/* toolbar */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-carbon-500">
                <span className="font-bold text-carbon-800">{meta.total}</span> producto{meta.total === 1 ? '' : 's'}
                {category && ` en «${categories.find((c) => c.slug === category)?.name ?? ''}»`}
                {brand && ` · ${storeFilters?.brands.find((b) => String(b.id) === brand)?.name ?? ''}`}
                {model && ` · ${storeFilters?.models.find((m) => String(m.id) === model)?.name ?? ''}`}
                {partType && ` · ${partType === 'original' ? 'Original' : 'Alternativo'}`}
                {search.trim() && ` · "${search.trim()}"`}
              </p>
              <div className="flex items-center gap-2">
                <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="rounded-xl border border-carbon-300 bg-white px-2 py-2 text-sm text-carbon-900 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15" title="Productos por página">
                  <option value={12}>12 / pág</option>
                  <option value={24}>24 / pág</option>
                  <option value={48}>48 / pág</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-carbon-300 bg-white px-3 py-2 text-sm text-carbon-900 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15">
                  <option value="name">Nombre A-Z</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                  <option value="newest">Más recientes</option>
                </select>
                <div className="flex items-center gap-1 rounded-xl border border-carbon-200 bg-white p-1">
                  <button onClick={() => setView('grid')} title="Vista cuadrícula" className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === 'grid' ? 'bg-brand-600 text-white shadow-sm' : 'text-carbon-500 hover:bg-brand-50 hover:text-brand-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
                  </button>
                  <button onClick={() => setView('list')} title="Vista lista" className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === 'list' ? 'bg-brand-600 text-white shadow-sm' : 'text-carbon-500 hover:bg-brand-50 hover:text-brand-600'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* recommended */}
            {user && recommended && (
              <div className="mb-8 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50/60 to-white p-5 md:p-7">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-black text-carbon-900">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </span>
                    Recomendado para ti
                  </h2>
                  <span className="hidden rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600 shadow-sm sm:block">Basado en tu garaje</span>
                </div>
                {recommended.compatible && recommended.compatible.length > 0 && <Section subtitle="Compatible con tu garaje." products={recommended.compatible} highlight="brand" onDetail={goDetail} {...favProps} />}
                {recommended.lubricants && recommended.lubricants.length > 0 && <Section subtitle="Los adecuados para tu tipo de motor." products={recommended.lubricants} highlight="green" onDetail={goDetail} {...favProps} />}
                {recommended.accessories && recommended.accessories.length > 0 && <Section subtitle="Para complementar tu moto." products={recommended.accessories} highlight="blue" onDetail={goDetail} {...favProps} />}
                {recommended.promotions && recommended.promotions.length > 0 && <Section subtitle="Ofertas seleccionadas para ti." products={recommended.promotions} highlight="dark" onDetail={goDetail} {...favProps} />}
                {recommended.alternatives && recommended.alternatives.length > 0 && <Section subtitle="Alternativas de buena relación calidad-precio." products={recommended.alternatives} highlight="amber" onDetail={goDetail} {...favProps} />}
                {recommended.suggestions && recommended.suggestions.length > 0 && <Section subtitle="Otras sugerencias disponibles." products={recommended.suggestions} onDetail={goDetail} {...favProps} />}
              </div>
            )}

            {/* products */}
            {loading ? (
              <div className="mt-2"><GridSkeleton count={9} /></div>
            ) : products.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-carbon-300 bg-white p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                </span>
                <p className="text-sm font-medium text-carbon-600">No hay productos que coincidan con tu búsqueda.</p>
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
            { icon: 'truck', label: 'Envío gratis', sub: 'En pedidos +$150.000' },
            { icon: 'shield', label: 'Garantía', sub: 'Repuestos con garantía' },
            { icon: 'wrench', label: 'Instalación', sub: 'En nuestro taller' },
            { icon: 'headset', label: 'Asesoría', sub: 'Soporte experto' },
          ].map((t) => (
            <div key={t.icon} className="flex flex-col items-center gap-2 rounded-2xl border border-carbon-100 bg-white py-5 text-center shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                {t.icon === 'truck' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
                {t.icon === 'shield' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>}
                {t.icon === 'wrench' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>}
                {t.icon === 'headset' && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg>}
              </span>
              <p className="text-sm font-bold text-carbon-900">{t.label}</p>
              <p className="text-[11px] text-carbon-400">{t.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
