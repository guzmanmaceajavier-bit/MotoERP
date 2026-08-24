import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../lib/api'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import { useHero } from '../../lib/useSiteImages'

const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

interface TrackResult {
  order_number: string
  kind?: string
  status: string
  service_type?: string
  customer_name?: string
  total?: number
  items?: { description: string; quantity: number; unit_price: number; total: number }[]
  created_at?: string
  estimated_delivery?: string
  observations?: string
}

const statusTone: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  awaiting_approval: 'bg-sky-100 text-sky-800',
  approved: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-brand-100 text-brand-800',
  completed: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('')
  const hero = useHero('track')
  const [result, setResult] = useState<TrackResult | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  usePageMeta(
    'Consultar orden | Seguimiento de tu servicio',
    'Consulta el estado de tu orden de servicio o compra en la tienda con el número de orden.',
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setResult(null)
    setError('')
    setSubmitting(true)
    try {
      const data = await api<TrackResult>('/orders/track', {
        method: 'POST',
        body: JSON.stringify({ order_number: orderNumber }),
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gray-50">
      <section className="relative overflow-hidden bg-white pb-10 pt-14 md:pt-20">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-orange-300" />
        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-400" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-3xl font-black leading-[1.08] tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
            {hero.title ? <>{hero.title}</> : <>Consulta tu <span className="gradient-text">orden</span></>}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-gray-500">
            {hero.subtitle || 'Ingresa el número de orden para conocer el estado de tu reparación en tiempo real.'}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 py-12">
        <Reveal>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ej. ORD-0001"
              required
              className="garaje-input flex-1"
            />
            <button type="submit" disabled={submitting} className="btn-primary btn-shine shrink-0">
              {submitting ? 'Consultando...' : 'Consultar orden'}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {result && (
            <div className="anim-fade-up card mt-6 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-carbon-100 bg-carbon-50 bg-opacity-50 px-6 py-4">
                <h2 className="text-lg font-bold text-carbon-900">{result.order_number}</h2>
                <span className={`chip capitalize ${statusTone[result.status] ?? 'bg-carbon-100 text-carbon-700'}`}>
                  {result.status.replace('_', ' ')}
                </span>
              </div>
              <dl className="space-y-3 px-6 py-5 text-sm">
                {result.customer_name && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-carbon-500">Cliente</dt>
                    <dd className="text-right font-semibold text-carbon-900">{result.customer_name}</dd>
                  </div>
                )}
                {result.service_type && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-carbon-500">Servicio</dt>
                    <dd className="text-right font-semibold text-carbon-900">{result.service_type}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-carbon-500">Fecha de ingreso</dt>
                  <dd className="font-medium text-carbon-900">{result.created_at}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-carbon-500">Entrega estimada</dt>
                  <dd className="font-medium text-carbon-900">{result.estimated_delivery || 'Por confirmar'}</dd>
                </div>
              </dl>

              {result.kind === 'store' && result.items && result.items.length > 0 && (
                <div className="mx-6 mb-6 overflow-hidden rounded-xl border border-carbon-100">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-carbon-100 bg-carbon-50 text-carbon-500">
                      <tr>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">P. unit</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-carbon-50">
                          <td className="px-3 py-2 text-carbon-800">{it.description}</td>
                          <td className="px-3 py-2 text-right text-carbon-600">{it.quantity}</td>
                          <td className="px-3 py-2 text-right text-carbon-600">{fmt(it.unit_price)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-carbon-900">{fmt(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.kind === 'store' && result.total != null && (
                <div className="mx-6 mb-6 flex items-center justify-between rounded-xl bg-carbon-950 px-4 py-3 text-white">
                  <span className="text-sm font-medium text-carbon-300">Total</span>
                  <span className="text-lg font-black">{fmt(result.total)}</span>
                </div>
              )}
              {result.observations && (
                <div className="mx-6 mb-6 rounded-xl bg-brand-50 p-4 text-sm text-carbon-700">
                  <strong>Observaciones:</strong> {result.observations}
                </div>
              )}
            </div>
          )}
        </Reveal>
      </section>
    </div>
  )
}