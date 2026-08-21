import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { useCart, cartKey } from '../lib/cart'
import type { Fulfillment } from '../lib/cart'
import type { InvoiceDetail, Motorcycle, Product } from '../lib/types'
import type { Paginated } from '../lib/pagination'
import { unwrapList } from '../lib/pagination'
import { fmtMoney } from '../lib/money'
import PaymentInfoBlock from '../components/PaymentInfoBlock'

const steps = [
  { n: 1, label: 'Carrito', icon: '🛒' },
  { n: 2, label: 'Entrega', icon: '📦' },
  { n: 3, label: 'Pago', icon: '💳' },
  { n: 4, label: 'Confirmar', icon: '✅' },
]

const fulfillmentOptions: { value: Fulfillment; label: string; desc: string; icon: string }[] = [
  { value: 'pickup', label: 'Recoger en taller', desc: 'Retira tu pedido sin costo', icon: '🏠' },
  { value: 'shipping', label: 'Envío a domicilio', desc: 'Recíbelo donde estés', icon: '🚚' },
  { value: 'installing', label: 'Instalación en servicio', desc: 'Lo instalamos en tu próxima cita', icon: '🔧' },
]

const paymentMethods = [
  { value: 'efectivo', label: 'Efectivo', desc: 'Paga al recoger', icon: '💵' },
  { value: 'transferencia', label: 'Transferencia', desc: 'Nequi / Daviplata / Banco', icon: '🏦' },
  { value: 'tarjeta', label: 'Tarjeta', desc: 'Crédito o débito', icon: '💳' },
]

function ProductImg({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  if (src) return <img src={src} alt={name} className={`rounded-xl object-cover ${className}`} />
  return <div className={`flex items-center justify-center rounded-xl bg-carbon-100 text-carbon-400 ${className}`}>{name[0]}</div>
}

export default function Cart({ storePath = '/tienda' }: { storePath?: string }) {
  const { user } = useAuth()
  const { items, count, total, fulfillment, setFulfillment, setQuantity, remove, clear, add } = useCart()
  const [step, setStep] = useState(1)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [checkingOut, setCheckingOut] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState<InvoiceDetail | null>(null)
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [motorcycleId, setMotorcycleId] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [allProducts, setAllProducts] = useState<Product[]>([])

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const [shipCity, setShipCity] = useState('')
  const [shipAddress, setShipAddress] = useState('')
  const [shipPhone, setShipPhone] = useState('')
  const [shipNotes, setShipNotes] = useState('')

  useEffect(() => {
    if (!user) return
    api<Motorcycle[]>('/motorcycles').then(setMotorcycles).catch(() => {})
  }, [user])

  useEffect(() => {
    api<Paginated<Product>>('/products?page=1&per_page=8')
      .then((res) => setAllProducts(unwrapList(res)))
      .catch(() => {})
  }, [])

  const [storeConfig, setStoreConfig] = useState({ shipping_fee: 12000, free_shipping_threshold: 150000 })
  useEffect(() => {
    api<{ shipping_fee?: number; free_shipping_threshold?: number }>('/payment-info')
      .then((d) => setStoreConfig({
        shipping_fee: d.shipping_fee ?? 12000,
        free_shipping_threshold: d.free_shipping_threshold ?? 150000,
      }))
      .catch(() => {})
  }, [])

  const pointsValue = 100
  const shippingFee = fulfillment === 'shipping' && total < storeConfig.free_shipping_threshold ? storeConfig.shipping_fee : 0
  const discount = user ? Math.min(pointsToUse * pointsValue, total) : 0
  const finalTotal = Math.max(0, total - discount) + shippingFee
  const freeShippingLeft = Math.max(0, storeConfig.free_shipping_threshold - total)
  const freeShippingPct = Math.min(100, (total / storeConfig.free_shipping_threshold) * 100)

  const suggestionsToShow = useMemo(() => {
    const cartIds = new Set(items.map((i) => i.productId))
    const cartCategories = new Set(items.map((i) => i.name.split(' ')[0].toLowerCase()))
    return allProducts
      .filter((p) => !cartIds.has(p.id))
      .sort((a, b) => {
        const aMatch = cartCategories.has(a.name.split(' ')[0].toLowerCase()) ? 1 : 0
        const bMatch = cartCategories.has(b.name.split(' ')[0].toLowerCase()) ? 1 : 0
        return bMatch - aMatch
      })
      .slice(0, 4)
  }, [items, allProducts])

  function nextStep() {
    setMsg('')
    if (step === 1 && count === 0) return
    if (step === 2) {
      if (fulfillment === 'shipping' && (!shipCity.trim() || !shipAddress.trim() || !shipPhone.trim())) {
        setMsg('Completa ciudad, dirección y teléfono para el envío.')
        return
      }
      if (fulfillment === 'installing' && user && !motorcycleId) {
        setMsg('Selecciona una moto para la instalación.')
        return
      }
      if (fulfillment === 'installing' && !user) {
        setMsg('Para instalación inicia sesión y registra tu moto en Mi Garaje.')
        return
      }
    }
    if (step === 3 && !user) {
      if (!guestName.trim() || !guestEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
        setMsg('Completa tu nombre y un email válido.')
        return
      }
    }
    setStep((s) => Math.min(4, s + 1))
  }

  function prevStep() { setMsg(''); setStep((s) => Math.max(1, s - 1)) }

  async function checkout() {
    setCheckingOut(true); setMsg('')
    try {
      if (!user) {
        const inv = await api<InvoiceDetail>('/store/checkout-guest', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, variant: i.variant?.name ?? null })),
            fulfillment, payment_method: paymentMethod,
            guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone || null,
            shipping_address: fulfillment === 'shipping' ? { city: shipCity, address: shipAddress, phone: shipPhone, notes: shipNotes || null } : null,
            tracking_number: trackingNumber || null,
          }),
        })
        setDone(inv); clear()
      } else {
        const inv = await api<InvoiceDetail>('/store/checkout', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity, variant: i.variant?.name ?? null })),
            fulfillment,
            motorcycle_id: fulfillment === 'installing' && motorcycleId ? Number(motorcycleId) : null,
            payment_method: paymentMethod, points_to_use: pointsToUse,
            shipping_address: fulfillment === 'shipping' ? { city: shipCity, address: shipAddress, phone: shipPhone, notes: shipNotes || null } : null,
            tracking_number: trackingNumber || null,
          }),
        })
        setDone(inv); clear()
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al procesar la compra')
    } finally { setCheckingOut(false) }
  }

  if (done) {
    const isCash = done.payment_method === 'efectivo'
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="anim-fade-up card p-8">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${isCash ? 'bg-emerald-100' : 'bg-amber-100'}`}>
            {isCash ? '✅' : '📄'}
          </div>
          <h1 className="mt-4 text-2xl font-black text-carbon-900">
            {isCash ? '¡Compra confirmada!' : '¡Pedido registrado!'}
          </h1>
          <p className="mt-2 text-carbon-600">Factura <strong>{done.invoice_number}</strong> · Total {fmtMoney(done.total)}</p>

          <div className="mt-4 space-y-3 text-left">
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="text-sm font-semibold text-brand-700">Guarda tu número de seguimiento</p>
              <p className="mt-1 text-sm text-brand-700/80">Usa <strong>{done.invoice_number}</strong> como guía para consultar el estado de tu pedido.</p>
            </div>

            {isCash ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                <p className="text-sm font-bold">Pago en efectivo</p>
                <p className="mt-1 text-sm text-emerald-700/90">
                  Tu pedido ya está en preparación. Paga en efectivo al retirarlo o recibirlo. Te avisaremos cuando esté listo.
                </p>
                {user && (
                  <div className="mt-3">
                    <Link to="/panel/pedidos" className="btn-primary btn-shine w-full">Ver mis pedidos</Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <p className="text-sm font-bold">Pago pendiente ({done.payment_method})</p>
                <p className="mt-1 text-sm text-amber-700/90">
                  Realiza la transferencia y sube el comprobante desde <strong>Mis Pedidos</strong> para confirmar tu pedido. Tenemos tu stock reservado.
                </p>
                {done.payment_method === 'transferencia' && (
                  <div className="mt-3">
                    <PaymentInfoBlock />
                  </div>
                )}
                {user && (
                  <div className="mt-3">
                    <Link to="/panel/pedidos" className="btn-primary btn-shine w-full">Subir comprobante ahora</Link>
                  </div>
                )}
                {!user && (
                  <p className="mt-2 text-xs text-amber-700">Si creas una cuenta con tu email, podrás seguir y pagar este pedido desde Mis Pedidos.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {user ? <Link to="/panel/pedidos" className="btn-primary">Mis pedidos</Link> : <Link to="/registro" className="btn-primary">Crear cuenta</Link>}
            <Link to={storePath} className="btn-ghost">Seguir comprando</Link>
          </div>
        </div>
      </div>
    )
  }

  if (count === 0 && step === 1) {
    return (
      <div className="anim-fade-up mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl">🛒</div>
        <h1 className="mt-5 text-3xl font-black text-carbon-900">Tu carrito está vacío</h1>
        <p className="mt-2 text-carbon-500">Explora nuestro catálogo y encuentra lo que tu moto necesita.</p>
        <Link to={storePath} className="btn-primary btn-shine mt-6 inline-flex">Ir a la tienda</Link>
      </div>
    )
  }

  const inputCls = 'w-full rounded-xl border border-carbon-200 bg-white px-4 py-2.5 text-carbon-900 placeholder:text-carbon-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* ── Progress ── */}
      <div className="mb-10 flex items-center justify-center">
        <div className="flex w-full max-w-2xl items-center">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold transition-all duration-300 ${
                  step > s.n ? 'bg-brand-600 text-white' : step === s.n ? 'bg-brand-600 text-white ring-4 ring-brand-200' : 'bg-carbon-100 text-carbon-400'
                }`}>{step > s.n ? '✓' : s.icon}</div>
                <span className={`mt-1.5 text-xs font-semibold ${step === s.n ? 'text-brand-600' : 'text-carbon-400'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-1 mb-5 h-0.5 flex-1 transition-colors ${step > s.n ? 'bg-brand-600' : 'bg-carbon-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ── Main ── */}
        <div className="lg:col-span-2 anim-fade-up" key={step}>
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black text-carbon-900">Tu carrito <span className="text-sm font-normal text-carbon-400">({count} productos)</span></h2>
                <button onClick={clear} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-carbon-200 px-3 py-1.5 text-sm font-medium text-carbon-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                  🗑 Vaciar carrito
                </button>
              </div>

              {/* Free shipping bar */}
              {fulfillment === 'shipping' && (
                <div className="mt-4 rounded-xl border border-carbon-200 bg-carbon-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-carbon-600">
                      {freeShippingLeft > 0
                        ? <>Te faltan <strong className="text-brand-600">{fmtMoney(freeShippingLeft)}</strong> para obtener envío gratis</>
                        : <strong className="text-green-600">¡Tienes envío gratis!</strong>
                      }
                    </span>
                    <span className="text-carbon-400">{fmtMoney(total)} / {fmtMoney(storeConfig.free_shipping_threshold)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-carbon-200">
                    <div className={`h-full rounded-full transition-all duration-500 ${freeShippingPct >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${freeShippingPct}%` }} />
                  </div>
                </div>
              )}

              {/* Product list */}
              <div className="mt-5 space-y-3">
                {items.map((i) => (
                  <div key={cartKey(i)} className="card flex items-center gap-4 p-4">
                    <ProductImg src={i.image} name={i.name} className="h-20 w-20 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-carbon-900">{i.name}</p>
                      {i.variant && (
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-carbon-600">
                          <span className="h-3 w-3 rounded-full border border-carbon-300" style={{ backgroundColor: i.variant.hex }} />
                          {i.variant.name}
                        </span>
                      )}
                      {i.brand && <p className="text-xs text-carbon-400">{i.brand}</p>}
                      <p className="mt-1 text-sm text-carbon-500">{fmtMoney(i.price)} / {i.unit}</p>
                      <span className={`mt-1 inline-block text-xs font-medium ${i.available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {i.available > 0 ? `✓ En stock (${i.available})` : '✗ Agotado'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-lg border border-carbon-200">
                        <button onClick={() => setQuantity(cartKey(i), i.quantity - 1)} className="flex h-10 w-9 items-center justify-center rounded-l-lg text-carbon-600 transition hover:bg-carbon-100">−</button>
                        <span className="flex h-10 w-10 items-center justify-center border-x border-carbon-200 text-sm font-semibold">{i.quantity}</span>
                        <button onClick={() => setQuantity(cartKey(i), i.quantity + 1)} className="flex h-10 w-9 items-center justify-center rounded-r-lg text-carbon-600 transition hover:bg-carbon-100">+</button>
                      </div>
                      <span className="w-20 text-right text-base font-bold text-carbon-900">{fmtMoney(i.price * i.quantity)}</span>
                      <button onClick={() => remove(cartKey(i))} className="text-carbon-400 transition hover:text-red-500" title="Eliminar">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom actions */}
              <div className="mt-5 flex flex-col items-stretch justify-between gap-4 border-t border-carbon-100 pt-5 sm:flex-row sm:items-center">
                <Link to={storePath} className="flex items-center gap-2 text-sm font-semibold text-carbon-600 transition hover:text-brand-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-carbon-200 transition group-hover:border-brand-500">←</span>
                  Seguir comprando
                </Link>
                <button onClick={nextStep} className="btn-primary btn-shine">Continuar con la entrega →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-carbon-900">¿Cómo lo recibes?</h2>
              <div className="space-y-3">
                {fulfillmentOptions.map((o) => (
                  <label key={o.value} className={`card flex cursor-pointer items-center gap-4 p-4 transition ${fulfillment === o.value ? 'ring-2 ring-brand-500 border-brand-300' : ''}`}>
                    <input type="radio" name="fulfillment" value={o.value} checked={fulfillment === o.value} onChange={() => setFulfillment(o.value)} className="sr-only" />
                    <span className="text-2xl">{o.icon}</span>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-carbon-900">{o.label}</p><p className="text-sm text-carbon-500">{o.desc}</p></div>
                    {fulfillment === o.value && <span className="h-6 w-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm">✓</span>}
                  </label>
                ))}
              </div>
              {fulfillment === 'shipping' && (
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-carbon-500">Dirección de envío</h3>
                  <input value={shipCity} onChange={(e) => setShipCity(e.target.value)} placeholder="Ciudad *" className={inputCls} />
                  <input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} placeholder="Dirección completa *" className={inputCls} />
                  <input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Teléfono de contacto *" type="tel" className={inputCls} />
                  <textarea value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} placeholder="Referencias (barrio, punto conocido...)" rows={2} className={`${inputCls} resize-none`} />
                  <div>
                    <p className="text-xs font-semibold text-carbon-500">Número de guía</p>
                    <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Se asigna después del envío" className={`${inputCls} mt-1`} disabled />
                  </div>
                </div>
              )}
              {fulfillment === 'installing' && user && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-carbon-500">Moto para instalación</h3>
                  <select value={motorcycleId} onChange={(e) => setMotorcycleId(e.target.value)} className="garaje-input mt-2">
                    <option value="">Selecciona una moto</option>
                    {motorcycles.map((mt) => <option key={mt.id} value={mt.id}>{mt.nickname || mt.plate || 'Moto'} {mt.model?.name ? `· ${mt.model.name}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-between pt-2">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={nextStep} className="btn-primary">Continuar con el pago →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-carbon-900">Método de pago</h2>
              <div className="space-y-3">
                {paymentMethods.map((m) => (
                  <label key={m.value} className={`card flex cursor-pointer items-center gap-4 p-4 transition ${paymentMethod === m.value ? 'ring-2 ring-brand-500 border-brand-300' : ''}`}>
                    <input type="radio" name="payment" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="sr-only" />
                    <span className="text-2xl">{m.icon}</span>
                    <div className="min-w-0 flex-1"><p className="font-semibold text-carbon-900">{m.label}</p><p className="text-sm text-carbon-500">{m.desc}</p></div>
                    {paymentMethod === m.value && <span className="h-6 w-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm">✓</span>}
                  </label>
                ))}
              </div>
              {paymentMethod === 'transferencia' && <PaymentInfoBlock />}
              {user && (
                <div className="card p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-carbon-500">Puntos de lealtad</h3>
                  <input type="number" min={0} value={pointsToUse} onChange={(e) => setPointsToUse(Math.max(0, Number(e.target.value)))} className="garaje-input mt-2" placeholder="0" />
                  <p className="mt-1 text-xs text-carbon-400">Cada punto vale {fmtMoney(pointsValue)} de descuento.</p>
                </div>
              )}
              {!user && (
                <div className="card p-5 space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-carbon-500">Tus datos</h3>
                  <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nombre completo *" className={inputCls} />
                  <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email *" type="email" className={inputCls} />
                  <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Teléfono (opcional)" type="tel" className={inputCls} />
                </div>
              )}
              <div className="flex justify-between pt-2">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={nextStep} className="btn-primary">Continuar con la confirmación →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-carbon-900">Confirma tu pedido</h2>
              <div className="card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-carbon-500">Artículos</h3>
                <div className="mt-3 space-y-3">
                  {items.map((i) => (
                    <div key={cartKey(i)} className="flex items-center gap-3">
                      <ProductImg src={i.image} name={i.name} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-carbon-900">{i.name}</p>
                        {i.variant && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-carbon-500">
                            <span className="h-2.5 w-2.5 rounded-full border border-carbon-300" style={{ backgroundColor: i.variant.hex }} />
                            {i.variant.name}
                          </span>
                        )}
                        <p className="text-xs text-carbon-500">{i.quantity} x {fmtMoney(i.price)}</p>
                      </div>
                      <span className="text-sm font-bold">{fmtMoney(i.price * i.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-carbon-500">Entrega</span><span className="font-medium">{fulfillmentOptions.find((o) => o.value === fulfillment)?.label}</span></div>
                {fulfillment === 'shipping' && <div className="text-carbon-600"><p>{shipCity}, {shipAddress}</p><p>Tel: {shipPhone}</p></div>}
                <div className="flex justify-between"><span className="text-carbon-500">Pago</span><span className="font-medium">{paymentMethods.find((m) => m.value === paymentMethod)?.label}</span></div>
                {!user && <div className="text-carbon-600"><p>{guestName} · {guestEmail}</p></div>}
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={checkout} disabled={checkingOut} className="btn-primary btn-shine">{checkingOut ? 'Procesando...' : 'Confirmar y pagar'}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Delivery + Payment */}
            {(fulfillment || paymentMethod) && (
              <div className="card p-4 space-y-2">
                {fulfillment && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{fulfillmentOptions.find((o) => o.value === fulfillment)?.icon}</span>
                    <span className="text-carbon-600">{fulfillmentOptions.find((o) => o.value === fulfillment)?.label}</span>
                  </div>
                )}
                {paymentMethod && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{paymentMethods.find((m) => m.value === paymentMethod)?.icon}</span>
                    <span className="text-carbon-600">{paymentMethods.find((m) => m.value === paymentMethod)?.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="card p-5">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-carbon-500">Subtotal</span><span className="font-semibold">{fmtMoney(total)}</span></div>
                {discount > 0 && <div className="flex justify-between text-green-700"><span>Descuento</span><span>−{fmtMoney(discount)}</span></div>}
                <div className="flex justify-between"><span className="text-carbon-500">Envío</span><span className={`font-semibold ${shippingFee > 0 ? 'text-carbon-900' : 'text-green-600'}`}>{shippingFee > 0 ? fmtMoney(shippingFee) : 'Gratis'}</span></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-carbon-200 pt-3">
                <span className="text-base font-bold text-carbon-900">Total</span>
                <span className="text-xl font-black text-brand-600">{fmtMoney(finalTotal)}</span>
              </div>
            </div>

            {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</p>}
          </div>
        </div>
      </div>

      {/* ── Sugerencias ── */}
      {suggestionsToShow.length > 0 && (
        <div className="mt-10 border-t border-carbon-200 pt-8">
          <h3 className="text-xl font-black text-carbon-900">También te puede interesar</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {suggestionsToShow.map((p) => (
              <div key={p.id} className="card group p-3">
                <ProductImg src={p.image} name={p.name} className="mx-auto h-28 w-full" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-carbon-900 line-clamp-2">{p.name}</p>
                  {p.brand && <p className="text-xs text-carbon-400">{p.brand}</p>}
                  <p className="mt-1 text-sm font-bold text-carbon-900">{fmtMoney(p.final_price ?? p.price)}</p>
                </div>
                <button
                  onClick={() => add({ productId: p.id, name: p.name, price: p.final_price ?? p.price, unit: p.unit, available: p.available, image: p.image, brand: p.brand })}
                  className="mt-3 w-full rounded-lg border-2 border-brand-600 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-600 hover:text-white"
                >
                  🛒 Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confianza ── */}
      <div className="marquee-mask mt-10 overflow-hidden">
        <div className="marquee-track items-center gap-3 pr-3">
          {[
            { icon: '🛡️', title: 'Compra segura', desc: 'Tus datos están protegidos' },
            { icon: '⚙️', title: 'Repuestos originales', desc: 'Productos certificados' },
            { icon: '🎧', title: 'Soporte técnico', desc: 'Asesoría experta' },
            { icon: '🚚', title: 'Envíos a todo el país', desc: 'Recíbelo donde estés' },
            { icon: '🔄', title: 'Devoluciones fáciles', desc: 'Hasta 7 días' },
            { icon: '🛡️', title: 'Compra segura', desc: 'Tus datos están protegidos' },
            { icon: '⚙️', title: 'Repuestos originales', desc: 'Productos certificados' },
            { icon: '🎧', title: 'Soporte técnico', desc: 'Asesoría experta' },
            { icon: '🚚', title: 'Envíos a todo el país', desc: 'Recíbelo donde estés' },
            { icon: '🔄', title: 'Devoluciones fáciles', desc: 'Hasta 7 días' },
          ].map((b, i) => (
            <div key={`${b.title}-${i}`} className="flex shrink-0 items-center gap-3 rounded-2xl border border-carbon-100 bg-white px-5 py-3 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl transition group-hover:scale-110">{b.icon}</span>
              <div>
                <p className="whitespace-nowrap text-sm font-semibold text-carbon-900">{b.title}</p>
                <p className="whitespace-nowrap text-xs text-carbon-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── WhatsApp ── */}
      <div className="mt-8 rounded-xl border border-carbon-200 bg-carbon-50 py-4 text-center text-sm text-carbon-600">
        ¿Tienes dudas con tu pedido? Contáctanos por <a href="https://wa.me/573001234567" target="_blank" rel="noopener noreferrer" className="font-semibold text-green-600 hover:underline">WhatsApp</a>
      </div>
    </div>
  )
}
