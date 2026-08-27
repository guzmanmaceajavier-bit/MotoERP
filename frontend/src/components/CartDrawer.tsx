import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCart, cartKey } from '../lib/cart'
import { fmtMoney } from '../lib/money'

function ProductImg({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  if (src) return <img src={src} alt={name} className={`rounded-lg object-cover ${className}`} />
  return <div className={`flex items-center justify-center rounded-lg bg-carbon-100 text-carbon-400 ${className}`}>{name[0]}</div>
}

export default function CartDrawer({ storePath: _storePath = '/tienda' }: { storePath?: string }) {
  const { items, count, total, drawerOpen, setDrawerOpen, setQuantity, remove } = useCart()

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  if (!drawerOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[9999] flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-carbon-900 anim-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-carbon-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <h2 className="text-lg font-black text-carbon-900">Tu carrito</h2>
            {count > 0 && <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">{count}</span>}
          </div>
          <button onClick={() => setDrawerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-carbon-400 transition hover:bg-carbon-100 hover:text-carbon-600">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-carbon-100 text-3xl">🛒</div>
              <p className="mt-4 text-sm font-semibold text-carbon-900">Tu carrito está vacío</p>
              <p className="mt-1 text-xs text-carbon-500">Explora la tienda y agrega productos</p>
              <button onClick={() => setDrawerOpen(false)} className="btn-primary mt-4 text-sm">Ir a la tienda</button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((i) => (
                <div key={cartKey(i)} className="flex gap-3">
                  <ProductImg src={i.image} name={i.name} className="h-16 w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-carbon-900 line-clamp-1">{i.name}</p>
                    {i.variant && (
                      <span className="inline-flex items-center gap-1 text-xs text-carbon-500">
                        <span className="h-2.5 w-2.5 rounded-full border border-carbon-300" style={{ backgroundColor: i.variant.hex }} />
                        {i.variant.name}
                      </span>
                    )}
                    <p className="text-xs text-carbon-400">{fmtMoney(i.price)} / {i.unit}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-carbon-200">
                        <button onClick={() => setQuantity(cartKey(i), i.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-l-lg text-carbon-600 transition hover:bg-carbon-100 text-xs">−</button>
                        <span className="flex h-7 w-8 items-center justify-center border-x border-carbon-200 text-xs font-semibold">{i.quantity}</span>
                        <button onClick={() => setQuantity(cartKey(i), i.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-r-lg text-carbon-600 transition hover:bg-carbon-100 text-xs">+</button>
                      </div>
                      <span className="text-sm font-bold text-carbon-900">{fmtMoney(i.price * i.quantity)}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(cartKey(i))} className="shrink-0 self-start text-carbon-300 transition hover:text-red-500" title="Eliminar">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-carbon-200 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-carbon-500">Subtotal ({count} artículos)</span>
              <span className="text-lg font-black text-brand-600">{fmtMoney(total)}</span>
            </div>
            <Link to="/carrito" onClick={() => setDrawerOpen(false)} className="btn-primary btn-shine block w-full text-center text-sm">
              Ir al carrito
            </Link>
            <button onClick={() => setDrawerOpen(false)} className="block w-full text-center text-xs font-semibold text-carbon-500 transition hover:text-brand-600">
              Seguir comprando
            </button>
          </div>
        )}
      </div>
    </>
  )
}
