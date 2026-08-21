import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface PaymentOptionInfo {
  method: string
  label?: string
  holder?: string
  number?: string
  extra?: string
}

interface PaymentInfo {
  payment_options: PaymentOptionInfo[]
  payment_instructions?: string
}

export default function PaymentInfoBlock() {
  const [info, setInfo] = useState<PaymentInfo | null>(null)
  useEffect(() => {
    api<PaymentInfo>('/payment-info')
      .then(setInfo)
      .catch(() => {})
  }, [])
  if (!info) return null
  const options = (info.payment_options ?? []).filter((o) => o.number || o.method)
  if (!options.length && !info.payment_instructions) return null
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-700">¿A dónde pagar?</p>
      {info.payment_instructions && <p className="mt-1 text-sm text-carbon-600">{info.payment_instructions}</p>}
      <div className="mt-3 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm">
            <span className="font-bold text-brand-700">{o.label || o.method}</span>
            {o.holder && <span className="text-carbon-600">{o.holder}</span>}
            <span className="font-mono text-carbon-900">{o.number}</span>
            {o.extra && <span className="text-xs text-carbon-500">{o.extra}</span>}
            {o.number && (
              <button
                onClick={() => { navigator.clipboard?.writeText(o.number ?? '').catch(() => {}) }}
                className="ml-auto rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
              >
                Copiar
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}