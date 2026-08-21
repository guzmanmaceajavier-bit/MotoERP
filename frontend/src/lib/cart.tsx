import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
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
}

/** Clave única de línea: producto + color (las variantes conviven como líneas separadas). */
export function cartKey(item: Pick<CartItem, 'productId' | 'variant'>): string {
  return `${item.productId}::${item.variant?.name ?? ''}`
}

const CartContext = createContext<CartContextValue | null>(null)

/** Clave de storage según el estado de sesión: invitado o por usuario. */
const guestKey = 'motohub_cart'
const userKey = (uid: number) => `motohub_cart_u${uid}`

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
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup')

  // Al cambiar el usuario (login/logout) se restaura el carrito de la sesión correspondiente.
  const prevKey = useRef(storageKey)
  useEffect(() => {
    if (prevKey.current === storageKey) return
    prevKey.current = storageKey
    setItems(readStorage(storageKey))
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

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((acc, i) => acc + i.quantity, 0)
    const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
    return { items, count, total, fulfillment, setFulfillment, add, setQuantity, remove, clear }
  }, [items, fulfillment])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}