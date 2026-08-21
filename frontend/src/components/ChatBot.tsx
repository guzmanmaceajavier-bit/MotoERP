import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { waLink } from '../lib/wa'
import type { Paginated } from '../lib/pagination'
import { unwrapList } from '../lib/pagination'
import type { Product } from '../lib/types'
import { useSiteInfo } from '../lib/useSiteImages'

interface Msg {
  from: 'bot' | 'user'
  text: string
  html?: string
  links?: { to?: string; href?: string; label: string }[]
}

const quickActions = [
  { key: 'servicios', label: '🛠 Servicios' },
  { key: 'cita', label: '📅 Agendar cita' },
  { key: 'orden', label: '🧾 Consultar orden' },
  { key: 'envios', label: '🚚 Envíos' },
  { key: 'puntos', label: '⭐ Puntos' },
  { key: 'repuesto', label: '🔍 Buscar repuesto' },
  { key: 'asesor', label: '👤 Asesor' },
]

const answers: Record<string, { text: string; links?: { to?: string; href?: string; label: string }[] }> = {
  saludo: {
    text: '👋 ¡Hola! Bienvenido a nuestro taller. Soy tu asistente virtual y conozco la tienda, los servicios y el taller.\n\nPuedes preguntarme por repuestos (por ejemplo: "¿una cadena de Bajaj le sirve a una MT-09?"), servicios, citas, órdenes, envíos o puntos. ¿Qué necesitas?',
  },
  servicios: {
    text: '🛠 Ofrecemos diagnóstico, mantenimiento preventivo y correctivo, cambio de aceite, llantas, frenos, repuestos y acompañamiento con la hoja de vida digital de tu moto.',
    links: [{ to: '/servicios', label: 'Ver todos los servicios' }],
  },
  cita: {
    text: '📅 Puedes agendar tu cita en línea en menos de un minuto eligiendo el día y la hora que prefieras.',
    links: [{ to: '/agendar', label: 'Agendar ahora' }],
  },
  orden: {
    text: '🧾 Para conocer el estado de tu reparación solo necesitas el número de orden. Consulta aquí:',
    links: [{ to: '/consultar', label: 'Consultar orden' }],
  },
  reparacion: {
    text: '⚙️ La mayoría de reparaciones se entregan entre 1 y 3 días hábiles, según la disponibilidad de repuestos. En el diagnóstico te damos el tiempo exacto.',
  },
  horarios: {
    text: '🕗 Estamos abiertos de lunes a viernes de 8:00 am a 6:00 pm y sábados de 8:00 am a 12:00 pm. Domingos y festivos cerrado.',
  },
  envios: {
    text: '🚚 Hacemos envíos a todo el país. Compras superiores a $150.000 tienen envío gratis y la entrega tarda de 2 a 5 días hábiles según tu ciudad.',
    links: [{ to: '/tienda', label: 'Ir a la tienda' }],
  },
  puntos: {
    text: '⭐ Con tu cuenta acumulas puntos con compras y servicios. Cada punto equivale a $100 de descuento en tu próxima compra.',
    links: [{ to: '/registro', label: 'Crear cuenta' }],
  },
  asesor: {
    text: '👤 Con gusto te atiende una persona por WhatsApp. Escríbenos y responderemos lo antes posible.',
    links: [{ to: '/contacto', label: 'Ir a contacto' }],
  },
  default: {
    text: '🤔 No encontré una respuesta exacta. Puedo ayudarte con repuestos, servicios, citas, órdenes, envíos o puntos. Prueba con alguna de las opciones rápidas o escribe tu pregunta.',
  },
}

const fmtMoney = (n: number) =>
  '$' + Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })

// Categorías / piezas que buscamos en el catálogo
const partTerms: { terms: string[]; search: string }[] = [
  { terms: ['cadena', 'cadenilla', 'kit de arrastre'], search: 'cadena' },
  { terms: ['aceite', 'lubricante'], search: 'aceite' },
  { terms: ['llanta', 'llantas', 'neumatico', 'caucho'], search: 'llanta' },
  { terms: ['freno', 'pastilla', 'disco de freno'], search: 'freno' },
  { terms: ['filtro'], search: 'filtro' },
  { terms: ['bujia', 'bujías', 'chispa'], search: 'bujia' },
  { terms: ['bateria', 'batería'], search: 'bateria' },
  { terms: ['espejo', 'retrovisor'], search: 'espejo' },
  { terms: ['manigueta', 'maneta', 'palanca', 'guayaba'], search: 'manigueta' },
  { terms: ['llave', 'herramienta'], search: 'llave' },
  { terms: ['casco'], search: 'casco' },
  { terms: ['candado', 'seguridad'], search: 'candado' },
]

const brands: { terms: string[]; name: string }[] = [
  { terms: ['bajaj', 'pulsar', 'boxer', 'avenger', 'platino', 'discover'], name: 'Bajaj' },
  { terms: ['yahama', 'yamaha', 'mt-09', 'mt09', 'fz', 'xtz', 'r15'], name: 'Yamaha' },
  { terms: ['honda', 'activa', 'cb', 'cgl', 'unicorn', 'horne'], name: 'Honda' },
  { terms: ['suzuki', 'gixxer', 'gsx'], name: 'Suzuki' },
  { terms: ['kawasaki', 'ninja', 'z ', 'versys'], name: 'Kawasaki' },
  { terms: ['ktm', 'duke', 'rc'], name: 'KTM' },
]

function detectPart(text: string): string | null {
  const t = text.toLowerCase()
  for (const p of partTerms) if (p.terms.some((k) => t.includes(k))) return p.search
  return null
}

function detectBrand(text: string): string | null {
  const t = text.toLowerCase()
  const found = brands.find((b) => b.terms.some((k) => t.includes(k)))
  return found ? found.name : null
}

function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')
}

function isCatalogQuestion(text: string): boolean {
const t = normalize(text)
  if (detectPart(text)) return true
  // pregunta de compatibilidad: menciona una moto y un repuesto
  const mentionsModel = /mt[- ]?09|boxer|pulsar|ak|ninja|duke|fz|xtz|r15|activ|discover|cbr|gsx|gz/.test(t)
  const mentionsPart = /cadena|aceite|llanta|freno|bujia|filtro|bateria|espejo|manigueta|casco|guante/.test(t)
  return mentionsModel && mentionsPart
}

async function searchCatalog(query: string): Promise<Product[]> {
  try {
    const res = await api<Paginated<Product>>(`/products?search=${encodeURIComponent(query)}&per_page=4`)
    return unwrapList(res)
  } catch {
    return []
  }
}

function renderProducts(products: Product[]): { html: string; links: { to: string; label: string }[] } {
  const lines = products
    .map(
      (p) =>
        `• <b>${p.name}</b> — ${fmtMoney(p.final_price ?? p.price)}${p.brand ? ` · ${p.brand}` : ''}${p.available > 0 ? ' ✓' : ' ⛔'}`,
    )
    .join('\n')
  return {
    html: lines,
    links: [{ to: '/tienda', label: 'Ver catálogo completo' }],
  }
}

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [phone, setPhone] = useState('')
  const { workshop_name: siteName } = useSiteInfo()
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: '👋 ¡Hola! Soy el asistente virtual de nuestro taller. Conozco la tienda y los servicios: puedes preguntarme por repuestos, compatibilidad (¿una cadena de Bajaj le sirve a una MT-09?), servicios, citas o envíos. ¿En qué te ayudo?' },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<{ workshop_phone: string }>('/site-info')
      .then((d) => setPhone(d.workshop_phone))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [msgs, typing, open])

  async function send(text: string) {
    const raw = text.trim()
    if (!raw) return
    const clean = raw

    setMsgs((m) => [...m, { from: 'user', text: clean }])
    setInput('')
    setTyping(true)

    if (isCatalogQuestion(clean)) {
      const part = detectPart(clean)
      const brand = detectBrand(clean)
      // buscar el repuesto con la marca (y quizá el modelo) primero; si no hay resultados, solo el repuesto
      let products: Product[] = []
      if (part) {
        products = await searchCatalog(brand ? `${part} ${brand}` : part)
        if (products.length === 0 && brand) products = await searchCatalog(part)
      }
      setTyping(false)
      if (products.length > 0) {
        const r = renderProducts(products)
        setMsgs((m) => [
          ...m,
          {
            from: 'bot',
            text:
              `🔍 Encontré estos repuestos${brand ? ` para <b>${brand}</b>` : ''}. Recuerda que la compatibilidad depende del modelo, año y cilindraje exacto de tu moto.\n\n` +
              `Repuestos encontrados:\n${r.html}`,
            html: r.html,
            links: r.links,
          },
        ])
      } else {
        setMsgs((m) => [
          ...m,
          {
            from: 'bot',
            text:
              '🔍 No encontré ese repuesto en el catálogo con esa referencia. Puedo buscarlo de otra forma: dime la marca y modelo de tu moto y el repuesto exacto (cadena, aceite, llanta, frenos...), o consulta directo con un asesor.',
            links: [
              { to: '/tienda', label: 'Ver tienda' },
              phone ? { href: waLink(phone, 'Hola! Busco un repuesto para mi moto.'), label: 'Hablar con asesor' } : { to: '/contacto', label: 'Contacto' },
            ],
          },
        ])
      }
      return
    }

    // Respuestas predefinidas
    setTyping(true)
    const key = detect(clean)
      const delay = key === 'default' ? 700 : 500 + Math.min(400, clean.length * 10)
      setTimeout(() => {
        setTyping(false)
        const reply = getAnswer(key)
      if (key === 'asesor' && phone) {
        reply.links = [
          { href: waLink(phone, `Hola! Necesito hablar con un asesor de ${siteName || 'MotoSystem'}.`), label: 'Abrir WhatsApp' },
          { to: '/contacto', label: 'Ir a contacto' },
        ]
      }
      setMsgs((m) => [...m, reply])
    }, delay)
  }

  function low(text: string): string {
    return text.toLowerCase()
  }

  function detect(t: string): string {
    const s = low(t)
    const rules: [RegExp, string][] = [
      [/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|hi|saludos?|que tal)/, 'saludo'],
      [/servicio|mantenimiento|reparo|aceite|llanta|diagnost|freno|mecanic/, 'servicios'],
      [/cita|agenda|reserva|turno|agendar/, 'cita'],
      [/orden|estado|rastrear|guia|seguimiento|factura/, 'orden'],
      [/cuanto|tarda|demora|tiempo|rapido|dias|plazo/, 'reparacion'],
      [/horari|abierto|abre|cierra|domingo|sabado/, 'horarios'],
      [/envio|domicilio|entrega|correo|courier|envian/, 'envios'],
      [/punto|bono|descuento|premio|acumul/, 'puntos'],
      [/asesor|persona|humano|whatsapp|hablar|vendedor/, 'asesor'],
      [/gracias|muchas gracias|excelente|perfecto/, 'gracias'],
      [/repuesto|parte|accesorio|precio.*cadena/, 'repuesto'],
    ]
    for (const [re, k] of rules) if (re.test(s)) return k
    return 'default'
  }

function getAnswer(key: string): Msg {
    const ext: Record<string, { text: string; links?: { to?: string; href?: string; label: string }[] }> = {
      ...answers,
      gracias: {
        text: '😊 ¡Con gusto! Para lo que necesites, aquí estoy. También puedes agendar tu próxima cita o visitar nuestra tienda.',
      },
      repuesto: {
        text: '🔍 Claro, buscamos repuestos en nuestro catálogo. Escríbeme algo como: "¿cadena para una Bajaj Boxer?" o "¿aceite para MT-09?" y te muestro lo que hay disponible.',
        links: [{ to: '/tienda', label: 'Explorar tienda' }],
      },
    }
    const a = ext[key] ?? answers.default
    return { from: 'bot', text: a.text, links: a.links }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Asistente virtual"
        title="Asistente virtual"
        className="chat-float"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
        )}
      </button>

      {open && (
        <div className="chat-panel anim-fade-up">
          {/* Header */}
          <div className="flex items-center gap-3 bg-carbon-900 px-4 py-3 text-white">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg">🤖</span>
            <div className="min-w-0">
              <p className="text-sm font-bold">Asistente {siteName || 'MotoSystem'}</p>
              <p className="flex items-center gap-1 text-xs text-green-400">● En línea</p>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-body">
            {msgs.map((m, i) => (
              <div key={i} className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${m.from === 'bot' ? 'self-start rounded-bl-sm bg-white text-carbon-800 shadow' : 'self-end rounded-br-sm bg-brand-600 text-white'}`}>
                {m.html ? (
                  <>
                    <span dangerouslySetInnerHTML={{ __html: m.text }} />
                    {m.links && (
                      <span className="mt-2 flex flex-col gap-1.5">
                        {m.links.map((l, j) =>
                          l.href ? (
                            <a key={j} href={l.href} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 rounded-lg bg-carbon-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                              {l.label} ↗
                            </a>
                          ) : (
                            <Link key={j} to={l.to!} onClick={() => setOpen(false)} className="inline-flex w-fit items-center gap-1 rounded-lg bg-carbon-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                              {l.label} →
                            </Link>
                          ),
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {m.text}
                    {m.links && (
                      <span className="mt-2 flex flex-col gap-1.5">
                        {m.links.map((l, j) =>
                          l.href ? (
                            <a key={j} href={l.href} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 rounded-lg bg-carbon-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                              {l.label} ↗
                            </a>
                          ) : (
                            <Link key={j} to={l.to!} onClick={() => setOpen(false)} className="inline-flex w-fit items-center gap-1 rounded-lg bg-carbon-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                              {l.label} →
                            </Link>
                          ),
                        )}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 shadow">
                <span className="chat-dot" />
                <span className="chat-dot" style={{ animationDelay: '0.15s' }} />
                <span className="chat-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5 border-t border-carbon-100 px-3 pt-2.5">
            {quickActions.map((q) => (
              <button key={q.key} type="button" onClick={() => send(q.key)} className="rounded-full border border-carbon-200 px-3 py-1 text-xs text-carbon-600 transition hover:border-brand-500 hover:text-brand-600">
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="Ej: ¿una cadena de Bajaj le sirve a una MT-09?"
              className="w-full rounded-xl border border-carbon-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button type="button" onClick={() => send(input)} aria-label="Enviar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}