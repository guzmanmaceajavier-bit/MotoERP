import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Clock,
  Globe,
  Newspaper,
  Wallet,
  MessageCircle,
  Cloud,
  Scale,
  Plus,
  Trash2,
  Upload,
  ImageIcon,
  Store,
  Wrench,
  DatabaseBackup,
  Download,
  UploadCloud,
  RefreshCw,
  Pencil,
  Phone,
  ChevronDown,
  Check,
  Search,
  ArrowUp,
  ArrowDown,
  Truck,
} from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { SectionHeader } from '../../components/ui'
import { Field, Input, Textarea, Toggle, Select } from '../../components/ui/form'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { COUNTRIES_LIST, getCountry } from '../../lib/countries'
import WebContent from './WebContent'

interface MaintenanceRule {
  id: number
  service_name: string
  interval_km?: number | null
  interval_months?: number | null
}

interface Banner {
  image: string
  title: string
  subtitle?: string
  link?: string
}

interface PaymentOption {
  method: string
  label?: string
  holder?: string
  number?: string
  extra?: string
}

interface HeroText {
  title?: string
  subtitle?: string
}

interface Settings {
  workshop_name: string
  workshop_phone: string
  workshop_address: string
  workshop_logo: string
  workshop_email: string
  workshop_country: string
  social_facebook: string
  social_instagram: string
  social_tiktok: string
  tax_rate: number
  schedule_open: string
  schedule_close: string
  closed_days: number[]
  day_hours: { day: number; open: string; close: string }[]
  holidays: Holiday[]
  banners: Banner[]
  hero_images: Record<string, string[]>
  hero_texts: Record<string, HeroText>
  points_value: number
  payment_options: PaymentOption[]
  payment_instructions: string
  whatsapp_enabled: boolean
  whatsapp_token: string
  whatsapp_phone_id: string
  whatsapp_template: string
  whatsapp_template_lang: string
  cloudinary_configured: boolean
  cloudinary_cloud_name: string
  cloudinary_api_key: string
  maintenance_rules: MaintenanceRule[]
  terms_content: string
  privacy_content: string
  store_shipping_fee: number
  store_free_shipping_threshold: number
}

type Holiday = { date: string; mode?: 'closed' | 'saturday' | 'custom'; open?: string; close?: string }

const TEMPLATE_LANGS = [
  { value: 'es', label: 'Español (es)' },
  { value: 'en', label: 'Inglés (en)' },
  { value: 'pt', label: 'Portugués (pt)' },
  { value: 'fr', label: 'Francés (fr)' },
  { value: 'de', label: 'Alemán (de)' },
  { value: 'it', label: 'Italiano (it)' },
  { value: 'hi', label: 'Hindi (hi)' },
  { value: 'id', label: 'Indonesio (id)' },
]

type Tab = 'identity' | 'hours' | 'web' | 'content' | 'store' | 'payments' | 'whatsapp' | 'cloudinary' | 'maintenance' | 'legal' | 'data'

// Páginas públicas con hero propio. Todas admiten varias imágenes (carrusel).
const HERO_PAGES: { key: string; label: string; multi?: boolean; hint: string }[] = [
  { key: 'home', label: 'Portada (Inicio)', multi: true, hint: 'Varias imágenes rotan como carrusel del hero.' },
  { key: 'about', label: 'Nosotros', multi: true, hint: 'Cabeza de la página /nosotros. Sube varias para un carrusel.' },
  { key: 'services', label: 'Servicios', multi: true, hint: 'Cabeza de la página /servicios. Sube varias para un carrusel.' },
  { key: 'blog', label: 'Blog', multi: true, hint: 'Cabeza de la página /blog. Sube varias para un carrusel.' },
  { key: 'book', label: 'Agendar cita', multi: true, hint: 'Cabeza de la página /agendar. Sube varias para un carrusel.' },
  { key: 'contact', label: 'Contacto', multi: true, hint: 'Cabeza de la página /contacto. Sube varias para un carrusel.' },
  { key: 'track', label: 'Seguimiento de orden', multi: true, hint: 'Cabeza de la página /seguimiento. Sube varias para un carrusel.' },
]

function UploadImage({
  value,
  onChange,
  uploading,
  onUpload,
  label,
}: {
  value: string
  onChange: (url: string) => void
  uploading: boolean
  onUpload: (file: File) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      {label && <span className="mb-1.5 block text-sm font-medium text-carbon-700">{label}</span>}
      <div className="flex items-start gap-3">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-carbon-200 bg-carbon-100">
          {value ? (
            <img src={value} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-carbon-400">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Subiendo...' : value ? 'Reemplazar imagen' : 'Subir imagen'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ''
            }}
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://... o usa el botón de subir"
            variant="brand"
            className="text-xs"
          />
        </div>
      </div>
    </div>
  )
}

function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = getCountry(value)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = COUNTRIES_LIST.filter((c) => `${c.name} ${c.dial}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full min-w-[150px] items-center justify-between gap-2 rounded-xl border border-brand-300 bg-white px-3 py-2 text-sm transition hover:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="truncate">
            <span className="font-bold text-brand-700">+{selected.dial}</span>{' '}
            <span className="text-carbon-700">{selected.name}</span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-carbon-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-carbon-200 bg-white shadow-xl">
          <div className="border-b border-carbon-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar país..." variant="brand" className="pl-8 text-sm" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code)
                  setOpen(false)
                  setQ('')
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                  c.code === value ? 'bg-brand-50 text-brand-700' : 'text-carbon-700 hover:bg-carbon-50'
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="font-semibold text-brand-700">+{c.dial}</span>
                <span className="truncate">{c.name}</span>
                {c.code === value && <Check className="ml-auto h-4 w-4 text-brand-600" />}
              </button>
            ))}
            {filtered.length === 0 && <p className="p-3 text-center text-sm text-carbon-400">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Config() {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (['identity', 'hours', 'web', 'content', 'store', 'payments', 'whatsapp', 'cloudinary', 'maintenance', 'legal', 'data'] as Tab[]).includes(t as Tab)
      ? (t as Tab)
      : 'identity'
  })
  const [data, setData] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  // Identidad
  const [workshopName, setWorkshopName] = useState('')
  const [workshopAddress, setWorkshopAddress] = useState('')
  const [workshopLogo, setWorkshopLogo] = useState('')
  const [workshopCountry, setWorkshopCountry] = useState('CO')
  const [phoneLocal, setPhoneLocal] = useState('')
  const [workshopEmail, setWorkshopEmail] = useState('')
  const [socialFacebook, setSocialFacebook] = useState('')
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialTiktok, setSocialTiktok] = useState('')
  const [taxRate, setTaxRate] = useState('')

  // Horarios
  const [scheduleOpen, setScheduleOpen] = useState('09:00')
  const [scheduleClose, setScheduleClose] = useState('18:00')
  const [saturdayEnabled, setSaturdayEnabled] = useState(true)
  const [saturdayOpen, setSaturdayOpen] = useState('09:00')
  const [saturdayClose, setSaturdayClose] = useState('14:00')
  const [holidays, setHolidays] = useState<Holiday[]>([])

  // Página web
  const [banners, setBanners] = useState<Banner[]>([])
  const [heroImages, setHeroImages] = useState<Record<string, string[]>>({})
  const [heroTexts, setHeroTexts] = useState<Record<string, HeroText>>({})

  // Pagos
  const [pointsValue, setPointsValue] = useState('')
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([])
  const [paymentInstructions, setPaymentInstructions] = useState('')

  // Tienda y envíos
  const [storeShippingFee, setStoreShippingFee] = useState('')
  const [storeFreeShippingThreshold, setStoreFreeShippingThreshold] = useState('')

  // WhatsApp
  const [waEnabled, setWaEnabled] = useState(false)
  const [waToken, setWaToken] = useState('')
  const [waPhoneId, setWaPhoneId] = useState('')
  const [waTemplate, setWaTemplate] = useState('motohub_notification')
  const [waTemplateLang, setWaTemplateLang] = useState('es')

  // Cloudinary
  const [cloudName, setCloudName] = useState('')
  const [cloudKey, setCloudKey] = useState('')
  const [cloudSecret, setCloudSecret] = useState('')

  // Legal
  const [termsContent, setTermsContent] = useState('')
  const [privacyContent, setPrivacyContent] = useState('')

  // Mantenimiento (CRUD)
  const [rules, setRules] = useState<MaintenanceRule[]>([])
  const [ruleModal, setRuleModal] = useState<{ open: boolean; editing: MaintenanceRule | null }>({ open: false, editing: null })
  const [ruleForm, setRuleForm] = useState({ service_name: '', interval_km: '', interval_months: '' })
  const [ruleDelete, setRuleDelete] = useState<MaintenanceRule | null>(null)

  // Datos / respaldo
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const restoreFileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const s = await api<Settings>('/staff/settings')
    setData(s)
    setWorkshopName(s.workshop_name)
    setWorkshopAddress(s.workshop_address)
    setWorkshopLogo(s.workshop_logo)
    setWorkshopCountry(s.workshop_country || 'CO')
    setWorkshopEmail(s.workshop_email || '')
    setSocialFacebook(s.social_facebook || '')
    setSocialInstagram(s.social_instagram || '')
    setSocialTiktok(s.social_tiktok || '')
    setTaxRate(String(s.tax_rate))
    setScheduleOpen(s.schedule_open)
    setScheduleClose(s.schedule_close)
    const satEntry = (s.day_hours || []).find((h) => h.day === 6)
    const satClosed = (s.closed_days || []).includes(6)
    setSaturdayEnabled(!satClosed)
    setSaturdayOpen(satEntry?.open ?? s.schedule_open)
    setSaturdayClose(satEntry?.close ?? s.schedule_close)
    setHolidays(s.holidays || [])
    setBanners(s.banners)
    setHeroImages(s.hero_images || {})
    setHeroTexts(s.hero_texts || {})
    setPointsValue(String(s.points_value))
    setPaymentOptions(s.payment_options || [])
    setPaymentInstructions(s.payment_instructions || '')
    setStoreShippingFee(s.store_shipping_fee != null ? String(s.store_shipping_fee) : '')
    setStoreFreeShippingThreshold(s.store_free_shipping_threshold != null ? String(s.store_free_shipping_threshold) : '')
    setWaEnabled(s.whatsapp_enabled)
    setWaToken(s.whatsapp_token)
    setWaPhoneId(s.whatsapp_phone_id)
    setWaTemplate(s.whatsapp_template || 'motohub_notification')
    setWaTemplateLang(s.whatsapp_template_lang || 'es')
    setCloudName(s.cloudinary_cloud_name)
    setCloudKey(s.cloudinary_api_key)
    setCloudSecret('')
    setTermsContent(s.terms_content || '')
    setPrivacyContent(s.privacy_content || '')
    setRules(s.maintenance_rules || [])
    const country = getCountry(s.workshop_country || 'CO')
    const full = s.workshop_phone || ''
    setPhoneLocal(full.startsWith(country.dial) ? full.slice(country.dial.length) : full)
  }

  useEffect(() => {
    load().catch(() => toast('No se pudieron cargar los ajustes', 'error'))
  }, [])

  async function save(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      await api('/staff/settings', { method: 'POST', body: JSON.stringify(payload) })
      toast('Configuración guardada')
      setCloudSecret('')
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(key: string, file: File, apply: (url: string) => void) {
    setUploadingKey(key)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await api<{ url: string }>('/staff/settings/upload', { method: 'POST', body: fd })
      apply(res.url)
      toast('Imagen subida')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setUploadingKey(null)
    }
  }

  function cleanHolidays(): Holiday[] {
    return holidays
      .map((h) => {
        const date = h.date || ''
        if (!date) return null
        const mode = h.mode || 'closed'
        if (mode === 'closed') return { date, mode: 'closed' }
        if (mode === 'saturday') return { date, mode: 'saturday' }
        return { date, mode: 'custom', open: h.open || '09:00', close: h.close || '14:00' }
      })
      .filter((h): h is Holiday => h !== null)
  }

  function setHoliday(i: number, patch: Partial<Holiday>) {
    setHolidays((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
  }

  function setBanner(i: number, patch: Partial<Banner>) {
    setBanners((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }

  function heroList(key: string): string[] {
    return heroImages[key] ?? []
  }

  function setHeroAt(key: string, index: number, url: string) {
    setHeroImages((prev) => {
      const list = [...(prev[key] ?? [])]
      list[index] = url
      return { ...prev, [key]: list }
    })
  }

  function addHero(key: string) {
    setHeroImages((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ''] }))
  }

  function removeHero(key: string, index: number) {
    setHeroImages((prev) => {
      const list = (prev[key] ?? []).filter((_, i) => i !== index)
      const next = { ...prev }
      if (list.length) next[key] = list
      else delete next[key]
      return next
    })
  }

  function moveHero(key: string, index: number, dir: -1 | 1) {
    setHeroImages((prev) => {
      const list = [...(prev[key] ?? [])]
      const target = index + dir
      if (target < 0 || target >= list.length) return prev
      ;[list[index], list[target]] = [list[target], list[index]]
      return { ...prev, [key]: list }
    })
  }

  function moveBanner(index: number, dir: -1 | 1) {
    setBanners((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function setHeroText(key: string, field: 'title' | 'subtitle', value: string) {
    setHeroTexts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }))
  }

  function buildPhone(): string {
    return (getCountry(workshopCountry).dial + (phoneLocal || '')).replace(/\D/g, '')
  }

  async function openRuleModal(rule: MaintenanceRule | null) {
    setRuleModal({ open: true, editing: rule })
    setRuleForm({
      service_name: rule?.service_name ?? '',
      interval_km: rule?.interval_km != null ? String(rule.interval_km) : '',
      interval_months: rule?.interval_months != null ? String(rule.interval_months) : '',
    })
  }

  async function submitRule() {
    const payload = {
      service_name: ruleForm.service_name.trim(),
      interval_km: ruleForm.interval_km ? Number(ruleForm.interval_km) : null,
      interval_months: ruleForm.interval_months ? Number(ruleForm.interval_months) : null,
    }
    if (!payload.service_name) {
      toast('El nombre del servicio es obligatorio', 'error')
      return
    }
    try {
      if (ruleModal.editing) {
        await api(`/staff/maintenance-rules/${ruleModal.editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast('Regla actualizada')
      } else {
        await api('/staff/maintenance-rules', { method: 'POST', body: JSON.stringify(payload) })
        toast('Regla creada')
      }
      setRuleModal({ open: false, editing: null })
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function confirmDeleteRule() {
    if (!ruleDelete) return
    try {
      await api(`/staff/maintenance-rules/${ruleDelete.id}`, { method: 'DELETE' })
      toast('Regla eliminada')
      setRuleDelete(null)
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function downloadBackup() {
    setBackupBusy(true)
    try {
      const res = await api<{ filename: string; payload: string; generated_at: string }>('/staff/backup')
      const binary = atob(res.payload)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/sql' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(a.href)
      toast('Backup descargado')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBackupBusy(false)
    }
  }

  async function onRestoreFile(file: File) {
    setRestoreBusy(true)
    try {
      const text = await file.text()
      const payload = btoa(unescape(encodeURIComponent(text)))
      await api('/staff/backup/restore', { method: 'POST', body: JSON.stringify({ sql: payload }) })
      toast('Backup restaurado')
      setResetConfirm('')
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setRestoreBusy(false)
    }
  }

  async function confirmReset() {
    try {
      await api('/staff/reset-database', { method: 'POST', body: JSON.stringify({ confirm: 'FORMATEAR' }) })
      toast('Datos formateados')
      setResetOpen(false)
      setResetConfirm('')
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  if (!data) return <div className="p-4 text-carbon-500">Cargando configuración...</div>

  const country = getCountry(workshopCountry)

  const groups: {
    key: string
    label: string
    icon: React.ReactNode
    hint: string
    tabs: { key: Tab; label: string; icon: React.ReactNode }[]
  }[] = [
    {
      key: 'taller',
      label: 'Datos del taller',
      icon: <Building2 className="h-4 w-4" />,
      hint: 'Información del negocio, horarios y textos legales.',
      tabs: [
        { key: 'identity', label: 'Identidad', icon: <Building2 className="h-4 w-4" /> },
        { key: 'hours', label: 'Horarios', icon: <Clock className="h-4 w-4" /> },
        { key: 'legal', label: 'Legal', icon: <Scale className="h-4 w-4" /> },
      ],
    },
    {
      key: 'web',
      label: 'Web y tienda',
      icon: <Globe className="h-4 w-4" />,
      hint: 'Apariencia, contenido y cobros del sitio público.',
      tabs: [
        { key: 'web', label: 'Página web', icon: <Globe className="h-4 w-4" /> },
        { key: 'content', label: 'Contenido web', icon: <Newspaper className="h-4 w-4" /> },
        { key: 'store', label: 'Tienda y envíos', icon: <Truck className="h-4 w-4" /> },
        { key: 'payments', label: 'Pagos', icon: <Wallet className="h-4 w-4" /> },
        { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-4 w-4" /> },
      ],
    },
    {
      key: 'system',
      label: 'Sistema',
      icon: <DatabaseBackup className="h-4 w-4" />,
      hint: 'Almacenamiento, reglas automáticas y respaldos.',
      tabs: [
        { key: 'cloudinary', label: 'Cloudinary', icon: <Cloud className="h-4 w-4" /> },
        { key: 'maintenance', label: 'Mantenimiento', icon: <Wrench className="h-4 w-4" /> },
        { key: 'data', label: 'Datos y respaldo', icon: <DatabaseBackup className="h-4 w-4" /> },
      ],
    },
  ]

  const group = groups.find((g) => g.tabs.some((t) => t.key === tab)) ?? groups[0]

  const btnCls =
    'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition'
  const cardCls = 'rounded-2xl border border-carbon-200 bg-white p-5'
  const addCls =
    'inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50'
  const timeCls = 'rounded-xl border border-brand-300 bg-white px-3 py-2 text-carbon-950 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:bg-carbon-100 disabled:text-carbon-400'

  return (
    <div className="mx-auto max-w-5xl anim-fade-up">
      <SectionHeader
        variant="brand"
        title="Configuración"
        subtitle="Organizada en Taller, Web y tienda, y Sistema. Cada bloque agrupa sus ajustes relacionados."
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={() => setTab(g.tabs[0].key)}
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
              group.key === g.key
                ? 'border-brand-600 bg-brand-50 shadow-sm shadow-brand-600/10'
                : 'border-carbon-200 bg-white hover:border-brand-300 hover:bg-brand-50/50'
            }`}
          >
            <span className={`mt-0.5 shrink-0 ${group.key === g.key ? 'text-brand-600' : 'text-carbon-400'}`}>{g.icon}</span>
            <span className="min-w-0">
              <span className={`block text-sm font-bold ${group.key === g.key ? 'text-brand-700' : 'text-carbon-800'}`}>{g.label}</span>
              <span className="mt-0.5 block text-xs text-carbon-500">{g.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {group.tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.key
                ? 'border-brand-600 bg-brand-600 text-white shadow-md shadow-brand-600/20'
                : 'border-brand-300 bg-white text-carbon-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'identity' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-5`}>
              <p className="text-xs text-carbon-400">
                <strong>Se aplica en:</strong> el nombre y el logo aparecen en el header, footer, WhatsApp flotante y facturas; el país y teléfono se usan para WhatsApp y el botón flotante; el impuesto se suma en facturas y pedidos de la tienda.
              </p>
              <div className="flex flex-wrap gap-6">
                <div className="w-full sm:w-64">
                  <UploadImage
                    label="Logo del taller"
                    value={workshopLogo}
                    onChange={setWorkshopLogo}
                    uploading={uploadingKey === 'logo'}
                    onUpload={(f) => uploadImage('logo', f, setWorkshopLogo)}
                  />
                </div>
                <div className="min-w-0 flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nombre del taller">
                    <Input value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} variant="brand" />
                  </Field>
                  <Field label="Dirección">
                    <Input value={workshopAddress} onChange={(e) => setWorkshopAddress(e.target.value)} variant="brand" />
                  </Field>
                  <Field label="Teléfono / WhatsApp">
                    <div className="flex items-stretch gap-2">
                      <div className="min-w-[150px]">
                        <CountryPicker value={workshopCountry} onChange={setWorkshopCountry} />
                      </div>
                      <Input
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d]/g, ''))}
                        variant="brand"
                        placeholder="Número local (sin prefijo)"
                        className="min-w-0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-carbon-400">
                      Se guardará como +{country.dial} {phoneLocal} y se usará para WhatsApp y el botón flotante.
                    </p>
                  </Field>
                  <Field label="Impuesto % (IVA/IGV)">
                    <Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} variant="brand" />
                  </Field>
                </div>
              </div>
            </div>

            <div className={`${cardCls} space-y-4`}>
              <h2 className="font-semibold text-carbon-900">Contacto público (web y facturas)</h2>
              <p className="-mt-2 text-xs text-carbon-400">Se usan en la página de contacto, el footer y el PDF de la factura.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Correo de contacto">
                  <Input type="email" value={workshopEmail} onChange={(e) => setWorkshopEmail(e.target.value)} variant="brand" placeholder="info@taller.com" />
                </Field>
                <Field label="Facebook (URL)">
                  <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} variant="brand" placeholder="https://facebook.com/..." />
                </Field>
                <Field label="Instagram (URL)">
                  <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} variant="brand" placeholder="https://instagram.com/..." />
                </Field>
                <Field label="TikTok (URL)">
                  <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} variant="brand" placeholder="https://tiktok.com/..." />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({
                  workshop_name: workshopName,
                  workshop_address: workshopAddress,
                  workshop_logo: workshopLogo,
                  workshop_country: workshopCountry,
                  workshop_phone: buildPhone(),
                  workshop_email: workshopEmail,
                  social_facebook: socialFacebook,
                  social_instagram: socialInstagram,
                  social_tiktok: socialTiktok,
                  tax_rate: Number(taxRate) || 0,
                })}
              >
                {saving ? 'Guardando...' : 'Guardar identidad'}
              </button>
            </div>
          </div>
        )}

        {tab === 'hours' && (
          <div className={`${cardCls} space-y-5`}>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-brand-600" />
              <div>
                <h2 className="font-semibold text-carbon-900">Horario general</h2>
                <p className="text-xs text-carbon-400">Se aplica a los días sin horario propio.</p>
              </div>
            </div>
            <p className="text-xs text-carbon-400">
              <strong>Se aplica en:</strong> la página <strong>/agendar</strong> (disponibilidad y tiempo de espera), <strong>/contacto</strong> y la agenda del panel.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Apertura">
                <Input type="time" value={scheduleOpen} onChange={(e) => setScheduleOpen(e.target.value)} variant="brand" />
              </Field>
              <Field label="Cierre">
                <Input type="time" value={scheduleClose} onChange={(e) => setScheduleClose(e.target.value)} variant="brand" />
              </Field>
            </div>

            <div className="space-y-4 rounded-xl border border-carbon-200 p-4">
              <div>
                <span className="block text-sm font-medium text-carbon-700">Sábado</span>
                <p className="text-xs text-carbon-400">Puedes atender los sábados con horas propias (opcional).</p>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-carbon-700">
                    <input
                      type="checkbox"
                      checked={saturdayEnabled}
                      onChange={(e) => setSaturdayEnabled(e.target.checked)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    Atender los sábados
                  </label>
                  <div className={`flex flex-wrap items-end gap-4 ${saturdayEnabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <Field label="Apertura sábado">
                      <Input type="time" value={saturdayOpen} onChange={(e) => setSaturdayOpen(e.target.value)} variant="brand" disabled={!saturdayEnabled} />
                    </Field>
                    <Field label="Cierre sábado">
                      <Input type="time" value={saturdayClose} onChange={(e) => setSaturdayClose(e.target.value)} variant="brand" disabled={!saturdayEnabled} />
                    </Field>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-carbon-50 px-3 py-2 text-xs text-carbon-500">
                <strong>Domingo:</strong> siempre cerrado.
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-carbon-700">Festivos / fechas especiales</span>
              <p className="text-xs text-carbon-400">Define cómo atiendes en días festivos: cerrado, con horario de sábado o con horario propio.</p>
              <div className="mt-1 space-y-1.5">
                {holidays.map((h, i) => {
                  const mode = h.mode || 'closed'
                  const showHours = mode === 'custom'
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="date" value={h.date} onChange={(e) => setHoliday(i, { date: e.target.value })} className={timeCls} />
                      <select value={mode} onChange={(e) => setHoliday(i, { mode: e.target.value as Holiday['mode'] })} className={timeCls}>
                        <option value="closed">Cerrado</option>
                        <option value="saturday">Como sábado</option>
                        <option value="custom">Horario propio</option>
                      </select>
                      {showHours && (
                        <>
                          <input type="time" value={h.open ?? ''} onChange={(e) => setHoliday(i, { open: e.target.value })} className={timeCls} placeholder="abre" />
                          <span className="text-carbon-400">a</span>
                          <input type="time" value={h.close ?? ''} onChange={(e) => setHoliday(i, { close: e.target.value })} className={timeCls} placeholder="cierra" />
                        </>
                      )}
                      <button type="button" onClick={() => setHolidays((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )
                })}
                <button type="button" onClick={() => setHolidays((prev) => [...prev, { date: '', mode: 'closed' }])} className={addCls}>
                  <Plus className="h-4 w-4" /> Agregar festivo
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({
                  schedule_open: scheduleOpen,
                  schedule_close: scheduleClose,
                  closed_days: saturdayEnabled ? [] : [6],
                  day_hours: saturdayEnabled ? [{ day: 6, open: saturdayOpen, close: saturdayClose }] : [],
                  holidays: cleanHolidays(),
                })}
              >
                {saving ? 'Guardando...' : 'Guardar horarios'}
              </button>
            </div>
          </div>
        )}

        {tab === 'web' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-5`}>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="font-semibold text-carbon-900">Imágenes y textos de los heroes (portada web)</h2>
                  <p className="text-xs text-carbon-400">
                    Cada página pública usa su propia imagen de cabecera con su título y descripción. Déjalos vacíos para usar los textos por defecto.
                  </p>
                </div>
              </div>
              {HERO_PAGES.map((page) => (
                <div key={page.key} className="rounded-xl border border-carbon-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-carbon-900">{page.label}</span>
                      <p className="text-xs text-carbon-400">{page.hint}</p>
                    </div>
                    {page.multi && (
                      <button type="button" onClick={() => addHero(page.key)} className={addCls}>
                        <Plus className="h-4 w-4" /> Slide
                      </button>
                    )}
                  </div>
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Título del hero" hint="ej: Tu taller de motos, digital y transparente">
                      <Input value={heroTexts[page.key]?.title ?? ''} onChange={(e) => setHeroText(page.key, 'title', e.target.value)} variant="brand" />
                    </Field>
                    <Field label="Descripción del hero" hint="ej: Gestiona el mantenimiento de tu moto...">
                      <Input value={heroTexts[page.key]?.subtitle ?? ''} onChange={(e) => setHeroText(page.key, 'subtitle', e.target.value)} variant="brand" />
                    </Field>
                  </div>
                  <div className="space-y-3">
                    {heroList(page.key).map((url, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <UploadImage
                            value={url}
                            onChange={(u) => setHeroAt(page.key, i, u)}
                            uploading={uploadingKey === `${page.key}-${i}`}
                            onUpload={(f) => uploadImage(`${page.key}-${i}`, f, (u) => setHeroAt(page.key, i, u))}
                          />
                        </div>
                        <div className="mt-16 flex shrink-0 flex-col gap-1">
                          {page.multi && (
                            <>
                              <button type="button" onClick={() => moveHero(page.key, i, -1)} disabled={i === 0} className="rounded-md p-1 text-carbon-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" title="Subir">
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => moveHero(page.key, i, 1)} disabled={i === heroList(page.key).length - 1} className="rounded-md p-1 text-carbon-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" title="Bajar">
                                <ArrowDown className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeHero(page.key, i)}
                            className="rounded-md p-1 text-red-500 hover:bg-red-50"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {heroList(page.key).length === 0 && (
                      <button type="button" onClick={() => addHero(page.key)} className={addCls}>
                        <Plus className="h-4 w-4" /> {page.multi ? 'Agregar primera imagen' : 'Subir imagen de esta página'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={`${cardCls} space-y-4`}>
              <h2 className="font-semibold text-carbon-900">Banners promocionales (portada web)</h2>
              <p className="-mt-2 text-xs text-carbon-400">Imagen, título, subtítulo y enlace opcional. Aparecen en la sección inferior de la portada.</p>
              <div className="space-y-3">
                {banners.map((b, i) => (
                  <div key={i} className="rounded-xl border border-carbon-200 p-4">
                    <div className="mb-3 flex items-center justify-end gap-1">
                      <button type="button" onClick={() => moveBanner(i, -1)} disabled={i === 0} className="rounded-md p-1 text-carbon-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" title="Subir">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => moveBanner(i, 1)} disabled={i === banners.length - 1} className="rounded-md p-1 text-carbon-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30" title="Bajar">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setBanners((prev) => prev.filter((_, idx) => idx !== i))} className="rounded-md p-1 text-red-500 hover:bg-red-50" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      <UploadImage
                        label="Imagen"
                        value={b.image}
                        onChange={(u) => setBanner(i, { image: u })}
                        uploading={uploadingKey === `banner-${i}`}
                        onUpload={(f) => uploadImage(`banner-${i}`, f, (u) => setBanner(i, { image: u }))}
                      />
                      <div className="space-y-4">
                        <Field label="Título">
                          <Input value={b.title} onChange={(e) => setBanner(i, { title: e.target.value })} variant="brand" />
                        </Field>
                        <Field label="Subtítulo">
                          <Input value={b.subtitle ?? ''} onChange={(e) => setBanner(i, { subtitle: e.target.value })} variant="brand" />
                        </Field>
                      </div>
                      <div className="space-y-4">
                        <Field label="Enlace" hint="opcional">
                          <Input value={b.link ?? ''} onChange={(e) => setBanner(i, { link: e.target.value })} variant="brand" placeholder="/tienda" />
                        </Field>
                        <div className="pt-6" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setBanners((prev) => [...prev, { image: '', title: '' }])} className={addCls}>
                  <Plus className="h-4 w-4" /> Agregar banner
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({ banners, hero_images: heroImages, hero_texts: heroTexts })}
              >
                {saving ? 'Guardando...' : 'Guardar página web'}
              </button>
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div className={`${cardCls} p-0`}>
            <div className="border-b border-carbon-200 p-5">
              <h3 className="text-sm font-bold text-carbon-900">Contenido de la página web pública</h3>
              <p className="mt-1 text-xs text-carbon-500">Todo lo que edites aquí se publica automáticamente en el sitio: blog, reseñas y mensajes.</p>
            </div>
            <div className="p-5">
              <WebContent />
            </div>
          </div>
        )}

        {tab === 'store' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-5`}>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="font-semibold text-carbon-900">Tienda online y envíos</h2>
                  <p className="text-xs text-carbon-400">
                    Estos valores se aplican en el <strong>carrito</strong> (paso de entrega) y al confirmar el pedido. Si el pedido supera el umbral, el envío a domicilio es gratis.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Costo de envío a domicilio" hint="se cobra solo si el pedido no alcanza el envío gratis">
                  <Input type="number" min={0} value={storeShippingFee} onChange={(e) => setStoreShippingFee(e.target.value)} variant="brand" placeholder="12000" />
                </Field>
                <Field label="Envío gratis desde" hint="monto mínimo del subtotal para envío gratis">
                  <Input type="number" min={0} value={storeFreeShippingThreshold} onChange={(e) => setStoreFreeShippingThreshold(e.target.value)} variant="brand" placeholder="150000" />
                </Field>
              </div>
              <p className="text-xs text-carbon-400">
                Se usa en: <strong>carrito y checkout</strong> de la tienda (progreso de envío gratis) y en el <strong>cálculo del pedido</strong> en el servidor.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({
                  store_shipping_fee: Number(storeShippingFee) || 0,
                  store_free_shipping_threshold: Number(storeFreeShippingThreshold) || 0,
                })}
              >
                {saving ? 'Guardando...' : 'Guardar tienda y envíos'}
              </button>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className={`${cardCls} space-y-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Valor de puntos" hint="cada punto equivale a este valor al canjear (moneda local)">
                <Input type="number" min={1} value={pointsValue} onChange={(e) => setPointsValue(e.target.value)} variant="brand" />
              </Field>
            </div>
            <p className="text-xs text-carbon-400">
              Se usa en: <strong>carrito y checkout</strong> (canjeo de puntos) y en el <strong>portal del cliente</strong> (saldo y canje).
            </p>

            <div>
              <span className="block text-sm font-medium text-carbon-700">Métodos de pago (tienda online)</span>
              <p className="text-xs text-carbon-400">Se muestran al cliente en el paso de pago del carrito y cuando sube su comprobante (Nequi, banco, etc.).</p>
              <div className="mt-3 space-y-2">
                {paymentOptions.map((pay, i) => (
                  <div key={i} className="rounded-xl border border-carbon-200 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Método *" hint="cómo lo identifica el cliente (ej. Nequi, Bancolombia, Daviplata)">
                        <Input value={pay.method} onChange={(e) => setPaymentOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, method: e.target.value } : x)))} placeholder="Nequi" variant="brand" />
                      </Field>
                      <Field label="Etiqueta corta" hint="nombre breve que se ve en negrita; vacío = usa el método">
                        <Input value={pay.label ?? ''} onChange={(e) => setPaymentOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Nequi" variant="brand" />
                      </Field>
                      <Field label="Titular" hint="a nombre de quién (opcional)">
                        <Input value={pay.holder ?? ''} onChange={(e) => setPaymentOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, holder: e.target.value } : x)))} placeholder="Juan Pérez" variant="brand" />
                      </Field>
                      <Field label="Número" hint="cuenta/celular para pagar; se muestra con botón Copiar">
                        <Input value={pay.number ?? ''} onChange={(e) => setPaymentOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, number: e.target.value } : x)))} placeholder="3100000000" variant="brand" />
                      </Field>
                      <Field label="Nota (opcional)" hint="texto gris adicional, ej. 'Solo hasta las 6 pm'">
                        <Input value={pay.extra ?? ''} onChange={(e) => setPaymentOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, extra: e.target.value } : x)))} placeholder="Ej. Indica tu cédula como referencia" variant="brand" />
                      </Field>
                      <button type="button" onClick={() => setPaymentOptions((prev) => prev.filter((_, idx) => idx !== i))} className="justify-self-start self-end text-sm text-red-500 hover:text-red-700">
                        <Trash2 className="mr-1 inline h-4 w-4" /> Eliminar
                      </button>
                    </div>
                    <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 px-3 py-2">
                      <p className="text-xs font-semibold text-brand-700">Así lo ve el cliente en el carrito:</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm">
                        <span className="font-bold text-brand-700">{pay.label?.trim() || pay.method || 'Método'}</span>
                        {pay.holder?.trim() && <span className="text-carbon-600">{pay.holder}</span>}
                        <span className="font-mono text-carbon-900">{pay.number || '—'}</span>
                        {pay.extra?.trim() && <span className="text-xs text-carbon-500">{pay.extra}</span>}
                        <button type="button" className="ml-auto rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white">Copiar</button>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setPaymentOptions((prev) => [...prev, { method: '', holder: '', number: '' }])} className={addCls}>
                  <Plus className="h-4 w-4" /> Agregar método de pago
                </button>
              </div>
            </div>

            <Field label="Instrucciones de pago" hint="se muestran al cliente">
              <Textarea rows={3} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} variant="brand" placeholder="Ej: Realiza la transferencia y luego sube el comprobante en Mis Pedidos." />
            </Field>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({
                  points_value: Number(pointsValue) || 0,
                  payment_options: paymentOptions,
                  payment_instructions: paymentInstructions,
                })}
              >
                {saving ? 'Guardando...' : 'Guardar pagos'}
              </button>
            </div>
          </div>
        )}

        {tab === 'whatsapp' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-carbon-900">Envío automático por WhatsApp</h2>
                  <p className="text-xs text-carbon-400">Activa el envío de mensajes al WhatsApp del cliente.</p>
                </div>
                <Toggle checked={waEnabled} onChange={setWaEnabled} />
              </div>
            </div>

            <div className={`${cardCls} space-y-4`}>
              <h2 className="font-semibold text-carbon-900">Credenciales de Meta Cloud API</h2>
              <p className="-mt-2 text-xs text-carbon-400">
                Se obtienen en <strong>Meta Business Suite → WhatsApp → Configuración de API</strong>.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Access token">
                  <Input value={waToken} onChange={(e) => setWaToken(e.target.value)} variant="brand" placeholder="EAAG..." />
                </Field>
                <Field label="Phone ID">
                  <Input value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} variant="brand" placeholder="1234567890" />
                </Field>
              </div>
            </div>

            <div className={`${cardCls} space-y-4`}>
              <h2 className="font-semibold text-carbon-900">Plantilla para códigos</h2>
              <p className="-mt-2 text-xs text-carbon-400">
                La plantilla debe tener <strong>una variable en el cuerpo</strong> (p. ej. «Tu código es {'{{1}}'}»).
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre de la plantilla">
                  <Input value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} variant="brand" placeholder="motohub_otp" />
                </Field>
                <Field label="Idioma de la plantilla">
                  <Select value={waTemplateLang} onChange={(e) => setWaTemplateLang(e.target.value)} variant="brand">
                    {TEMPLATE_LANGS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({
                  whatsapp_enabled: waEnabled,
                  whatsapp_token: waToken,
                  whatsapp_phone_id: waPhoneId,
                  whatsapp_template: waTemplate,
                  whatsapp_template_lang: waTemplateLang,
                })}
              >
                {saving ? 'Guardando...' : 'Guardar WhatsApp'}
              </button>
            </div>
          </div>
        )}

        {tab === 'cloudinary' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-carbon-900">Cloudinary (almacenamiento de imágenes)</h2>
                  <p className="mt-1 text-xs text-carbon-400">
                    Las imágenes que subes (productos, equipo, logo, heroes, banners) se guardan en tu nube Cloudinary y solo se guarda su URL en la base de datos.
                  </p>
                </div>
                {data.cloudinary_configured ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                    <Check className="h-3.5 w-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                    <Cloud className="h-3.5 w-3.5" /> Sin configurar
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-carbon-500">
                <span className="font-semibold text-carbon-700">Carpetas que se usan:</span>
                {['site', 'products', 'staff', 'motorcycles', 'client-profile', 'catalog'].map((f) => (
                  <span key={f} className="rounded-md border border-carbon-200 bg-carbon-50 px-2 py-0.5 font-mono text-carbon-600">{f}</span>
                ))}
              </div>
              <p className="text-xs text-carbon-400">
                Las credenciales del archivo <strong>.env</strong> del servidor tienen prioridad sobre estas. Si dejas <strong>API secret</strong> vacío, se conservan el cloud name y la API key actuales.
              </p>
            </div>

            <div className={`${cardCls} space-y-4`}>
              <h2 className="font-semibold text-carbon-900">Credenciales</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Cloud name">
                  <Input value={cloudName} onChange={(e) => setCloudName(e.target.value)} variant="brand" placeholder="tu-nube" />
                </Field>
                <Field label="API key">
                  <Input value={cloudKey} onChange={(e) => setCloudKey(e.target.value)} variant="brand" placeholder="123456789012345" />
                </Field>
                <Field label="API secret">
                  <Input type="password" value={cloudSecret} onChange={(e) => setCloudSecret(e.target.value)} variant="brand" placeholder="••••••••" />
                </Field>
              </div>
              <div className="flex justify-end">
                <button
                  className={btnCls}
                  disabled={saving}
                  onClick={() => save({
                    cloudinary_cloud_name: cloudName,
                    cloudinary_api_key: cloudKey,
                    cloudinary_api_secret: cloudSecret,
                  })}
                >
                  {saving ? 'Guardando...' : 'Guardar Cloudinary'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'maintenance' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-carbon-900">Reglas de mantenimiento predictivo</h2>
                  <p className="mt-1 text-sm text-carbon-500">
                    Estas reglas generan <strong>alertas automáticas</strong> en el panel del taller cuando una moto del cliente
                    alcanza el intervalo de <strong>kilometraje</strong> o de <strong>meses</strong> desde su último servicio.
                    Son útiles para avisarle al cliente cuándo le toca su próximo mantenimiento.
                  </p>
                </div>
                <button type="button" onClick={() => openRuleModal(null)} className={btnCls}>
                  <Plus className="h-4 w-4" /> Nueva regla
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-carbon-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-carbon-200 bg-carbon-50/60 text-carbon-500">
                    <tr>
                      <th className="px-4 py-2.5">Servicio</th>
                      <th className="px-4 py-2.5">Intervalo (km)</th>
                      <th className="px-4 py-2.5">Intervalo (meses)</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id} className="border-b border-carbon-100 last:border-b-0">
                        <td className="px-4 py-2.5 font-medium text-carbon-900">{r.service_name}</td>
                        <td className="px-4 py-2.5 text-carbon-600">{r.interval_km ? `${r.interval_km} km` : '—'}</td>
                        <td className="px-4 py-2.5 text-carbon-600">{r.interval_months ? `${r.interval_months} meses` : '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => openRuleModal(r)} className="rounded-lg p-1.5 text-carbon-500 hover:bg-brand-50 hover:text-brand-700" title="Editar">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setRuleDelete(r)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rules.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-carbon-400">Sin reglas definidas. Crea la primera con «Nueva regla».</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'legal' && (
          <div className={`${cardCls} space-y-5`}>
            <h2 className="font-semibold text-carbon-900">Políticas legales</h2>
            <p className="-mt-2 text-xs text-carbon-400">Se muestran en las páginas públicas de /privacidad y /terminos del portal.</p>
            <Field label="Términos y condiciones">
              <Textarea rows={7} value={termsContent} onChange={(e) => setTermsContent(e.target.value)} variant="brand" placeholder="Escribe aquí los términos y condiciones... Puedes usar # para encabezados y deja líneas en blanco entre secciones." />
            </Field>
            <Field label="Política de privacidad">
              <Textarea rows={7} value={privacyContent} onChange={(e) => setPrivacyContent(e.target.value)} variant="brand" placeholder="Escribe aquí la política de privacidad..." />
            </Field>
            <div className="flex justify-end">
              <button
                className={btnCls}
                disabled={saving}
                onClick={() => save({ terms_content: termsContent, privacy_content: privacyContent })}
              >
                {saving ? 'Guardando...' : 'Guardar legal'}
              </button>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-5">
            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="font-semibold text-carbon-900">Descargar respaldo</h2>
                  <p className="text-xs text-carbon-400">Genera una copia completa de la base de datos en SQL para guardarla o moverla.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button className={btnCls} disabled={backupBusy} onClick={downloadBackup}>
                  <Download className="h-4 w-4" />
                  {backupBusy ? 'Generando...' : 'Descargar backup (.sql)'}
                </button>
              </div>
            </div>

            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="font-semibold text-carbon-900">Restaurar respaldo</h2>
                  <p className="text-xs text-carbon-400">Sube un archivo .sql generado aquí para reemplazar los datos actuales.</p>
                </div>
              </div>
              <input
                ref={restoreFileRef}
                type="file"
                accept=".sql,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onRestoreFile(f)
                  e.target.value = ''
                }}
              />
              <div className="flex justify-end">
                <button className={btnCls} disabled={restoreBusy} onClick={() => restoreFileRef.current?.click()}>
                  <UploadCloud className="h-4 w-4" />
                  {restoreBusy ? 'Restaurando...' : 'Subir y restaurar'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-red-600" />
                <div>
                  <h2 className="font-semibold text-red-700">Zona de peligro</h2>
                  <p className="text-xs text-red-500">Reinicia todos los datos del taller (ventas, compras, inventario, clientes). Se conservan usuarios y configuración.</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => setResetOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                  <RefreshCw className="h-4 w-4" /> Formatear datos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={ruleModal.open}
        onClose={() => setRuleModal({ open: false, editing: null })}
        title={ruleModal.editing ? 'Editar regla de mantenimiento' : 'Nueva regla de mantenimiento'}
        subtitle="Define cuándo se debe generar la alerta para este servicio."
        variant="brand"
        footer={
          <>
            <button onClick={() => setRuleModal({ open: false, editing: null })} className="btn-ghost !text-sm">Cancelar</button>
            <button onClick={submitRule} className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              {ruleModal.editing ? 'Guardar cambios' : 'Crear regla'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Servicio" hint="ej: Cambio de aceite">
            <Input value={ruleForm.service_name} onChange={(e) => setRuleForm((f) => ({ ...f, service_name: e.target.value }))} variant="brand" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Intervalo (km)" hint="dejar vacío si es por meses">
              <Input type="number" min={0} value={ruleForm.interval_km} onChange={(e) => setRuleForm((f) => ({ ...f, interval_km: e.target.value }))} variant="brand" placeholder="5000" />
            </Field>
            <Field label="Intervalo (meses)" hint="dejar vacío si es por km">
              <Input type="number" min={0} value={ruleForm.interval_months} onChange={(e) => setRuleForm((f) => ({ ...f, interval_months: e.target.value }))} variant="brand" placeholder="6" />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!ruleDelete}
        onClose={() => setRuleDelete(null)}
        onConfirm={confirmDeleteRule}
        title="Eliminar regla"
        message={`¿Seguro que quieres eliminar la regla «${ruleDelete?.service_name ?? ''}»? Se dejarán de generar sus alertas.`}
        confirmLabel="Eliminar"
      />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Formatear datos"
        subtitle="Esta acción no se puede deshacer. Conserva usuarios y configuración."
        variant="brand"
        footer={
          <>
            <button onClick={() => setResetOpen(false)} className="btn-ghost !text-sm">Cancelar</button>
            <button
              onClick={confirmReset}
              disabled={resetConfirm !== 'FORMATEAR'}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              Formatear todo
            </button>
          </>
        }
      >
        <p className="text-sm text-carbon-600">
          Para confirmar, escribe <strong>FORMATEAR</strong> en el campo de abajo.
        </p>
        <Input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} variant="brand" className="mt-3" placeholder="FORMATEAR" />
      </Modal>
    </div>
  )
}
