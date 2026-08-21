import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Badge, Card, EmptyState } from '../components/ui'
import BackLink from '../components/BackLink'
import type { MotorcycleHistory } from '../lib/types'

const statusTone: Record<string, string> = {
  pending: 'amber',
  in_progress: 'blue',
  awaiting_approval: 'brand',
  approved: 'green',
  completed: 'green',
  rejected: 'red',
  cancelled: 'gray',
  delivered: 'dark',
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  awaiting_approval: 'Por aprobar',
  approved: 'Aprobado',
  completed: 'Completado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  delivered: 'Entregado',
}

const fmt = (n: number) => '$' + n.toLocaleString('es-CO')

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=700&fit=crop'

type Tab = 'resumen' | 'servicios' | 'documentos'

export default function MotorcycleHistoryPage() {
  const { id } = useParams()
  const [data, setData] = useState<MotorcycleHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('resumen')

  useEffect(() => {
    ;(async () => {
      try {
        setData(await api<MotorcycleHistory>(`/motorcycles/${id}/history`))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-carbon-200 dark:bg-carbon-200/60" />
        <div className="mt-4 h-72 animate-pulse rounded-2xl bg-carbon-200 dark:bg-carbon-200/60" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-carbon-200 dark:bg-carbon-200/60" />)}
        </div>
      </div>
    )
  }
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!data) return null

  const m = data.motorcycle
  const brandName = m.brand?.name || 'Marca'
  const modelName = m.model?.name || ''
  const title = m.nickname || `${brandName}${modelName ? ' ' + modelName : ''}`.trim() || 'Moto sin nombre'
  const registered = m.registered_at
    ? new Date(m.registered_at + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="mx-auto max-w-5xl anim-fade-up">
      <BackLink to="/panel/garaje">Volver a Mi Garaje</BackLink>

      {/* Hero card */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
        <div className="relative h-64 overflow-hidden bg-carbon-100 sm:h-72">
          <img src={m.photo || PLACEHOLDER_IMG} alt={title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold text-white drop-shadow sm:text-3xl">{title}</h1>
              <p className="truncate text-sm font-medium text-white/85">
                {brandName}{modelName ? ` · ${modelName}` : ''}{m.year ? ` · ${m.year}` : ''}
              </p>
              {registered && <p className="mt-1 text-xs text-white/65">Registrada el {registered}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {m.plate && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-black/40 px-3 py-1.5 text-sm font-bold tracking-wider text-white backdrop-blur-sm">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4zM2 8h13l4 8" /></svg>
                  {m.plate}
                </span>
              )}
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-carbon-800 backdrop-blur-sm">
                {data.odometer.toLocaleString('es-CO')} km
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:gap-4 sm:p-5">
          <Stat label="Color" value={m.color || '—'} icon={<ColorIcon />} />
          <Stat label="VIN / Chasis" value={m.vin || '—'} mono icon={<VinIcon />} />
          <Stat label="Estado" value="Activa" icon={<StatusIcon />} />
          <Stat label="Año" value={m.year ? String(m.year) : '—'} icon={<YearIcon />} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto mt-6 flex max-w-md items-center gap-1 rounded-2xl border border-carbon-200 bg-white p-1.5 shadow-sm dark:border-carbon-200 dark:bg-carbon-100">
        {([
          ['resumen', 'Mantenimientos', data.maintenances.length],
          ['servicios', 'Servicios', data.services.length],
          ['documentos', 'Documentos', data.warranties.length + data.invoices.length],
        ] as [Tab, string, number][]).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
              tab === key
                ? 'bg-brand-600 text-white shadow'
                : 'text-carbon-500 hover:bg-carbon-100 hover:text-carbon-800 dark:hover:bg-carbon-200 dark:hover:text-carbon-600'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-xs ${tab === key ? 'text-white/70' : 'text-carbon-400'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
      <div>
      {/* Maintenance */}
      <Section title="Próximos mantenimientos" count={data.maintenances.length}>
        {data.maintenances.length === 0 ? (
          <Card className="p-6 text-center text-carbon-500">Sin reglas de mantenimiento configuradas.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.maintenances.map((mt, idx) => (
              <Card
                key={idx}
                className={`p-4 ${
                  mt.urgency === 'overdue' ? 'border-red-300 bg-red-50/60 dark:bg-red-500/10' :
                  mt.urgency === 'soon' ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-500/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      mt.urgency === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                      mt.urgency === 'soon' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' :
                      'bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                    }`}>
                      <ToolIcon />
                    </span>
                    <p className="font-semibold leading-tight text-carbon-900 dark:text-carbon-700">{mt.service_name}</p>
                  </div>
                  <Badge tone={mt.urgency === 'overdue' ? 'red' : mt.urgency === 'soon' ? 'amber' : 'green'}>
                    {mt.urgency === 'overdue' ? 'Vencido' : mt.urgency === 'soon' ? 'Próximo' : 'Al día'}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-sm text-carbon-600 dark:text-carbon-500">
                  {mt.due_km != null && (
                    <p>
                      Faltan <strong className="text-carbon-900 dark:text-carbon-700">{mt.km_left?.toLocaleString('es-CO')} km</strong>
                      {' '}(límite {mt.due_km.toLocaleString('es-CO')} km)
                    </p>
                  )}
                  {mt.due_date && (
                    <p>
                      {mt.days_left != null && mt.days_left > 0 ? `Quedan ${mt.days_left} días` : mt.days_left != null && mt.days_left <= 0 ? 'Fecha vencida' : ''}
                      {mt.due_date ? ` · para el ${mt.due_date}` : ''}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Extras */}
      {(m.accessories?.length || m.documentation) ? (
        <Section title="Accesorios y documentación">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {m.accessories?.length ? (
              <Card className="p-5">
                <SectionMiniTitle icon={<AccessoryIcon />}>Accesorios instalados</SectionMiniTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.accessories.map((a, idx) => (
                    <span key={idx} className="chip bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{a}</span>
                  ))}
                </div>
              </Card>
            ) : null}
            {m.documentation ? (
              <Card className="p-5">
                <SectionMiniTitle icon={<DocIcon />}>Documentación</SectionMiniTitle>
                <p className="mt-3 whitespace-pre-line text-sm text-carbon-600 dark:text-carbon-500">{m.documentation}</p>
              </Card>
            ) : null}
          </div>
        </Section>
      ) : null}
      </div>
      )}

      {tab === 'servicios' && (
      <div className="mt-6">
      {/* Services */}
      <Section title="Historial de servicios" count={data.services.length}>
        {data.services.length === 0 ? (
          <EmptyState title="Esta moto aún no tiene servicios" subtitle="Cuando agendes un servicio aparecerá aquí su historial." />
        ) : (
          <div className="space-y-3">
            {data.services.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-carbon-900 text-white dark:bg-carbon-700">
                      <WrenchIcon />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-carbon-900 dark:text-carbon-700">{s.order_number}</p>
                        <Badge tone={statusTone[s.status] ?? 'gray'}>{statusLabel[s.status] ?? s.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-carbon-500">
                        {s.service_type || 'Servicio'}
                        {s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        {s.odometer_in != null ? ` · ${s.odometer_in.toLocaleString('es-CO')} km` : ''}
                      </p>
                    </div>
                  </div>
                  {s.total > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-carbon-400">Total</p>
                      <p className="text-lg font-extrabold text-carbon-900 dark:text-carbon-700">{fmt(s.total)}</p>
                    </div>
                  )}
                </div>

                {s.diagnosis && (
                  <div className="mt-4 rounded-xl bg-carbon-50 px-4 py-3 text-sm text-carbon-600 dark:bg-carbon-200/40 dark:text-carbon-500">
                    <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-carbon-400">Diagnóstico</p>
                    {s.diagnosis}
                  </div>
                )}

                {s.mechanic && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-carbon-500">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Mecánico: {s.mechanic}
                  </p>
                )}

                {s.items.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-carbon-200 dark:border-carbon-200">
                    <div className="flex items-center gap-1.5 bg-carbon-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-carbon-500 dark:bg-carbon-200/50">
                      <PartsIcon /> Repuestos utilizados
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {s.items.map((it, idx) => (
                          <tr key={idx} className="border-t border-carbon-200 dark:border-carbon-200">
                            <td className="px-4 py-2 text-carbon-700 dark:text-carbon-600">{it.description}</td>
                            <td className="px-4 py-2 text-right text-carbon-500">×{it.quantity}</td>
                            <td className="px-4 py-2 text-right font-medium text-carbon-900 dark:text-carbon-700">{fmt(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s.labors.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-carbon-200 dark:border-carbon-200">
                    <div className="flex items-center gap-1.5 bg-carbon-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-carbon-500 dark:bg-carbon-200/50">
                      <LaborIcon /> Mano de obra
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {s.labors.map((l, idx) => (
                          <tr key={idx} className="border-t border-carbon-200 dark:border-carbon-200">
                            <td className="px-4 py-2 text-carbon-700 dark:text-carbon-600">{l.description}</td>
                            <td className="px-4 py-2 text-right text-carbon-500">{l.hours} h</td>
                            <td className="px-4 py-2 text-right font-medium text-carbon-900 dark:text-carbon-700">{fmt(l.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s.photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {s.photos.map((p) => (
                      <img key={p.id} src={p.url} alt={p.caption || 'Foto del servicio'} className="h-20 w-full rounded-lg object-cover" />
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-carbon-100 pt-3 dark:border-carbon-200">
                  <Link to={`/panel/servicios/${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Ver detalle de la orden
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6l6 6-6 6" /></svg>
                  </Link>
                  {s.estimated_delivery && (
                    <span className="ml-auto text-xs text-carbon-500">Entrega estimada: {s.estimated_delivery}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
      </div>
      )}

      {tab === 'documentos' && (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Warranties + invoices */}
        <Section title="Garantías" count={data.warranties.length}>
          {data.warranties.length === 0 ? (
            <Card className="p-6 text-center text-carbon-500">Sin garantías registradas para esta moto.</Card>
          ) : (
            <div className="space-y-3">
              {data.warranties.map((w) => (
                <Card key={w.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <ShieldIcon />
                      </span>
                      <p className="font-semibold text-carbon-900 dark:text-carbon-700">{w.description}</p>
                    </div>
                    <Badge tone={w.status === 'active' ? 'green' : 'gray'}>{w.status === 'active' ? 'Activa' : w.status}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-carbon-500">
                    {w.type === 'km' ? `Vigencia: ${w.duration.toLocaleString('es-CO')} km` : `Vence: ${w.end_date}`}
                    {w.start_date ? ` (desde ${w.start_date})` : ''}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section title="Facturas" count={data.invoices.length}>
          {data.invoices.length === 0 ? (
            <Card className="p-6 text-center text-carbon-500">Sin facturas vinculadas a esta moto.</Card>
          ) : (
            <div className="space-y-3">
              {data.invoices.map((inv) => (
                <Card key={inv.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      <ReceiptIcon />
                    </span>
                    <div>
                      <p className="font-semibold text-carbon-900 dark:text-carbon-700">{inv.invoice_number}</p>
                      <p className="text-xs text-carbon-500">{inv.issue_date}</p>
                    </div>
                  </div>
                  <span className="text-lg font-extrabold text-carbon-900 dark:text-carbon-700">{fmt(inv.total)}</span>
                </Card>
              ))}
            </div>
          )}
        </Section>
      </div>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-bold text-carbon-900 dark:text-carbon-700">{title}</h2>
        {count != null && count > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function SectionMiniTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-bold text-carbon-900 dark:text-carbon-700">
      <span className="text-brand-600">{icon}</span>
      {children}
    </h3>
  )
}

function Stat({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-carbon-50 px-4 py-3 dark:bg-carbon-200/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-carbon-100 dark:text-brand-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-carbon-400">{label}</p>
        <p className={`truncate font-bold text-carbon-900 dark:text-carbon-700 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
      </div>
    </div>
  )
}

function ToolIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
}
function WrenchIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}
function ReceiptIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12a1 1 0 011 1v18l-3-2-2 2-2-2-2 2-2-2-3 2V3a1 1 0 011-1z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
}
function PartsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" /></svg>
}
function LaborIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l2 2m6-2a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
}
function AccessoryIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
}
function DocIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" /><path d="M14 2v4h4M9 13h6M9 17h4" /></svg>
}
function ColorIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 110-20 7 7 0 010 14h-1.5a2 2 0 00-1.5 3.3A1.7 1.7 0 0012 22z" /></svg>
}
function VinIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h6M4 8v8M6 8v8M2 16h8M16 8h6M18 8v8M20 8v8M16 16h8" /></svg>
}
function StatusIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
}
function YearIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
}