import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const DEFAULT_PRIVACY = [
  {
    h: 'Uso de tus datos',
    p: 'Recopilamos tu nombre, correo, teléfono y datos de tu motocicleta únicamente para gestionar citas, órdenes de servicio, facturación y comunicaciones del taller.',
  },
  {
    h: 'Comunicaciones',
    p: 'Podemos enviarte avisos por WhatsApp y correo relacionados con tus órdenes, citas y facturas. Dejarás de recibirlos al cerrar tu cuenta.',
  },
  {
    h: 'Protección',
    p: 'Tu contraseña se almacena cifrada y no compartimos tu información con terceros fuera del funcionamiento del taller.',
  },
]

const DEFAULT_TERMS = [
  {
    h: 'Servicios',
    p: 'Los servicios y repuestos se entregan conforme a la cotización aprobada. El trabajo está garantizado según las condiciones indicadas en tu orden.',
  },
  {
    h: 'Pagos',
    p: 'Los totales incluyen impuestos vigentes. Puedes abonar o pagar en el retiro de tu motocicleta según lo acordado.',
  },
  {
    h: 'Responsabilidades',
    p: 'El taller no se responsabiliza por accesorios no reportados al ingreso ni por el retiro de la moto sin la revisión final.',
  },
]

/** Convierte texto plano con # y líneas en blanco a secciones. */
function parseContent(raw: string): { h: string; p: string }[] {
  if (!raw.trim()) return []
  const blocks = raw.trim().split(/\n\s*\n/)
  const out: { h: string; p: string }[] = []
  let current: { h: string; p: string[] } | null = null
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const first = lines[0]
    if (first.startsWith('#')) {
      if (current) out.push({ h: current.h, p: current.p.join(' ') })
      current = { h: first.replace(/^#+\s*/, ''), p: [] }
    } else if (current) {
      current.p.push(lines.join(' '))
    } else {
      out.push({ h: 'Información', p: lines.join(' ') })
    }
  }
  if (current) out.push({ h: current.h, p: current.p.join(' ') })
  return out
}

export default function LegalPage({ title }: { title: string }) {
  const isPrivacy = title === 'Política de privacidad'
  const [custom, setCustom] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ privacy_content: string; terms_content: string }>('/site-info')
      .then((d) => {
        if (alive) setCustom(isPrivacy ? d.privacy_content : d.terms_content)
      })
      .catch(() => {
        if (alive) setCustom('')
      })
    return () => { alive = false }
  }, [isPrivacy])

  const sections = custom !== null && custom.trim() ? parseContent(custom) : (isPrivacy ? DEFAULT_PRIVACY : DEFAULT_TERMS)

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-extrabold tracking-tight text-carbon-900 dark:text-carbon-700">{title}</h1>
      <p className="mt-1 text-sm text-carbon-500">Vigente desde el {new Date().getFullYear()}.</p>
      {custom === null ? (
        <div className="mt-8 space-y-6">
          {DEFAULT_PRIVACY.map((s) => (
            <div key={s.h}>
              <h2 className="font-semibold text-carbon-900">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600">{s.p}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {sections.map((s, idx) => (
            <div key={`${s.h}-${idx}`}>
              <h2 className="font-semibold text-carbon-900 dark:text-carbon-700">{s.h}</h2>
              <p className="mt-1 text-sm leading-relaxed text-carbon-600 dark:text-carbon-400">{s.p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}