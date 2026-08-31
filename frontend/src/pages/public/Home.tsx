import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useCart } from '../../lib/cart'
import { usePageMeta } from '../../lib/usePageMeta'
import { Reveal } from '../../components/Reveal'
import heroImg from '../../assets/hero.png'
import { useHero, useSiteInfo } from '../../lib/useSiteImages'

interface Brand {
  id: number
  name: string
  image?: string | null
}

interface Banner {
  image: string
  title: string
  subtitle?: string
  link?: string
}

interface Service {
  id: number
  name: string
  description?: string
  price?: string | number
  estimated_minutes?: number
  category?: string
}

interface Product {
  id: number
  name: string
  slug: string
  price: number
  final_price?: number
  promo_price?: number | null
  image?: string | null
  category?: string
  brand?: string | null
  available?: number
  part_type?: string
  unit?: string
}

interface Post {
  id: number
  title: string
  slug: string
  excerpt?: string
  cover?: string | null
  published_at?: string
}

interface HomeData {
  stats?: { customers: number; completed_orders: number; products: number; avg_rating: number | null }
  featured_services?: Service[]
  featured_products?: Product[]
  posts?: Post[]
}

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

const steps = [
  { n: '01', title: 'Registra tu moto', desc: 'Crea tu garaje digital y añade tus motos en segundos.', icon: 'bike' },
  { n: '02', title: 'Agenda el servicio', desc: 'Elige el servicio y la fecha que mejor te convenga.', icon: 'cal' },
  { n: '03', title: 'Sigue el avance', desc: 'Recibe cotización, aprobación y notificaciones de cada etapa.', icon: 'track' },
]

const marqueeItems = ['Mantenimiento', 'Frenos', 'Motor', 'Transmisión', 'Suspensión', 'Eléctrico', 'Neumáticos', 'Diagnóstico', 'Repuestos', 'Garantía']

const faqs = [
  {
    q: '¿Cómo agendo una cita para mi moto?',
    a: 'Entra a "Agendar cita", elige el servicio, la fecha y la hora. Te contactamos para confirmarla y, si requiere cotización, la recibes directamente en tu teléfono.',
  },
  {
    q: '¿Qué es la hoja de vida digital?',
    a: 'Es el historial de servicios, repuestos y reparaciones de tu moto, siempre disponible en tu cuenta. Con ella sabes exactamente qué se le hizo y cuándo.',
  },
  {
    q: '¿Trabajan repuestos originales o alternativos?',
    a: 'Ambos. En la tienda puedes filtrar por repuesto original o alternativo según tu presupuesto, siempre con garantía y respaldo del taller.',
  },
  {
    q: '¿Hacen envíos a domicilio?',
    a: 'Sí, enviamos a donde estés. También puedes comprar online y recoger en el taller o solicitar la instalación del repuesto con nosotros.',
  },
  {
    q: '¿Cómo hago seguimiento de mi servicio?',
    a: 'Recibirás notificaciones de cada etapa: cotización, aprobación, avance y entrega. Además puedes consultar tu orden en cualquier momento con el número de orden.',
  },
]

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
    gear: 'M10.34 4.34l.38-1.8a1 1 0 011.96 0l.38 1.8a1 1 0 001.9.54l1.48-1.1a1 1 0 011.42 1.42l-1.1 1.48a1 1 0 00.54 1.9l1.8.38a1 1 0 010 1.96l-1.8.38a1 1 0 00-.54 1.9l1.1 1.48a1 1 0 01-1.42 1.42l-1.48-1.1a1 1 0 00-1.9.54l-.38 1.8a1 1 0 01-1.96 0l-.38-1.8a1 1 0 00-1.9-.54l-1.48 1.1a1 1 0 01-1.42-1.42l1.1-1.48a1 1 0 00-.54-1.9l-1.8-.38a1 1 0 010-1.96l1.8-.38a1 1 0 00.54-1.9l-1.1-1.48a1 1 0 011.42-1.42l1.48 1.1a1 1 0 001.9-.54z',
    box: 'M12 3L3 8l9 5 9-5-9-5zM3 8v8l9 5 9-5V8l-9 5-9-5z',
    chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
    bike: 'M5 19a3 3 0 100-6 3 3 0 000 6zm14 0a3 3 0 100-6 3 3 0 000 6zM5 16L8 9h9l2 4H8',
    cal: 'M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    track: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    cart: 'M9 6h11l-1 7H8l-1-9a2 2 0 00-2-2H2M9 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z',
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={paths[name] || paths.wrench} />
    </svg>
  )
}

function ProductCard({ p }: { p: Product }) {
  const { add } = useCart()
  const price = p.final_price ?? p.price
  const hasPromo = p.promo_price != null && p.promo_price < p.price
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-carbon-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative h-36 overflow-hidden bg-carbon-100">
        {p.image ? (
          <img src={p.image} alt={p.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-carbon-300">
            <Icon name="box" className="h-10 w-10" />
          </div>
        )}
        <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${p.part_type === 'original' ? 'bg-brand-600 text-white' : 'bg-amber-400 text-white'}`}>
          {p.part_type ?? 'original'}
        </span>
        {hasPromo && <span className="absolute right-2.5 top-2.5 rounded-md bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white">Oferta</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {p.brand && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">{p.brand}</span>}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold text-carbon-900">{p.name}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-3">
          {hasPromo && <span className="text-xs text-carbon-400 line-through">{fmt(p.price)}</span>}
          <span className="text-lg font-black text-brand-600">{fmt(price)}</span>
        </div>
        <button
          onClick={() =>
            add({
              productId: p.id,
              name: p.name,
              price,
              unit: p.unit ?? 'unidad',
              available: p.available ?? 0,
              image: p.image ?? undefined,
              brand: p.brand ?? undefined,
            })
          }
          disabled={(p.available ?? 0) <= 0}
          className="mt-3 w-full rounded-xl bg-brand-600 py-2 text-xs font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(p.available ?? 0) > 0 ? 'Agregar al carrito' : 'Agotado'}
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [data, setData] = useState<HomeData | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const hero = useHero('home')
  const { workshop_name: siteName } = useSiteInfo()

  usePageMeta(
    siteName ? `${siteName} | Taller de motos y tienda de repuestos` : 'Taller de motos y tienda de repuestos',
    'Servicio técnico para tu motocicleta, repuestos originales y alternativos, citas en línea y hoja de vida digital.',
  )

  useEffect(() => {
    api<{ banners: Banner[] }>('/site-info')
      .then((d) => setBanners((d.banners ?? []).filter((b) => b.image)))
      .catch(() => {})
    api<HomeData>('/home-data').then(setData).catch(() => {})
    api<Brand[]>('/brands').then((b) => setBrands(b.slice(0, 12))).catch(() => {})
  }, [])

  const heroImages = hero.images.length > 0 ? hero.images : [heroImg]
  const [imgSlide, setImgSlide] = useState(0)

  useEffect(() => {
    if (heroImages.length <= 1) return
    const t = setInterval(() => setImgSlide((i) => (i + 1) % heroImages.length), 5000)
    return () => clearInterval(t)
  }, [heroImages.length])

  const heroSlides = [
    {
      title: hero.title || (
        <>Tu taller de motos, <span className="gradient-text">digital y transparente</span></>
      ),
      subtitle:
        hero.subtitle ||
        'Gestiona el mantenimiento de tu motocicleta, compra repuestos y haz seguimiento de cada servicio, todo desde tu teléfono.',
    },
    {
      title: <>Repuestos y accesorios con <span className="gradient-text">stock en vivo</span></>,
      subtitle: 'Busca, compara y compra en nuestra tienda integrada, con envío a casa o instalación en el taller.',
    },
    {
      title: <>Citas en línea y hoja de <span className="gradient-text">vida digital</span></>,
      subtitle: 'Agenda el servicio en menos de un minuto, aprueba cotizaciones desde tu teléfono y recibe notificaciones de cada etapa.',
    },
  ]

  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSlide((i) => (i + 1) % heroSlides.length), 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero.title, hero.subtitle])

  const stats = useMemo(
    () => [
      { label: 'Clientes atendidos', value: data?.stats?.customers ?? null, suffix: '+', icon: 'users' },
      { label: 'Servicios completados', value: data?.stats?.completed_orders ?? null, suffix: '+', icon: 'wrench' },
      { label: 'Productos en stock', value: data?.stats?.products ?? null, suffix: '+', icon: 'box' },
      { label: 'Calificación promedio', value: data?.stats?.avg_rating ?? null, suffix: '★', icon: 'star' },
    ],
    [data],
  )

  const services = data?.featured_services ?? []
  const products = data?.featured_products ?? []
  const posts = data?.posts ?? []

  return (
    <div>
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative isolate overflow-hidden bg-carbon-950 text-white h-[500px] md:h-[600px]">
        {heroImages.map((src, i) => (
          <div key={src} className="absolute inset-0 -z-10">
            <img src={src} alt="" className="h-full w-full object-cover transition-opacity duration-1000" style={{ opacity: i === imgSlide ? 1 : 0 }} />
          </div>
        ))}
        <div className="relative mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-4 text-center">
          <div>
            <h1
              className="mx-auto max-w-4xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
              style={{ textShadow: '0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6)' }}
            >
              {heroSlides[slide].title}
            </h1>
            <p
              className="mx-auto mt-6 max-w-2xl text-lg md:text-xl font-medium"
              style={{ color: '#ffffff', textShadow: '0 1px 10px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)' }}
            >
              {heroSlides[slide].subtitle}
            </p>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/agendar" className="btn-primary btn-shine !px-7 !py-3.5 !text-base">
              Agendar cita
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
            </Link>
            <Link to="/tienda" className="glass !px-7 !py-3.5 !text-base text-white hover:bg-white/15">
              Ver tienda
            </Link>
          </div>
          {heroSlides.length > 1 && (
            <div className="mt-10 flex justify-center gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === slide ? 'w-7 bg-brand-500' : 'w-2 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ MARQUESINA ═══════════ */}
      <div className="border-y border-carbon-200 bg-white py-5">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max gap-10 anim-marquee">
            {[...marqueeItems, ...marqueeItems].map((it, i) => (
              <span key={i} className="flex items-center gap-3 whitespace-nowrap text-carbon-900">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4" /></svg>
                <span className="font-semibold uppercase tracking-wide text-sm">{it}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ BARRA DE CONFIANZA (datos reales) ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 70}>
              <div className="flex items-center gap-4 rounded-2xl border border-carbon-200 bg-white p-5 shadow-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <Icon name={s.icon} className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-black text-carbon-900">
                    {s.value != null ? `${s.value}${s.suffix}` : '—'}
                  </p>
                  <p className="truncate text-xs text-carbon-500">{s.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ SERVICIOS DESTACADOS (DB) ═══════════ */}
      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">Todo para tu <span className="gradient-text">moto</span></h2>
            </div>
            <Link to="/servicios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Ver todos los servicios
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
            </Link>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal key={s.id} delay={i * 90}>
                <Link to="/servicios" className="group card lift h-full flex flex-col justify-between p-6">
                  <div>
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
                      <Icon name="wrench" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-carbon-900">{s.name}</h3>
                    <p className="mt-1.5 line-clamp-3 text-sm text-carbon-500">{s.description || 'Servicio especializado para tu moto.'}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-carbon-100 pt-4">
                    <span className="text-xs font-semibold text-carbon-500">Cotización en el taller</span>
                    <span className="text-[11px] font-medium text-carbon-400">Sin compromiso</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ CÓMO FUNCIONA ═══════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black md:text-4xl">En <span className="gradient-text">3 pasos</span></h2>
          <p className="mx-auto mt-2 max-w-xl text-carbon-500">Así de fácil agendamos tu cita o atendemos tu consulta.</p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="group relative h-full card lift p-7">
                <div className="absolute right-5 top-5 text-5xl font-black text-carbon-100 transition-all duration-300 group-hover:scale-125 group-hover:text-brand-500">{s.n}</div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25">
                  <Icon name={s.icon} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-carbon-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-carbon-500">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ MARCAS QUE TRABAJAMOS ═══════════ */}
      {brands.length > 0 && (
        <section className="border-y border-gray-100 bg-white py-10">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-2xl font-black text-gray-800">Trabajamos con las marcas <span className="gradient-text">que tú conoces</span></h2>
            <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
              <div className="flex w-max gap-10 anim-marquee">
                {[...brands, ...brands].map((b, i) => (
                  <Link key={`${b.id}-${i}`} to={`/tienda?brand=${b.id}`} className="flex items-center justify-center whitespace-nowrap transition hover:opacity-70" title={b.name}>
                    {b.image ? (
                      <img src={b.image} alt={b.name} className="h-12 max-w-[120px] object-contain" />
                    ) : (
                      <span className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wide text-gray-800">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-500">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 16l3.5-6.5a2 2 0 011.8-1H16l2 4.5H20a1 1 0 011 1V16H5z" /><circle cx="8.5" cy="16" r="1.5" /><circle cx="16.5" cy="16" r="1.5" /></svg>
                        </span>
                        {b.name}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ PRODUCTOS DESTACADOS (DB) ═══════════ */}
      {products.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight md:text-4xl">Repuestos <span className="gradient-text">destacados</span></h2>
              </div>
              <Link to="/tienda" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Ir a la tienda
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              </Link>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <ProductCard p={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ BANNERS ═══════════ */}
      {banners.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {banners.map((b, i) => {
              const inner = (
                <div className="group relative h-56 overflow-hidden rounded-2xl border border-carbon-200 lift">
                  <img src={b.image} alt={b.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-400">Promoción</span>
                    <h3 className="mt-1 text-xl font-bold text-white drop-shadow">{b.title}</h3>
                    {b.subtitle && <p className="mt-1 text-sm text-white/80">{b.subtitle}</p>}
                  </div>
                </div>
              )
              return (
                <Reveal key={i} delay={i * 100}>
                  {b.link ? <Link to={b.link}>{inner}</Link> : inner}
                </Reveal>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══════════ BLOG ═══════════ */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">Consejos y <span className="gradient-text">novedades</span></h2>
            </div>
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Ver blog completo
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
            </Link>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={i * 100}>
                <Link to={`/blog/${p.slug}`} className="group card lift block h-full overflow-hidden">
                  <div className="h-44 overflow-hidden bg-carbon-100">
                    {p.cover ? (
                      <img src={p.cover} alt={p.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-carbon-300"><Icon name="chart" className="h-10 w-10" /></div>
                    )}
                  </div>
                  <div className="p-5">
                    <span className="text-[11px] font-medium text-carbon-400">{p.published_at}</span>
                    <h3 className="mt-2 line-clamp-2 text-base font-bold text-carbon-900 transition group-hover:text-brand-600">{p.title}</h3>
                    {p.excerpt && <p className="mt-2 line-clamp-2 text-sm text-carbon-500">{p.excerpt}</p>}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════ FAQ ═══════════ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal className="text-center">
          <h2 className="text-3xl font-black md:text-4xl">Resolvemos tus <span className="gradient-text">dudas</span></h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <div className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-bold text-carbon-900">{f.q}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className={`shrink-0 text-brand-600 transition ${openFaq === i ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {openFaq === i && (
                  <p className="border-t border-carbon-100 px-5 pb-5 pt-3 text-sm leading-relaxed text-carbon-600 anim-fade-up">
                    {f.a}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="border-t border-carbon-100 bg-carbon-50/70 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">¿Listo para cuidar tu <span className="gradient-text">moto</span>?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-carbon-600">
              Agenda una cita, compra repuestos o crea tu garaje digital en menos de un minuto.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Link
              to="/agendar"
              className="group card lift flex flex-col p-7"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25 transition-transform duration-300 group-hover:scale-110">
                <Icon name="cal" className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-carbon-900">Agendar cita</h3>
              <p className="mt-1.5 text-sm text-carbon-500">Elige el servicio, la fecha y la hora que prefieras.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-brand-600 transition group-hover:text-brand-700">
                Empezar
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              </span>
            </Link>
            <Link
              to="/tienda"
              className="group card lift flex flex-col p-7"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25 transition-transform duration-300 group-hover:scale-110">
                <Icon name="cart" className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-carbon-900">Comprar repuestos</h3>
              <p className="mt-1.5 text-sm text-carbon-500">Paga online o contra entrega, con número de guía.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-brand-600 transition group-hover:text-brand-700">
                Ir a la tienda
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              </span>
            </Link>
            <Link
              to="/registro"
              className="group card lift flex flex-col p-7"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-600/25 transition-transform duration-300 group-hover:scale-110">
                <Icon name="bike" className="h-7 w-7" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-carbon-900">Crear tu garaje</h3>
              <p className="mt-1.5 text-sm text-carbon-500">Registra tu moto y lleva su hoja de vida digital.</p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-brand-600 transition group-hover:text-brand-700">
                Crear cuenta
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              </span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}