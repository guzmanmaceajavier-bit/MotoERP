import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { useCart, cartKey } from '../lib/cart'
import { useSiteInfo } from '../lib/useSiteImages'
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
]

const trustBadges = [
  { icon: '🛡️', label: 'Compra segura' },
  { icon: '🚚', label: 'Envío gratis +$150k' },
  { icon: '🔄', label: 'Devolución fácil' },
  { icon: '🎧', label: 'Soporte experto' },
]

function ProductImg({ src, name, className = '' }: { src?: string; name: string; className?: string }) {
  if (src) return <img src={src} alt={name} className={`rounded-xl object-cover ${className}`} />
  return <div className={`flex items-center justify-center rounded-xl bg-carbon-100 text-carbon-400 ${className}`}>{name[0]}</div>
}

export default function Cart({ storePath = '/tienda' }: { storePath?: string }) {
  const { user } = useAuth()
  const { items, count, total, fulfillment, setFulfillment, setQuantity, remove, clear, add } = useCart()
  const { workshop_phone } = useSiteInfo()
  const [step, setStep] = useState(1)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [checkingOut, setCheckingOut] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState<InvoiceDetail | null>(null)
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [motorcycleId, setMotorcycleId] = useState('')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [checkoutToken, setCheckoutToken] = useState('')

  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState(19)

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

  const [storeConfig, setStoreConfig] = useState({ shipping_fee: 12000, free_shipping_threshold: 150000, delivery_days: 3 })
  const [pointsValue, setPointsValue] = useState(100)
  useEffect(() => {
    api<{ shipping_fee?: number; free_shipping_threshold?: number; delivery_days?: number; tax_enabled?: boolean; tax_rate?: number; points_value?: number }>('/payment-info')
      .then((d) => {
        setStoreConfig({
          shipping_fee: d.shipping_fee ?? 12000,
          free_shipping_threshold: d.free_shipping_threshold ?? 150000,
          delivery_days: d.delivery_days ?? 3,
        })
        if (d.points_value !== undefined) setPointsValue(d.points_value)
        if (d.tax_enabled !== undefined) setTaxEnabled(d.tax_enabled)
        if (d.tax_rate !== undefined) setTaxRate(d.tax_rate)
      })
      .catch(() => {})
  }, [])

  const shippingFee = fulfillment === 'shipping' && total < storeConfig.free_shipping_threshold ? storeConfig.shipping_fee : 0
  const loyaltyDiscount = user ? Math.min(pointsToUse * pointsValue, total) : 0
  const subtotalAfterDiscount = Math.max(0, total - loyaltyDiscount)
  const tax = taxEnabled ? Math.round(subtotalAfterDiscount * (taxRate / 100)) : 0
  const finalTotal = subtotalAfterDiscount + shippingFee + tax
  const freeShippingLeft = Math.max(0, storeConfig.free_shipping_threshold - total)
  const freeShippingPct = Math.min(100, (total / storeConfig.free_shipping_threshold) * 100)

  // Fecha estimada de entrega
  const deliveryDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + storeConfig.delivery_days)
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  }, [storeConfig.delivery_days])

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
      if (fulfillment === 'shipping') {
        if (!shipCity.trim()) { setMsg('Ingresa la ciudad de envío.'); return }
        if (shipCity.trim().length < 3) { setMsg('La ciudad debe tener al menos 3 caracteres.'); return }
        if (!shipAddress.trim()) { setMsg('Ingresa la dirección de envío.'); return }
        if (shipAddress.trim().length < 10) { setMsg('La dirección debe tener al menos 10 caracteres.'); return }
        if (!shipPhone.trim()) { setMsg('Ingresa un teléfono de contacto.'); return }
        const digits = shipPhone.replace(/\D/g, '')
        if (digits.length < 10) { setMsg('El teléfono debe tener al menos 10 dígitos.'); return }
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
      if (!guestName.trim()) { setMsg('Ingresa tu nombre.'); return }
      if (guestName.trim().length < 3) { setMsg('El nombre debe tener al menos 3 caracteres.'); return }
      if (!guestEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
        setMsg('Ingresa un email válido.')
        return
      }
    }
    if (step === 3) {
      setCheckoutToken(crypto.randomUUID())
    }
    setStep((s) => Math.min(4, s + 1))
  }

  function prevStep() { setMsg(''); setStep((s) => Math.max(1, s - 1)) }

  async function checkout() {
    if (checkingOut || !checkoutToken) return
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
            checkout_token: checkoutToken,
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
            checkout_token: checkoutToken,
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
        <div className="anim-fade-up rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${isCash ? 'bg-green-50' : 'bg-orange-50'}`}>
            {isCash ? '✅' : '📄'}
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-800">
            {isCash ? '¡Compra confirmada!' : '¡Pedido registrado!'}
          </h1>
          <p className="mt-2 text-gray-500">Factura <strong>{done.invoice_number}</strong> · Total {fmtMoney(done.total)}</p>

          <div className="mt-4 space-y-3 text-left">
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm font-semibold text-orange-700">Guarda tu número de seguimiento</p>
              <p className="mt-1 text-sm text-orange-600">Usa <strong>{done.invoice_number}</strong> como guía para consultar el estado de tu pedido.</p>
            </div>

            {isCash ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
                <p className="text-sm font-bold">Pago en efectivo — comprobante</p>
                <p className="mt-1 text-sm text-green-700">
                  Presenta este comprobante <strong>{done.invoice_number}</strong> en el taller para pagar. Vence en 1 día ({new Date(Date.now() + 24*60*60*1000).toLocaleDateString('es-CO')}).
                </p>
                <p className="mt-1 text-xs text-green-600">Tu pedido está registrado en el sistema del taller. Llévalo impreso o en el celular.</p>
                {user ? (
                  <div className="mt-3">
                    <Link to="/panel/pedidos" className="btn-primary btn-shine w-full">Ver mis pedidos</Link>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-green-600">Guarda este número: lo necesitarás para consultar y pagar.</p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <p className="text-sm font-bold">Pago pendiente ({done.payment_method})</p>
                {user ? (
                  <>
                    <p className="mt-1 text-sm text-amber-700">
                      Realiza la transferencia y sube el comprobante desde <strong>Mis Pedidos</strong> para confirmar tu pedido.
                    </p>
                    {done.payment_method === 'transferencia' && (
                      <div className="mt-3">
                        <PaymentInfoBlock />
                        <p className="mt-2 text-xs text-amber-700">Envía el comprobante por WhatsApp o súbelo desde tu panel.</p>
                      </div>
                    )}
                    <div className="mt-3">
                      <Link to="/panel/pedidos" className="btn-primary btn-shine w-full">Subir comprobante ahora</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-amber-700">
                      Realiza la transferencia con el siguiente dato y envíanos el comprobante por WhatsApp para confirmar tu pedido.
                    </p>
                    {done.payment_method === 'transferencia' && (
                      <div className="mt-3">
                        <PaymentInfoBlock />
                      </div>
                    )}
                    <p className="mt-3 text-xs text-amber-600">
                      Número de pedido: <strong className="text-amber-800">{done.invoice_number}</strong> — inclúyelo en el mensaje de WhatsApp.
                    </p>
                    {workshop_phone && (
                      <a
                        href={`https://wa.me/${workshop_phone}?text=${encodeURIComponent(`Hola, soy ${done.customer_name}. Realicé una transferencia por el pedido ${done.invoice_number} por un valor de $${done.total.toLocaleString('es-CO')}. Adjunto el comprobante de pago.`)}`}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white hover:bg-green-600 transition"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Enviar comprobante por WhatsApp
                      </a>
                    )}
                    <p className="mt-2 text-xs text-center text-amber-500">Guarda tu número de pedido: <strong>{done.invoice_number}</strong></p>
                  </>
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
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-50 text-4xl">🛒</div>
        <h1 className="mt-5 text-3xl font-bold text-gray-800">Tu carrito está vacío</h1>
        <p className="mt-2 text-gray-500">Explora nuestro catálogo y encuentra lo que tu moto necesita.</p>
        <Link to={storePath} className="btn-primary btn-shine mt-6 inline-flex">Ir a la tienda</Link>
      </div>
    )
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-800 placeholder:text-gray-400 transition focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-100'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* ── Progress ── */}
      <div className="mb-10 flex items-center justify-center">
        <div className="flex w-full max-w-2xl items-center">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold transition-all duration-300 ${
                  step > s.n ? 'bg-orange-500 text-white' : step === s.n ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-gray-100 text-gray-400'
                }`}>{step > s.n ? '✓' : s.icon}</div>
                <span className={`mt-1.5 text-xs font-semibold ${step === s.n ? 'text-orange-600' : 'text-gray-400'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-1 mb-5 h-0.5 flex-1 transition-colors ${step > s.n ? 'bg-orange-400' : 'bg-gray-200'}`} />}
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
                <h2 className="text-xl font-bold text-gray-800">Tu carrito <span className="text-sm font-normal text-gray-400">({count} productos)</span></h2>
                <button onClick={clear} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500">
                  🗑 Vaciar carrito
                </button>
              </div>

              {fulfillment === 'shipping' && (
                <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {freeShippingLeft > 0
                        ? <>Te faltan <strong className="text-orange-500">{fmtMoney(freeShippingLeft)}</strong> para obtener envío gratis</>
                        : <strong className="text-green-500">¡Tienes envío gratis!</strong>
                      }
                    </span>
                    <span className="text-gray-400">{fmtMoney(total)} / {fmtMoney(storeConfig.free_shipping_threshold)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full transition-all duration-500 ${freeShippingPct >= 100 ? 'bg-green-400' : 'bg-orange-400'}`} style={{ width: `${freeShippingPct}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {items.map((i) => (
                  <div key={cartKey(i)} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex items-center gap-4">
                      <ProductImg src={i.image} name={i.name} className="h-20 w-20 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">{i.name}</p>
                        {i.variant && (
                          <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: i.variant.hex }} />
                            {i.variant.name}
                          </span>
                        )}
                        {i.brand && <p className="text-xs text-gray-400">{i.brand}</p>}
                        <p className="mt-1 text-sm text-gray-500">{fmtMoney(i.price)} / {i.unit}</p>
                        <span className={`mt-1 inline-block text-xs font-medium ${i.available > 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {i.available > 0 ? `✓ En stock (${i.available})` : '✗ Agotado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50">
                          <button onClick={() => setQuantity(cartKey(i), i.quantity - 1)} className="flex h-10 w-9 items-center justify-center rounded-l-xl text-gray-500 transition hover:bg-white">−</button>
                          <span className="flex h-10 w-10 items-center justify-center border-x border-gray-200 text-sm font-semibold text-gray-700">{i.quantity}</span>
                          <button onClick={() => setQuantity(cartKey(i), i.quantity + 1)} className="flex h-10 w-9 items-center justify-center rounded-r-xl text-gray-500 transition hover:bg-white">+</button>
                        </div>
                        <span className="w-20 text-right text-base font-bold text-gray-800">{fmtMoney(i.price * i.quantity)}</span>
                        <button onClick={() => remove(cartKey(i))} className="text-gray-300 transition hover:text-red-400" title="Eliminar">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col items-stretch justify-between gap-4 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
                <Link to={storePath} className="flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-orange-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 transition hover:border-orange-300">←</span>
                  Seguir comprando
                </Link>
                <button onClick={nextStep} className="btn-primary btn-shine">Continuar con la entrega →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="mb-5 text-xl font-bold text-gray-800">¿Cómo lo recibes?</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
                {/* Opciones de entrega — columna izquierda */}
                <div className="space-y-3 sm:col-span-2">
                  {fulfillmentOptions.map((o) => (
                    <label key={o.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition ${fulfillment === o.value ? 'border-orange-300 ring-2 ring-orange-100 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input type="radio" name="fulfillment" value={o.value} checked={fulfillment === o.value} onChange={() => setFulfillment(o.value)} className="sr-only" />
                      <span className="text-2xl">{o.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">{o.label}</p>
                        <p className="text-xs text-gray-500">{o.desc}</p>
                      </div>
                      {fulfillment === o.value && <span className="h-6 w-6 shrink-0 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">✓</span>}
                    </label>
                  ))}
                </div>

                {/* Formulario contextual — columna derecha */}
                <div className="sm:col-span-3">
                  {fulfillment === 'shipping' && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-500">📍 Dirección de envío</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input value={shipCity} onChange={(e) => setShipCity(e.target.value)} placeholder="Ciudad *" className={inputCls} />
                        <input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Teléfono de contacto *" type="tel" className={inputCls} />
                      </div>
                      <input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} placeholder="Dirección completa *" className={inputCls} />
                      <textarea value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} placeholder="Referencias (barrio, punto conocido, etc.)" rows={2} className={`${inputCls} resize-none`} />
                    </div>
                  )}

                  {fulfillment === 'installing' && user && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-500">🔧 Moto para instalación</h3>
                      <select value={motorcycleId} onChange={(e) => setMotorcycleId(e.target.value)} className="garaje-input mt-3">
                        <option value="">Selecciona una moto</option>
                        {motorcycles.map((mt) => <option key={mt.id} value={mt.id}>{mt.nickname || mt.plate || 'Moto'} {mt.model?.name ? `· ${mt.model.name}` : ''}</option>)}
                      </select>
                    </div>
                  )}

                  {fulfillment === 'installing' && !user && (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-center">
                      <p className="text-sm text-orange-700">Para instalación debes <Link to="/login" className="font-bold underline">iniciar sesión</Link> y registrar tu moto en Mi Garaje.</p>
                    </div>
                  )}

                  {fulfillment === 'pickup' && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                      <h3 className="text-sm font-bold text-green-700">🏠 Retiro en taller</h3>
                      <p className="mt-1 text-sm text-green-600">Recoge tu pedido sin costo adicional. Te notificaremos cuando esté listo.</p>
                    </div>
                  )}

                  {!fulfillment && (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="text-sm text-gray-400">Selecciona un método de entrega para continuar</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-gray-100 pt-5">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={nextStep} className="btn-primary">Continuar con el pago →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-5 text-xl font-bold text-gray-800">Método de pago</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
                {/* Métodos de pago — columna izquierda */}
                <div className="space-y-3 sm:col-span-2">
                  {paymentMethods.map((m) => (
                    <label key={m.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition ${paymentMethod === m.value ? 'border-orange-300 ring-2 ring-orange-100 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input type="radio" name="payment" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="sr-only" />
                      <span className="text-2xl">{m.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                      </div>
                      {paymentMethod === m.value && <span className="h-6 w-6 shrink-0 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm">✓</span>}
                    </label>
                  ))}
                </div>

                {/* Formulario contextual — columna derecha */}
                <div className="space-y-4 sm:col-span-3">
                  {paymentMethod === 'transferencia' && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-500">🏦 Datos para transferencia</h3>
                      <div className="mt-3">
                        <PaymentInfoBlock />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'efectivo' && (
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                      <h3 className="text-sm font-bold text-green-700">💵 Pago en efectivo</h3>
                      <p className="mt-1 text-sm text-green-600">Paga al retirar tu pedido en el taller o al recibirlo en tu domicilio.</p>
                    </div>
                  )}

                  {user && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Puntos de lealtad</h3>
                      <input type="number" min={0} value={pointsToUse} onChange={(e) => setPointsToUse(Math.max(0, Number(e.target.value)))} className="garaje-input mt-2" placeholder="0" />
                      <p className="mt-1 text-xs text-gray-400">Cada punto vale {fmtMoney(pointsValue)} de descuento.</p>
                    </div>
                  )}

                  {!user && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Tus datos</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nombre completo *" className={inputCls} />
                        <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Teléfono (opcional)" type="tel" className={inputCls} />
                      </div>
                      <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email *" type="email" className={inputCls} />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-gray-100 pt-5">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={nextStep} className="btn-primary">Continuar con la confirmación →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="mb-5 text-xl font-bold text-gray-800">Confirma tu pedido</h2>

              {/* Resumen de artículos */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Artículos ({count})</h3>
                <div className="mt-3 divide-y divide-gray-100">
                  {items.map((i) => (
                    <div key={cartKey(i)} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <ProductImg src={i.image} name={i.name} className="h-12 w-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{i.name}</p>
                        {i.variant && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <span className="h-2.5 w-2.5 rounded-full border border-gray-200" style={{ backgroundColor: i.variant.hex }} />
                            {i.variant.name}
                          </span>
                        )}
                        <p className="text-xs text-gray-400">{i.quantity} x {fmtMoney(i.price)}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{fmtMoney(i.price * i.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen de entrega y pago */}
              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Entrega</p>
                    <p className="mt-1 font-medium text-gray-800">{fulfillmentOptions.find((o) => o.value === fulfillment)?.icon} {fulfillmentOptions.find((o) => o.value === fulfillment)?.label}</p>
                    {fulfillment === 'shipping' && <p className="text-xs text-gray-500 mt-0.5">{shipCity}, {shipAddress}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Pago</p>
                    <p className="mt-1 font-medium text-gray-800">{paymentMethods.find((m) => m.value === paymentMethod)?.icon} {paymentMethods.find((m) => m.value === paymentMethod)?.label}</p>
                    {!user && <p className="text-xs text-gray-500 mt-0.5">{guestName} · {guestEmail}</p>}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between border-t border-gray-100 pt-5">
                <button onClick={prevStep} className="btn-ghost">← Atrás</button>
                <button onClick={checkout} disabled={checkingOut} className="btn-primary btn-shine flex items-center gap-2">
                  {checkingOut ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Procesando...
                    </>
                  ) : 'Confirmar y pagar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Resumen rápido */}
            {(fulfillment || paymentMethod) && (
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
                {fulfillment && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{fulfillmentOptions.find((o) => o.value === fulfillment)?.icon}</span>
                    <span className="text-gray-600">{fulfillmentOptions.find((o) => o.value === fulfillment)?.label}</span>
                  </div>
                )}
                {paymentMethod && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{paymentMethods.find((m) => m.value === paymentMethod)?.icon}</span>
                    <span className="text-gray-600">{paymentMethods.find((m) => m.value === paymentMethod)?.label}</span>
                  </div>
                )}
              </div>
            )}

            {/* Totales */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Resumen</h3>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal ({count} artículos)</span><span className="font-semibold text-gray-800">{fmtMoney(total)}</span></div>
                {loyaltyDiscount > 0 && <div className="flex justify-between text-green-600"><span>Descuento (puntos)</span><span>−{fmtMoney(loyaltyDiscount)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Envío</span><span className={`font-semibold ${shippingFee > 0 ? 'text-gray-800' : 'text-green-500'}`}>{shippingFee > 0 ? fmtMoney(shippingFee) : 'Gratis'}</span></div>
                {taxEnabled && <div className="flex justify-between"><span className="text-gray-500">IVA ({taxRate}%)</span><span className="font-semibold text-gray-800">{fmtMoney(tax)}</span></div>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-base font-bold text-gray-800">Total</span>
                <span className="text-xl font-black text-orange-500">{fmtMoney(finalTotal)}</span>
              </div>
              {fulfillment === 'shipping' && (
                <p className="mt-2 text-xs text-center text-gray-400">Estimado: {deliveryDate}</p>
              )}
            </div>



            {msg && <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-500">{msg}</p>}

            {/* Badges de confianza */}
            <div className="grid grid-cols-2 gap-2">
              {trustBadges.map((b) => (
                <div key={b.label} className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
                  <span className="text-base">{b.icon}</span>
                  <span className="text-xs font-medium text-orange-700">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sugerencias ── */}
      {suggestionsToShow.length > 0 && (
        <div className="mt-10 border-t border-gray-100 pt-8">
          <h3 className="text-xl font-bold text-gray-800">También te puede interesar</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {suggestionsToShow.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md p-3">
                <ProductImg src={p.image} name={p.name} className="mx-auto h-28 w-full" />
                <div className="mt-3">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{p.name}</p>
                  {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                  <p className="mt-1 text-sm font-bold text-gray-800">{fmtMoney(p.final_price ?? p.price)}</p>
                </div>
                <button
                  onClick={() => add({ productId: p.id, name: p.name, price: p.final_price ?? p.price, unit: p.unit, available: p.available, image: p.image, brand: p.brand })}
                  className="mt-3 w-full rounded-xl border-2 border-orange-400 py-1.5 text-sm font-semibold text-orange-500 transition hover:bg-orange-500 hover:text-white"
                >
                  🛒 Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WhatsApp ── */}
      <div className="mt-8 rounded-2xl border border-gray-100 bg-white py-4 text-center text-sm text-gray-500 shadow-sm">
        ¿Tienes dudas con tu pedido? Contáctanos por <a href={`https://wa.me/${workshop_phone || '573001234567'}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-500 hover:underline">WhatsApp</a>
      </div>
    </div>
  )
}
