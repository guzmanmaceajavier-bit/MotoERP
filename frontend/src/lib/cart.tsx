import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from './api'
import { useToast } from './toast'

export interface CartVariant {
  name: string
  hex: string
}

export interface CartItem {
  productId: number
  name: string
  price: number
  quantity: number
  unit: string
  available: number
  variant?: CartVariant
  image?: string
  brand?: string
}

export type Fulfillment = 'shipping' | 'pickup' | 'installing'

interface CartContextValue {
  items: CartItem[]
  count: number
  total: number
  fulfillment: Fulfillment
  setFulfillment: (f: Fulfillment) => void
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  validate: () => Promise<{ removed: number; updated: number }>
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

/** Clave única de línea: producto + color (las variantes conviven como líneas separadas). */
export function cartKey(item: Pick<CartItem, 'productId' | 'variant'>): string {
  return `${item.productId}::${item.variant?.name ?? ''}`
}

const CartContext = createContext<CartContextValue | null>(null)

/** Clave de storage según el estado de sesión: invitado o por usuario. */
const guestKey = 'motohub_cart'
const userKey = (uid: number) => `motohub_cart_u${uid}`
const fulfillmentKey = (key: string) => `${key}:fulfillment`
const legacyFulfillmentKey = 'motohub_cart_fulfillment'

function readFulfillment(key: string): Fulfillment {
  try {
    const v = localStorage.getItem(fulfillmentKey(key)) ?? (key === guestKey ? localStorage.getItem(legacyFulfillmentKey) : null)
    if (v === 'shipping' || v === 'pickup' || v === 'installing') return v
  } catch {}
  return 'pickup'
}

function mergeItems(mine: CartItem[], incoming: CartItem[]): CartItem[] {
  const out = [...mine]
  for (const line of incoming) {
    const k = cartKey(line)
    const i = out.findIndex((x) => cartKey(x) === k)
    if (i < 0) {
      out.push(line)
    } else {
      const avail = Math.max(1, Math.max(out[i].available, line.available))
      out[i] = { ...out[i], available: avail, quantity: Math.min(out[i].quantity + line.quantity, avail) }
    }
  }
  return out
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const user = useAuth().user

  const storageKey = user ? userKey(user.id) : guestKey

  const readStorage = (key: string): CartItem[] => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]') as CartItem[]
    } catch {
      return []
    }
  }

  const [items, setItems] = useState<CartItem[]>(() => readStorage(storageKey))
  const [fulfillment, setFulfillmentState] = useState<Fulfillment>(() => readFulfillment(storageKey))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const prevCount = useRef(0)

  const setFulfillment = (f: Fulfillment) => {
    setFulfillmentState(f)
    try {
      localStorage.setItem(fulfillmentKey(storageKey), f)
      if (storageKey === guestKey) localStorage.removeItem(legacyFulfillmentKey)
    } catch {}
  }

  const prevKey = useRef(storageKey)
  useEffect(() => {
    if (prevKey.current === storageKey) return
    const from = prevKey.current
    prevKey.current = storageKey
    if (from === guestKey && storageKey !== guestKey) {
      const guestItems = readStorage(guestKey)
      const mine = readStorage(storageKey)
      if (guestItems.length > 0) {
        const merged = mergeItems(mine, guestItems)
        try {
          localStorage.setItem(storageKey, JSON.stringify(merged))
          localStorage.setItem(guestKey, '[]')
        } catch {}
        setItems(merged)
        toast.success('Unimos tu carrito de invitado con tu cuenta')
      } else {
        setItems(mine)
      }
    } else {
      setItems(readStorage(storageKey))
    }
    setFulfillmentState(readFulfillment(storageKey))
  }, [storageKey])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  }, [items, storageKey])

  const add = (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    const stockOfProduct = Math.max(
      0,
      item.available - items.filter((i) => i.productId === item.productId).reduce((s, i) => s + i.quantity, 0),
    )
    const effective = Math.min(qty, stockOfProduct)
    if (effective <= 0) {
      toast.error('No hay más stock disponible de este producto')
      return
    }
    toast.success(`${item.name}${item.variant ? ` (${item.variant.name})` : ''} agregado al carrito`)
    const k = cartKey(item)
    setItems((prev) => {
      const existing = prev.find((i) => cartKey(i) === k)
      return existing
        ? prev.map((i) => (cartKey(i) === k ? { ...i, quantity: Math.min(i.quantity + effective, i.available) } : i))
        : [...prev, { ...item, quantity: effective }]
    })
  }

  const setQuantity = (key: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) =>
        cartKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(quantity, i.available)) } : i,
      ),
    )
  }

  const remove = (key: string) => {
    setItems((prev) => prev.filter((i) => cartKey(i) !== key))
  }

  const clear = () => setItems([])

  const validate = async (): Promise<{ removed: number; updated: number }> => {
    if (items.length === 0 || validating) return { removed: 0, updated: 0 }
    setValidating(true)
    try {
      const res = await api<{ lines: { product_id: number; ok: boolean; name?: string; price?: number; available?: number; image?: string | null; variant?: string | null; message?: string }[] }>('/store/validate-cart', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, variant: i.variant?.name ?? null })),
        }),
      })
      let removed = 0
      let updated = 0
      const byKey = new Map(res.lines.map((l) => [`${l.product_id}::${(l.variant ?? '').toLowerCase()}`, l]))
      setItems((prev) => {
        const next: CartItem[] = []
        for (const i of prev) {
          const line = byKey.get(`${i.productId}::${(i.variant?.name ?? '').toLowerCase()}`)
          if (!line?.ok) {
            removed++
            continue
          }
          const avail = Math.max(0, line.available ?? 0)
          if (avail <= 0) {
            removed++
            continue
          }
          let changed = false
          const copy = { ...i }
          if (line.price !== undefined && line.price !== i.price) { copy.price = line.price; changed = true }
          if (line.name && line.name !== i.name) { copy.name = line.name; changed = true }
          if (line.image !== undefined && line.image !== i.image) { copy.image = line.image ?? undefined; changed = true }
          if (avail !== i.available) { copy.available = avail; changed = true }
          if (copy.quantity > avail) { copy.quantity = avail; changed = true }
          if (changed) updated++
          next.push(copy)
        }
        return next
      })
      if (removed > 0) toast.error(removed === 1 ? 'Un producto ya no está disponible y se quitó' : `${removed} productos ya no están disponibles y se quitaron`)
      else if (updated > 0) toast.success('Actualizamos precios y stock de tu carrito')
      return { removed, updated }
    } catch {
      return { removed: 0, updated: 0 }
    } finally {
      setValidating(false)
    }
  }

  const count = items.reduce((acc, i) => acc + i.quantity, 0)

  useEffect(() => {
    if (count > prevCount.current) {
      setDrawerOpen(true)
    }
    prevCount.current = count
  }, [count])

  const value = useMemo<CartContextValue>(() => {
    const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
    return { items, count, total, fulfillment, setFulfillment, add, setQuantity, remove, clear, validate, drawerOpen, setDrawerOpen }
  }, [items, count, fulfillment, drawerOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
