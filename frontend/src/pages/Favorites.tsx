import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useCart } from '../lib/cart'
import { useToast } from '../lib/toast'
import { EmptyState, StatCard } from '../components/ui'
import { GridSkeleton, RowSkeleton } from '../components/Skeletons'
import { Modal, ConfirmDialog } from '../components/ui/modal'
import type { CompareResponse, PriceHistoryPoint, Product } from '../lib/types'
import { useRefetchOnFocus } from '../lib/useRefetch'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const selectCls =
  'rounded-xl border border-carbon-300 bg-white px-3 py-2 text-sm text-carbon-900 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

type Sort = 'recent' | 'name' | 'price_asc' | 'price_desc'

function ProductImage({ p, className = '' }: { p: Product; className?: string }) {
  const [err, setErr] = useState(false)
  return (
    <div className={`flex ${className || 'h-40 w-full'} items-center justify-center overflow-hidden bg-carbon-100`}>
      {p.image && !err ? (
        <img src={p.image} alt={p.name} onError={() => setErr(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 px-2 text-carbon-400">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="M21 15l-4.6-4.6a2 2 0 00-2.8 0L6 18" />
          </svg>
          <span className="text-center text-xs">{p.category || 'Producto'}</span>
        </div>
      )}
    </div>
  )
}

function ActionButtons({ p, removing, onRemove, onToggleStock, onOpenPriceAlert, onCompare }: {
  p: Product
  removing: boolean
  onRemove: (e: React.MouseEvent) => void
  onToggleStock: (e: React.MouseEvent, p: Product) => void
  onOpenPriceAlert: (e: React.MouseEvent, p: Product) => void
  onCompare: (e: React.MouseEvent, p: Product) => void
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleStock(e, p) }}
        title={p.stock_alert ? 'Quitar aviso de stock' : 'Avísame cuando vuelva el stock'}
        aria-label={p.stock_alert ? 'Quitar aviso de stock' : 'Avísame cuando vuelva el stock'}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-90 ${
          p.stock_alert
            ? 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-400/40 dark:bg-sky-500/10'
            : 'border-carbon-200 text-carbon-400 hover:border-sky-300 hover:text-sky-500 dark:border-carbon-200'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpenPriceAlert(e, p) }}
        title={p.price_alert ? `Alerta de precio activa: ${fmt(p.price_alert)}` : 'Avísame si baja a un precio objetivo'}
        aria-label="Alerta de precio"
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition active:scale-90 ${
          p.price_alert
            ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/40 dark:bg-amber-500/10'
            : 'border-carbon-200 text-carbon-400 hover:border-amber-300 hover:text-amber-500 dark:border-carbon-200'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 14.15l-6.41 6.41a2 2 0 01-2.83 0L2.6 11.9A2 2 0 012 10.48V4a2 2 0 012-2h6.48a2 2 0 011.41.59l8.7 8.7a2 2 0 010 2.84z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCompare(e, p) }}
        title="Comparar precios de otras marcas"
        aria-label="Comparar precios"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-carbon-200 text-carbon-400 transition hover:border-brand-300 hover:text-brand-600 active:scale-90 dark:border-carbon-200"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Quitar de favoritos"
        aria-label="Quitar de favoritos"
        disabled={removing}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-carbon-200 text-carbon-400 transition hover:border-rose-300 hover:text-rose-500 active:scale-90 disabled:opacity-50 dark:border-carbon-200"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
      </button>
    </div>
  )
}

function MiniSparkline({ history }: { history: PriceHistoryPoint[] }) {
  const pts = history.slice().reverse()
  if (pts.length < 2) return null
  const values = pts.map((h) => h.final_price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 120
  const h = 28
  const coords = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ')
  const last = values[values.length - 1]
  const first = values[0]
  const down = last <= first
  const color = down ? (last < first ? '#16a34a' : '#0891b2') : '#16a34a'
  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <polyline points={coords} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>
        {last < first ? `▼ ${fmt(first - last)}` : last > first ? `▲ ${fmt(last - first)}` : 'Sin cambios'}
      </span>
    </div>
  )
}

function GridCard({ p, removing, inCart, onDetail, onRemove, onToggleStock, onOpenPriceAlert, onCompare }: {
  p: Product
  removing: boolean
  inCart: boolean
  onDetail: () => void
  onRemove: (e: React.MouseEvent) => void
  onToggleStock: (e: React.MouseEvent, p: Product) => void
  onOpenPriceAlert: (e: React.MouseEvent, p: Product) => void
  onCompare: (e: React.MouseEvent, p: Product) => void
}) {
  const { add } = useCart()
  const hasPromo = p.promo_price != null && p.promo_price < p.price
  const price = p.final_price ?? p.price
  const off = hasPromo ? Math.round((1 - p.promo_price! / p.price) * 100) : 0
  const firstVariant = (p.variants ?? [])[0] ? { name: (p.variants ?? [])[0].name, hex: (p.variants ?? [])[0].hex } : undefined

  return (
    <div className="card lift group relative flex flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between">
        {p.category ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.category}</span>
        ) : (
          <span />
        )}
        {p.brand && <span className="text-xs text-carbon-400">{p.brand}</span>}
      </div>

      <div onClick={onDetail} className="relative mt-3 cursor-pointer">
        {hasPromo && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow">
            -{off}%
          </span>
        )}
        <ProductImage p={p} className="h-40 w-full overflow-hidden rounded-xl transition duration-500 group-hover:scale-[1.03]" />
        {p.stock_alert && (
          <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-sky-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
            Stock
          </span>
        )}
        {p.price_alert && (
          <span className="absolute bottom-2 right-2 z-10 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            Meta {fmt(p.price_alert)}
          </span>
        )}
      </div>

      <button onClick={onDetail} className="mt-3 text-left">
        <h3 className="line-clamp-1 font-semibold text-carbon-900">{p.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-carbon-600">{p.description}</p>
      </button>

      <div className="mt-3 flex items-end justify-between">
        <div>
          {hasPromo && <span className="block text-xs line-through text-carbon-400">{fmt(p.price)}</span>}
          <span className="text-lg font-bold text-carbon-900">{fmt(price)}</span>
          <span className="text-xs text-carbon-400"> / {p.unit}</span>
        </div>
        <span className={`text-xs font-medium ${p.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {p.available > 0 ? `Disponible (${p.available})` : 'Agotado'}
        </span>
      </div>

      <div className="mt-3">
        <ActionButtons p={p} removing={removing} onRemove={onRemove} onToggleStock={onToggleStock} onOpenPriceAlert={onOpenPriceAlert} onCompare={onCompare} />
      </div>

      {inCart ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          En el carrito
        </div>
      ) : (
        <button
          disabled={p.available <= 0}
          onClick={() => add({ productId: p.id, name: p.name, price, unit: p.unit, available: p.available, image: p.image, brand: p.brand, variant: firstVariant })}
          className="mt-3 rounded-xl bg-brand-600 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {p.available <= 0 ? 'Agotado' : 'Agregar al carrito'}
        </button>
      )}
    </div>
  )
}

function RowCard({ p, removing, inCart, onDetail, onRemove, onToggleStock, onOpenPriceAlert, onCompare }: {
  p: Product
  removing: boolean
  inCart: boolean
  onDetail: () => void
  onRemove: (e: React.MouseEvent) => void
  onToggleStock: (e: React.MouseEvent, p: Product) => void
  onOpenPriceAlert: (e: React.MouseEvent, p: Product) => void
  onCompare: (e: React.MouseEvent, p: Product) => void
}) {
  const { add } = useCart()
  const hasPromo = p.promo_price != null && p.promo_price < p.price
  const price = p.final_price ?? p.price
  const firstVariant = (p.variants ?? [])[0] ? { name: (p.variants ?? [])[0].name, hex: (p.variants ?? [])[0].hex } : undefined

  return (
    <div className="card group flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div onClick={onDetail} className="group relative shrink-0 cursor-pointer overflow-hidden rounded-xl bg-carbon-100">
        <ProductImage p={p} className="h-24 w-24 overflow-hidden rounded-xl transition duration-500 group-hover:scale-105" />
        {hasPromo && (
          <span className="absolute left-1 top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            -{Math.round((1 - p.promo_price! / p.price) * 100)}%
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <button onClick={onDetail} className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            {p.category && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{p.category}</span>}
            {p.brand && <span className="text-xs text-carbon-400">{p.brand}</span>}
            {p.stock_alert && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
                Aviso stock
              </span>
            )}
            {p.price_alert && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 14.15l-6.41 6.41a2 2 0 01-2.83 0L2.6 11.9A2 2 0 012 10.48V4a2 2 0 012-2h6.48a2 2 0 011.41.59l8.7 8.7a2 2 0 010 2.84z" /></svg>
                Meta {fmt(p.price_alert)}
              </span>
            )}
          </div>
          <h3 className="mt-1 font-semibold text-carbon-900">{p.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-carbon-600">{p.description}</p>
        </button>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-2">
            {hasPromo && <span className="text-xs line-through text-carbon-400">{fmt(p.price)}</span>}
            <p className="text-lg font-bold text-carbon-900">{fmt(price)}</p>
            <span className="text-xs text-carbon-400">/ {p.unit}</span>
          </div>
          <span className={`text-xs font-medium ${p.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {p.available > 0 ? `Disponible (${p.available})` : 'Agotado'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:items-end">
        <ActionButtons p={p} removing={removing} onRemove={onRemove} onToggleStock={onToggleStock} onOpenPriceAlert={onOpenPriceAlert} onCompare={onCompare} />
        {inCart ? (
          <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            En el carrito
          </div>
        ) : (
          <button
            disabled={p.available <= 0}
onClick={() => add({ productId: p.id, name: p.name, price, unit: p.unit, available: p.available, image: p.image, brand: p.brand, variant: firstVariant })}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Agregar
          </button>
        )}
      </div>
    </div>
  )
}

export default function Favorites() {
  const navigate = useNavigate()
  const toast = useToast().toast
  const { add, items: cartItems } = useCart()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try {
      const v = localStorage.getItem('favoritos_view')
      return v === 'list' || v === 'grid' ? v : 'grid'
    } catch {
      return 'grid'
    }
  })
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [priceAlertFor, setPriceAlertFor] = useState<Product | null>(null)
  const [priceTarget, setPriceTarget] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)
  const [compareFor, setCompareFor] = useState<Product | null>(null)
  const [compareData, setCompareData] = useState<CompareResponse | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Product[] }>('/favorites')
      setItems(res.data ?? [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRefetchOnFocus(() => load())

  useEffect(() => {
    try { localStorage.setItem('favoritos_view', view) } catch { /* ignore */ }
  }, [view])

  const inCartIds = useMemo(() => new Set(cartItems.map((c) => c.productId)), [cartItems])

  const filtered = useMemo(() => {
    let list = items
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        [p.name, p.description, p.category, p.brand, p.part_type].some((s) => (s ?? '').toLowerCase().includes(q)),
      )
    }
    if (category) list = list.filter((p) => p.category === category)
    return list
  }, [items, query, category])

  const sorted = useMemo(() => {
    const list = [...filtered]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'price_asc') list.sort((a, b) => (a.final_price ?? a.price) - (b.final_price ?? b.price))
    if (sort === 'price_desc') list.sort((a, b) => (b.final_price ?? a.price) - (a.final_price ?? b.price))
    return list
  }, [filtered, sort])

  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((p) => p.category && set.add(p.category))
    return [...set].sort()
  }, [items])

  const stats = useMemo(() => {
    const total = items.length
    const onSale = items.filter((p) => p.promo_price != null && p.promo_price < p.price).length
    const value = items.reduce((acc, p) => acc + (p.final_price ?? p.price), 0)
    const available = items.filter((p) => p.available > 0).length
    const alerts = items.filter((p) => p.stock_alert || p.price_alert).length
    return { total, onSale, value, available, alerts }
  }, [items])

  const hasFilters = Boolean(query.trim() || category)
  const clearFilters = () => {
    setQuery('')
    setCategory('')
  }

  const goDetail = (p: Product) => navigate(`/panel/producto/${p.slug}`)

  async function remove(p: Product) {
    setRemoving((prev) => new Set(prev).add(p.id))
    const wasIn = items.some((x) => x.id === p.id)
    setItems((prev) => prev.filter((x) => x.id !== p.id))
    try {
      await api(`/favorites/${p.id}`, { method: 'DELETE' })
      toast.success('Quitado de favoritos')
    } catch {
      if (wasIn) setItems((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]))
      toast.error('No se pudo actualizar')
    } finally {
      setRemoving((prev) => {
        const n = new Set(prev)
        n.delete(p.id)
        return n
      })
    }
  }

  async function clearAll() {
    setClearing(true)
    try {
      await api('/favorites/clear', { method: 'POST' })
      setItems([])
      setConfirmClear(false)
      toast.success('Favoritos vaciados')
    } catch {
      toast.error('No se pudo vaciar la lista')
    } finally {
      setClearing(false)
    }
  }

  function addAll() {
    const addable = items.filter((p) => p.available > 0)
    if (!addable.length) {
      toast.info('No hay productos disponibles')
      return
    }
    addable.forEach((p) =>
      add({
        productId: p.id, name: p.name, price: p.final_price ?? p.price, unit: p.unit, available: p.available, image: p.image, brand: p.brand,
        variant: (p.variants ?? [])[0] ? { name: (p.variants ?? [])[0].name, hex: (p.variants ?? [])[0].hex } : undefined,
      }),
    )
    toast.success(`${addable.length} producto${addable.length === 1 ? '' : 's'} agregado${addable.length === 1 ? '' : 's'} al carrito`)
  }

  async function toggleStock(_e: React.MouseEvent, p: Product) {
    try {
      const res = await api<{ stock_alert: boolean }>(`/favorites/${p.id}/stock-alert`, { method: 'POST' })
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock_alert: res.stock_alert } : x)))
      toast.success(res.stock_alert ? 'Te avisaremos cuando vuelva el stock' : 'Aviso de stock desactivado')
    } catch {
      toast.error('No se pudo actualizar el aviso')
    }
  }

  function openPriceAlert(_e: React.MouseEvent, p: Product) {
    setPriceAlertFor(p)
    setPriceTarget(p.price_alert ? String(p.price_alert) : '')
  }

  async function savePriceAlert() {
    if (!priceAlertFor) return
    const target = parseFloat(priceTarget.replace(/[^0-9.]/g, ''))
    if (!target || target <= 0) {
      toast.error('Escribe un precio válido')
      return
    }
    setPriceSaving(true)
    try {
      const res = await api<{ price_alert: number | null }>(`/favorites/${priceAlertFor.id}/price-alert`, {
        method: 'POST',
        body: JSON.stringify({ target_price: target }),
      })
      setItems((prev) => prev.map((x) => (x.id === priceAlertFor.id ? { ...x, price_alert: res.price_alert } : x)))
      setPriceAlertFor(null)
      toast.success('Alerta de bajada de precio activada')
    } catch {
      toast.error('No se pudo activar la alerta')
    } finally {
      setPriceSaving(false)
    }
  }

  async function removePriceAlert() {
    if (!priceAlertFor) return
    setPriceSaving(true)
    try {
      await api(`/favorites/${priceAlertFor.id}/price-alert`, { method: 'DELETE' })
      setItems((prev) => prev.map((x) => (x.id === priceAlertFor.id ? { ...x, price_alert: null } : x)))
      setPriceAlertFor(null)
      toast.success('Alerta de precio eliminada')
    } catch {
      toast.error('No se pudo eliminar la alerta')
    } finally {
      setPriceSaving(false)
    }
  }

  async function openCompare(_e: React.MouseEvent, p: Product) {
    setCompareFor(p)
    setCompareData(null)
    setCompareLoading(true)
    try {
      const [res, hist] = await Promise.all([
        api<CompareResponse>(`/favorites/${p.id}/compare`),
        api<{ data: PriceHistoryPoint[] }>(`/favorites/${p.id}/price-history`),
      ])
      setCompareData({ ...res, history: hist.data ?? [] })
    } catch {
      toast.error('No se pudieron cargar comparativas')
    } finally {
      setCompareLoading(false)
    }
  }

  async function openShare() {
    setShareOpen(true)
    if (shareToken) return
    try {
      const res = await api<{ token: string }>('/favorites/share', { method: 'POST' })
      setShareToken(res.token)
    } catch {
      toast.error('No se pudo generar el enlace')
    }
  }

  const shareUrl = `${window.location.origin}/lista/${shareToken}`

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="anim-fade-up">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-carbon-100 via-carbon-50 to-rose-50/60">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-rose-400/15 blur-3xl anim-orb" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-brand-400/10 blur-3xl anim-orb-2" />
        <div className="mx-auto max-w-6xl px-4 pt-8">
          <div className="relative overflow-hidden rounded-3xl border border-carbon-200 bg-white p-6 shadow-lg shadow-carbon-900/5 md:p-8">
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-lg shadow-rose-500/30 sm:flex">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip bg-rose-100 text-rose-700">Tu wishlist</span>
                    {stats.onSale > 0 && (
                      <span className="chip bg-amber-100 text-amber-700">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                        {stats.onSale} en oferta
                      </span>
                    )}
                    {stats.alerts > 0 && (
                      <span className="chip bg-sky-100 text-sky-700">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
                        {stats.alerts} con aviso
                      </span>
                    )}
                  </div>
                  <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-carbon-900 md:text-4xl">
                    Mis <span className="gradient-text">favoritos</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-carbon-600">
                    {stats.total > 0
                      ? `Guardaste ${stats.total} producto${stats.total === 1 ? '' : 's'}. Activa avisos de stock o bajada de precio, compara marcas y comparte tu lista.`
                      : 'Guarda tus productos de la tienda con el corazón para encontrarlos rápido.'}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 lg:max-w-sm">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-carbon-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar en favoritos…"
                    className="garaje-input pr-10"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-carbon-100 text-carbon-500 transition hover:bg-carbon-200" aria-label="Limpiar búsqueda">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {stats.total > 0 && (
                  <button onClick={openShare} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>
                    Compartir lista
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Guardados" value={stats.total} tone="brand" icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
          } />
          <StatCard label="En oferta" value={stats.onSale} tone="amber" icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 14.15l-6.41 6.41a2 2 0 01-2.83 0L2.6 11.9A2 2 0 012 10.48V4a2 2 0 012-2h6.48a2 2 0 011.41.59l8.7 8.7a2 2 0 010 2.84z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
          } />
          <StatCard label="Valor total" value={fmt(stats.value)} tone="green" icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8M12 6v12" /></svg>
          } />
          <StatCard label="Disponibles" value={`${stats.available}/${stats.total}`} tone="blue" icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          } />
        </div>

        {/* Filtros */}
        <div className="mt-6 rounded-2xl border border-carbon-200 bg-white p-4 shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                <option value="">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectCls}>
                <option value="recent">Agregados recientemente</option>
                <option value="name">Nombre A-Z</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              {hasFilters && (
                <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-full border border-carbon-300 bg-white px-3 py-1.5 text-xs font-semibold text-carbon-600 transition hover:border-rose-400 hover:text-rose-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}
              {stats.total > 0 && (
                <button onClick={addAll} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
                  Agregar todos
                </button>
              )}
              <div className="flex items-center gap-1 rounded-xl border border-carbon-200 bg-white p-1">
                <button
                  onClick={() => setView('grid')}
                  title="Vista cuadrícula"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    view === 'grid'
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm'
                      : 'bg-transparent text-carbon-500 hover:bg-brand-50 hover:text-brand-600'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
                </button>
                <button
                  onClick={() => setView('list')}
                  title="Vista lista"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    view === 'list'
                      ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm'
                      : 'bg-transparent text-carbon-500 hover:bg-brand-50 hover:text-brand-600'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>
                </button>
              </div>
              {stats.total > 0 && (
                <button onClick={() => setConfirmClear(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:border-red-400/30 dark:hover:bg-red-500/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
                  Vaciar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-medium text-carbon-500">
            {loading ? 'Cargando…' : `${sorted.length} producto${sorted.length === 1 ? '' : 's'}`}
            {hasFilters && ' encontrados'}
          </p>
          {stats.alerts > 0 && (
            <p className="flex items-center gap-1 text-xs font-medium text-sky-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
              Te avisamos por notificación cuando haya cambios
            </p>
          )}
        </div>

        {loading ? (
          <div className="mt-2">
            {view === 'grid' ? <GridSkeleton count={6} /> : <RowSkeleton cols={4} rows={5} />}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              }
              title={hasFilters ? 'Sin resultados con estos filtros' : 'Aún no tienes favoritos'}
              subtitle={
                hasFilters
                  ? 'Prueba con otra búsqueda, categoría o borra los filtros.'
                  : 'Explora la tienda y guarda productos con el corazón para encontrarlos rápido.'
              }
            />
            {!hasFilters && (
              <div className="mt-4 flex justify-center">
                <button onClick={() => navigate('/panel/tienda')} className="btn-primary">Explorar la tienda</button>
              </div>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <GridCard
                key={p.id}
                p={p}
                removing={removing.has(p.id)}
                inCart={inCartIds.has(p.id)}
                onDetail={() => goDetail(p)}
                onRemove={(e) => { e.stopPropagation(); e.preventDefault(); remove(p) }}
                onToggleStock={(e, pr) => { e.stopPropagation(); e.preventDefault(); toggleStock(e, pr) }}
                onOpenPriceAlert={(e, pr) => { e.stopPropagation(); e.preventDefault(); openPriceAlert(e, pr) }}
                onCompare={(e, pr) => { e.stopPropagation(); e.preventDefault(); openCompare(e, pr) }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-4">
            {sorted.map((p) => (
              <RowCard
                key={p.id}
                p={p}
                removing={removing.has(p.id)}
                inCart={inCartIds.has(p.id)}
                onDetail={() => goDetail(p)}
                onRemove={(e) => { e.stopPropagation(); e.preventDefault(); remove(p) }}
                onToggleStock={(e, pr) => { e.stopPropagation(); e.preventDefault(); toggleStock(e, pr) }}
                onOpenPriceAlert={(e, pr) => { e.stopPropagation(); e.preventDefault(); openPriceAlert(e, pr) }}
                onCompare={(e, pr) => { e.stopPropagation(); e.preventDefault(); openCompare(e, pr) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal alerta de precio */}
      <Modal
        open={!!priceAlertFor}
        onClose={() => setPriceAlertFor(null)}
        title="Alerta de bajada de precio"
        subtitle={priceAlertFor ? `Te avisaremos cuando "${priceAlertFor.name}" llegue al precio objetivo.` : ''}
        footer={
          <>
            {priceAlertFor?.price_alert && (
              <button onClick={removePriceAlert} disabled={priceSaving} className="btn-ghost !text-sm text-red-500">
                Eliminar alerta
              </button>
            )}
            <button onClick={savePriceAlert} disabled={priceSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50">
              {priceSaving ? 'Guardando…' : 'Guardar alerta'}
            </button>
          </>
        }
      >
        {priceAlertFor && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-carbon-700">Precio objetivo ($)</label>
            <input
              type="number"
              min={1}
              step="any"
              value={priceTarget}
              onChange={(e) => setPriceTarget(e.target.value)}
              placeholder={String(Math.round(priceAlertFor.final_price ?? priceAlertFor.price))}
              className="garaje-input w-full"
              autoFocus
            />
            <p className="mt-3 text-xs text-carbon-500">
              Precio actual: <span className="font-semibold text-carbon-700">{fmt(priceAlertFor.final_price ?? priceAlertFor.price)}</span>. Es una alerta
              única: se desactiva sola cuando te notificamos.
            </p>
          </div>
        )}
      </Modal>

      {/* Modal comparar */}
      <Modal
        open={!!compareFor}
        onClose={() => setCompareFor(null)}
        title={compareFor ? `Comparar: ${compareFor.name}` : 'Comparar'}
        subtitle="Alternativas del mismo rubro de otras marcas, ordenadas por precio."
        size="lg"
      >
        {compareLoading ? (
          <div className="flex items-center gap-3 py-6 text-carbon-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Buscando alternativas…
          </div>
        ) : compareData ? (
          <div className="space-y-3">
            {compareData.history && compareData.history.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-carbon-50 px-4 py-3">
                <span className="text-sm font-semibold text-carbon-700">Evolución del precio</span>
                <MiniSparkline history={compareData.history} />
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-carbon-200">
              <div className="flex items-center justify-between gap-3 border-b border-carbon-100 bg-brand-50/70 px-4 py-2.5">
                <span className="text-sm font-bold text-carbon-900">{compareData.current.name}</span>
                <span className="text-sm font-bold text-brand-600">{fmt(compareData.current.final_price ?? compareData.current.price)}</span>
              </div>
              {compareData.data.length === 0 ? (
                <p className="px-4 py-4 text-sm text-carbon-500">No encontramos alternativas de la misma categoría.</p>
              ) : (
                compareData.data.map((alt) => {
                  const altPrice = alt.final_price ?? alt.price
                  const curPrice = compareData.current.final_price ?? compareData.current.price
                  const cheaper = altPrice < curPrice
                  const diff = Math.round(Math.abs(altPrice - curPrice))
                  return (
                    <button
                      key={alt.id}
                      onClick={() => navigate(`/panel/producto/${alt.slug}`)}
                      className="flex w-full items-center justify-between gap-3 border-b border-carbon-100 px-4 py-3 text-left transition hover:bg-carbon-50 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-carbon-800">{alt.name}</p>
                        <p className="text-xs text-carbon-500">
                          {[alt.brand, alt.category].filter(Boolean).join(' · ') || 'Tienda'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {cheaper && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {fmt(diff)} más barato
                          </span>
                        )}
                        <span className="font-bold text-carbon-900">{fmt(altPrice)}</span>
                        {alt.available <= 0 && <span className="text-[10px] font-semibold text-red-500">Agotado</span>}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <p className="py-4 text-sm text-carbon-500">No se pudo cargar la comparativa.</p>
        )}
      </Modal>

      {/* Modal compartir */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Compartir tu lista"
        subtitle="Cualquier persona con el enlace puede ver tus favoritos."
      >
        <div className="space-y-4">
          <p className="text-sm text-carbon-600">
            Un enlace público a tu wishlist. Ideal para enviarlo por WhatsApp con el asesor o para ti mismo desde otro dispositivo.
          </p>
          {!shareToken ? (
            <div className="flex items-center gap-3 text-carbon-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Generando enlace…
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-carbon-200 bg-carbon-50 p-2">
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent px-2 text-sm text-carbon-700" />
              <button
                onClick={copyShare}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                {shareCopied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          )}
          {shareToken && (
            <button
              onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              Abrir lista en otra pestaña
            </button>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Vaciar favoritos"
        message={`¿Seguro que quieres quitar los ${stats.total} producto${stats.total === 1 ? '' : 's'} guardados? Se eliminarán también sus avisos.`}
        confirmLabel={clearing ? 'Vaciando…' : 'Vaciar todo'}
        loading={clearing}
      />
    </div>
  )
}