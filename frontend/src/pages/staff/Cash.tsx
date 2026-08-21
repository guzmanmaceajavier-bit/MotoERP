import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, ArrowLeftRight, Wallet, TrendingUp, AlertCircle, Plus, CheckCircle2, Download, Pencil, Trash2, Coffee, Lock, Search, History } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import { fmtMoney } from '../../lib/money'
import { useToast } from '../../lib/toast'
import { useRefetchOnFocus } from '../../lib/useRefetch'
import { Badge, SectionHeader, StatCard } from '../../components/ui'
import { DataTable, type Column } from '../../components/ui/table'
import { Toolbar } from '../../components/ui/toolbar'
import { Modal, ConfirmDialog } from '../../components/ui/modal'
import { Field, Input, Select } from '../../components/ui/form'

interface CashUser {
  id: number
  name?: string
}

interface OpenSession {
  id: number
  user?: CashUser | null
  user_id: number
  opening_amount: number
  opened_at: string
  status: string
  notes?: string | null
  expected_efectivo?: number
  cash_by_method?: Record<string, { total: number; count: number }>
}

interface HistRow {
  id: number
  user?: CashUser | null
  user_id: number
  opening_amount: number
  closing_amount?: number | null
  expected_amount?: number | null
  opened_at: string
  closed_at?: string | null
  status: string
  notes?: string | null
}

interface PaymentRow {
  id: number
  invoice_number?: string
  customer?: string
  amount: number
  method: string
  paid_at: string
  reference?: string | null
  receipt_number?: string | null
  notes?: string | null
  recorded_by?: string
}

interface Debtor {
  user_id: number
  customer: string
  phone?: string
  total_debt: number
  invoices: { id: number; invoice_number: string; total: number; paid_amount: number; outstanding: number; issue_date: string; status: string }[]
}

type DebtorInvoice = Debtor['invoices'][number]

interface InvoicePayment {
  id: number
  amount: number
  method: string
  paid_at?: string
  reference?: string | null
  receipt_number?: string | null
  notes?: string | null
  recorded_by?: string
}

const methodLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
}

const methodOrder = ['efectivo', 'transferencia', 'tarjeta']

const methodTone: Record<string, 'green' | 'brand' | 'amber'> = {
  efectivo: 'green',
  tarjeta: 'brand',
  transferencia: 'amber',
}

type Tab = 'session' | 'payments' | 'debtors'

export default function Cash() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('session')

  // Sesión
  const [open, setOpen] = useState<OpenSession[]>([])
  const [history, setHistory] = useState<HistRow[]>([])
  const [histMeta, setHistMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [todayByMethod, setTodayByMethod] = useState<Record<string, { total: number; count: number }>>({})
  const [opening, setOpening] = useState('')
  const [openNotes, setOpenNotes] = useState('')
  const [closeModal, setCloseModal] = useState<OpenSession | null>(null)
  const [closing, setClosing] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [acting, setActing] = useState(false)

  // Pagos
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [payMeta, setPayMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Pagos CRUD
  const [editing, setEditing] = useState<PaymentRow | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', method: 'efectivo', reference: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Deudores
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [debtorsLoading, setDebtorsLoading] = useState(false)
  const [debtSearch, setDebtSearch] = useState('')
  const [payTarget, setPayTarget] = useState<DebtorInvoice | null>(null)
  const [abonoForm, setAbonoForm] = useState({ amount: '', method: 'efectivo', reference: '', notes: '' })

  // Historial de pagos por factura
  const [payHistoryTarget, setPayHistoryTarget] = useState<DebtorInvoice | null>(null)
  const [payHistory, setPayHistory] = useState<InvoicePayment[]>([])
  const [payHistoryLoading, setPayHistoryLoading] = useState(false)

  async function openPayHistory(inv: DebtorInvoice) {
    setPayHistoryTarget(inv)
    setPayHistory([])
    setPayHistoryLoading(true)
    try {
      const res = await api<InvoicePayment[]>(`/staff/invoices/${inv.id}/payments`)
      setPayHistory(res)
    } catch (err) {
      setPayHistory([])
      toast((err as Error).message, 'error')
    } finally {
      setPayHistoryLoading(false)
    }
  }

  // Export
  const [exporting, setExporting] = useState(false)

  async function loadSession(page = 1) {
    const data = await api<{
      open: OpenSession[]
      history: { data: HistRow[]; meta: { current_page: number; last_page: number; total: number } }
      summary: { today_by_method: Record<string, { total: number; count: number }> }
    }>(`/staff/cash?page=${page}&per_page=10`)
    setOpen(data.open)
    setHistory(data.history.data)
    setHistMeta(data.history.meta)
    setTodayByMethod(data.summary?.today_by_method ?? {})
  }

  async function loadPayments(page = 1) {
    const params = new URLSearchParams({ page: String(page), per_page: '10' })
    if (search.trim()) params.set('q', search.trim())
    if (methodFilter) params.set('method', methodFilter)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await api<{ data: PaymentRow[]; meta: { current_page: number; last_page: number; total: number } }>(`/staff/cash/payments?${params}`)
    setPayments(res.data)
    setPayMeta(res.meta)
  }

  async function loadDebtors() {
    setDebtorsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debtSearch.trim()) params.set('q', debtSearch.trim())
      const res = await api<{ debtors: Debtor[] }>(`/staff/debtors?${params}`)
      setDebtors(res.debtors ?? [])
    } finally {
      setDebtorsLoading(false)
    }
  }

  const refresh = useCallback(() => {
    loadSession().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefetchOnFocus(refresh)

  useEffect(() => {
    if (tab === 'payments') loadPayments().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab === 'debtors') loadDebtors().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debtSearch])

  async function openCash() {
    setActing(true)
    try {
      await api('/staff/cash/open', {
        method: 'POST',
        body: JSON.stringify({ opening_amount: opening || 0, notes: openNotes || null }),
      })
      setOpening('')
      setOpenNotes('')
      toast('Caja abierta correctamente.')
      await loadSession()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setActing(false)
    }
  }

  async function finishClose() {
    if (!closeModal) return
    setActing(true)
    try {
      const res = await api<{ expected_efectivo?: number; difference?: number; by_method?: Record<string, { total: number; count: number }> }>(`/staff/cash/${closeModal.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ closing_amount: closing || 0, notes: closeNotes || null }),
      })
      const diff = Number(res?.difference)
      setCloseModal(null)
      setClosing('')
      setCloseNotes('')
      if (Math.abs(diff) < 0.01) toast('Caja cerrada correctamente. El efectivo cuadra.')
      else if (diff > 0) toast(`Caja cerrada con sobrante de ${fmtMoney(diff)}.`)
      else toast(`Caja cerrada con faltante de ${fmtMoney(Math.abs(diff))}.`, 'error')
      await loadSession()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setActing(false)
    }
  }

  function openEdit(p: PaymentRow) {
    setEditing(p)
    setEditForm({ amount: String(p.amount), method: p.method, reference: p.reference ?? '', notes: p.notes ?? '' })
    setEditError('')
    setEditSaving(false)
  }

  async function saveEdit() {
    if (!editing) return
    const amount = Number(editForm.amount)
    if (!amount || amount <= 0) {
      setEditError('El monto debe ser mayor a cero.')
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await api(`/staff/cash/payments/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount,
          method: editForm.method,
          reference: editForm.reference || null,
          notes: editForm.notes || null,
        }),
      })
      toast('Pago actualizado.')
      setEditing(null)
      await loadPayments(payMeta.current_page)
      await loadSession().catch(() => {})
      await loadDebtors().catch(() => {})
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar el pago')
    } finally {
      setEditSaving(false)
    }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api(`/staff/cash/payments/${toDelete.id}`, { method: 'DELETE' })
      toast('Pago eliminado.')
      setToDelete(null)
      const page = payments.length === 1 && payMeta.current_page > 1 ? payMeta.current_page - 1 : payMeta.current_page
      await loadPayments(page)
      await loadSession().catch(() => {})
      await loadDebtors().catch(() => {})
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar el pago', 'error')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function recordAbono(e: React.FormEvent) {
    e.preventDefault()
    if (!payTarget) return
    const amount = Number(abonoForm.amount)
    if (!amount || amount <= 0) return
    setActing(true)
    try {
      await api(`/staff/invoices/${payTarget.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          method: abonoForm.method,
          reference: abonoForm.reference || null,
          notes: abonoForm.notes || null,
        }),
      })
      toast(`Abono de ${fmtMoney(amount)} registrado (${methodLabel[abonoForm.method]}).`)
      setPayTarget(null)
      setAbonoForm({ amount: '', method: 'efectivo', reference: '', notes: '' })
      await loadDebtors().catch(() => {})
      await loadSession().catch(() => {})
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al registrar abono', 'error')
    } finally {
      setActing(false)
    }
  }

  function exportPayments() {
    if (exporting) return
    setExporting(true)
    try {
      const rows: string[][] = [
        ['Recibos y pagos'],
        ['Factura', 'Cliente', 'Método', 'Monto', 'Fecha', 'Referencia', 'Recibo', 'Registrado por'],
        ...payments.map((p) => [p.invoice_number ?? '', p.customer ?? '', methodLabel[p.method] ?? p.method, p.amount.toFixed(2), p.paid_at?.replace('T', ' ').slice(0, 16) ?? '', p.reference ?? '', p.receipt_number ?? '', p.recorded_by ?? '']),
      ]
      const csv = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pagos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast('Pagos exportados')
    } catch {
      toast('No se pudieron exportar los pagos', 'error')
    } finally {
      setExporting(false)
    }
  }

  const fmt = fmtMoney

  const todayTotal = useMemo(
    () =>
      Object.values(todayByMethod).reduce((acc, m) => acc + (m.total || 0), 0),
    [todayByMethod]
  )
  const openCashExpected = open[0]?.expected_efectivo ?? 0
  const totalDebt = useMemo(() => debtors.reduce((a, b) => a + b.total_debt, 0), [debtors])

  const sessionColumns: Column<HistRow>[] = [
    {
      key: 'user',
      header: 'Usuario',
      render: (s) => <span className="font-medium text-carbon-800">{s.user?.name ?? `#${s.user_id}`}</span>,
    },
    {
      key: 'opened_at',
      header: 'Apertura',
      render: (s) => <span className="text-carbon-500">{s.opened_at?.slice(0, 16).replace('T', ' ')}</span>,
    },
    {
      key: 'opening_amount',
      header: 'Fondo inicial',
      align: 'right',
      render: (s) => <span className="text-carbon-700">{fmt(s.opening_amount)}</span>,
    },
    {
      key: 'closing_amount',
      header: 'Cierre',
      align: 'right',
      render: (s) => <span className="text-carbon-700">{s.closed_at ? fmt(s.closing_amount ?? 0) : '—'}</span>,
    },
    {
      key: 'expected',
      header: 'Esperado',
      align: 'right',
      render: (s) => <span className="text-carbon-700">{s.expected_amount != null ? fmt(s.expected_amount) : '—'}</span>,
    },
    {
      key: 'difference',
      header: 'Diferencia',
      align: 'right',
      render: (s) => {
        if (s.expected_amount == null || s.closing_amount == null) return <span className="text-carbon-400">—</span>
        const diff = s.closing_amount - s.expected_amount
        const cls = Math.abs(diff) < 0.01 ? 'text-carbon-500' : diff > 0 ? 'text-emerald-600' : 'text-red-600'
        return <span className={`font-semibold ${cls}`}>{diff > 0 ? '+' : ''}{fmt(diff)}</span>
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => <Badge tone={s.status === 'open' ? 'green' : 'gray'}>{s.status === 'open' ? 'Abierta' : 'Cerrada'}</Badge>,
    },
  ]

  const paymentColumns: Column<PaymentRow>[] = [
    { key: 'invoice', header: 'Factura', render: (p) => <span className="font-medium text-carbon-800">{p.invoice_number || '—'}</span> },
    { key: 'customer', header: 'Cliente', render: (p) => <span className="text-carbon-600">{p.customer || '—'}</span> },
    {
      key: 'method',
      header: 'Método',
      render: (p) => <Badge tone={methodTone[p.method] ?? 'gray'}>{methodLabel[p.method] ?? p.method}</Badge>,
    },
    { key: 'amount', header: 'Monto', align: 'right', render: (p) => <span className="font-semibold text-carbon-900">{fmt(p.amount)}</span> },
    { key: 'paid_at', header: 'Fecha', render: (p) => <span className="text-carbon-500">{p.paid_at?.replace('T', ' ').slice(0, 16)}</span> },
    { key: 'reference', header: 'Referencia', render: (p) => <span className="text-carbon-500">{p.reference || '—'}</span> },
    {
      key: 'actions',
      header: 'Acciones',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <button onClick={() => openEdit(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 text-carbon-600 transition hover:bg-brand-50 hover:text-brand-700" title="Editar pago">
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          <button onClick={() => setToDelete(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50" title="Eliminar pago">
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      ),
    },
  ]

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'session', label: 'Sesión de caja', icon: <Coffee className="h-4 w-4" /> },
    { key: 'payments', label: `Pagos (${payMeta.total})`, icon: <Banknote className="h-4 w-4" /> },
    { key: 'debtors', label: `Deudores (${debtors.length})`, icon: <AlertCircle className="h-4 w-4" /> },
  ]

  return (
    <div className="mx-auto max-w-6xl anim-fade-up">
      <SectionHeader
        variant="brand"
        title="Caja"
        subtitle="Apertura y cierre de turno, recepción de pagos, deudas y movimientos."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recaudado hoy" value={fmt(todayTotal)} tone="brand" icon={<TrendingUp className="h-[22px] w-[22px]" />} />
        <StatCard
          label="Efectivo esperado en caja"
          value={fmt(openCashExpected)}
          tone="green"
          icon={<Banknote className="h-[22px] w-[22px]" />}
          delta={open.length ? { value: 0, direction: 'up', label: 'fondo + ventas del turno' } : undefined}
        />
        <StatCard label="Por cobrar (deudas)" value={fmt(totalDebt)} tone="red" icon={<AlertCircle className="h-[22px] w-[22px]" />} />
        <StatCard label="Caja" value={open.length ? 'Abierta' : 'Cerrada'} tone="dark" icon={<Wallet className="h-[22px] w-[22px]" />} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
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

      {tab === 'session' && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {open.length > 0 ? (
              open.map((s) => (
                <div key={s.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 font-bold text-carbon-900">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><CheckCircle2 className="h-[18px] w-[18px]" /></span>
                      Caja abierta
                    </h2>
                    <Badge tone="green">Turno activo</Badge>
                  </div>
                  <p className="mt-3 text-sm text-carbon-600">
                    Abierta por <span className="font-semibold text-carbon-900">{s.user?.name}</span> a las{' '}
                    {s.opened_at?.slice(11, 16)} — fondo inicial {fmt(s.opening_amount)}.
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {methodOrder.map((m) => {
                      const row = s.cash_by_method?.[m]
                      return (
                        <div key={m} className="rounded-xl bg-white px-2 py-2.5 shadow-sm">
                          <div className="text-[11px] font-semibold uppercase text-carbon-400">{methodLabel[m]}</div>
                          <div className="mt-0.5 text-sm font-bold text-carbon-900">{fmt(row?.total ?? 0)}</div>
                          <div className="text-[11px] text-carbon-400">{row?.count ?? 0} pagos</div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-sm text-carbon-700">
                    Efectivo esperado: <span className="font-bold text-carbon-900">{fmt(s.expected_efectivo ?? 0)}</span>
                  </p>
                  <button
                    onClick={() => {
                      setCloseModal(s)
                      setClosing(String(s.expected_efectivo ?? 0))
                      setCloseNotes('')
                    }}
                    disabled={acting}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-carbon-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-carbon-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4" />
                    Cerrar turno
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-brand-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-bold text-carbon-900">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white"><Coffee className="h-[18px] w-[18px]" /></span>
                  Abrir nueva caja
                </h2>
                <p className="mt-1 text-sm text-carbon-500">Indica el monto inicial en efectivo para iniciar el turno.</p>
                <div className="mt-4 space-y-3">
                  <Field label="Monto inicial (efectivo)" variant="brand">
                    <Input type="number" min={0} value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" variant="brand" />
                  </Field>
                  <Field label="Notas" variant="brand">
                    <Input value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} placeholder="Turno mañana, responsable…" variant="brand" />
                  </Field>
                  <button
                    onClick={() => openCash().catch(() => {})}
                    disabled={acting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {acting ? 'Abriendo…' : 'Abrir caja'}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-carbon-200 bg-white p-5">
              <h2 className="font-bold text-carbon-900">Resumen del día</h2>
              <div className="mt-4 space-y-3">
                {methodOrder.map((m) => {
                  const row = todayByMethod[m]
                  const total = row?.total ?? 0
                  const pct = todayTotal ? Math.round((total / todayTotal) * 100) : 0
                  return (
                    <div key={m}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-carbon-600">
                          {m === 'efectivo' ? <Banknote className="h-4 w-4 text-emerald-600" /> : m === 'tarjeta' ? <CreditCard className="h-4 w-4 text-brand-600" /> : <ArrowLeftRight className="h-4 w-4 text-amber-600" />}
                          {methodLabel[m]}
                          <span className="text-xs text-carbon-400">({row?.count ?? 0})</span>
                        </span>
                        <span className="font-semibold text-carbon-900">{fmt(total)}</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-carbon-100">
                        <div className={`h-full rounded-full ${m === 'efectivo' ? 'bg-emerald-500' : m === 'tarjeta' ? 'bg-brand-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between border-t border-carbon-100 pt-3">
                  <span className="font-semibold text-carbon-800">Total recaudado</span>
                  <span className="font-bold text-carbon-900">{fmt(todayTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 font-bold text-carbon-900">Historial de turnos</h2>
            <DataTable
              columns={sessionColumns}
              rows={history}
              page={histMeta.current_page}
              lastPage={histMeta.last_page}
              total={histMeta.total}
              onPage={(p) => loadSession(p).catch(() => {})}
              minWidth="min-w-[860px]"
              emptyText="Sin turnos registrados todavía."
              variant="brand"
            />
          </div>
        </>
      )}

      {tab === 'payments' && (
        <>
          <Toolbar searchValue={search} onSearch={(v) => setSearch(v)} searchPlaceholder="Buscar factura, cliente…" searchVariant="brand">
            <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} variant="brand">
              <option value="">Todos los métodos</option>
              {methodOrder.map((m) => (
                <option key={m} value={m}>{methodLabel[m]}</option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} variant="brand" title="Desde" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} variant="brand" title="Hasta" />
            <button onClick={() => loadPayments().catch(() => {})} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Search className="h-4 w-4" />
              Filtrar
            </button>
            <button onClick={exportPayments} disabled={exporting || payments.length === 0} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50">
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          </Toolbar>

          <DataTable
            columns={paymentColumns}
            rows={payments}
            page={payMeta.current_page}
            lastPage={payMeta.last_page}
            total={payMeta.total}
            onPage={(p) => loadPayments(p).catch(() => {})}
            minWidth="min-w-[980px]"
            emptyText="Sin pagos registrados con los filtros actuales."
            variant="brand"
          />
        </>
      )}

      {tab === 'debtors' && (
        <>
          <Toolbar searchValue={debtSearch} onSearch={(v) => setDebtSearch(v)} searchPlaceholder="Buscar cliente deudor…" searchVariant="brand">
            <span className="text-sm text-carbon-500">{debtorsLoading ? 'Cargando…' : `${debtors.length} clientes con deuda`}</span>
          </Toolbar>

          {debtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-300 bg-brand-50/40 px-6 py-14 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-carbon-700">No hay deudas pendientes</p>
              <p className="mt-1 text-sm text-carbon-400">Todo está pagado. Regresa cuando haya abonos pendientes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {debtors.map((d) => (
                <div key={d.user_id} className="rounded-2xl border border-carbon-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-carbon-900">{d.customer}</span>
                      {d.phone && <span className="ml-2 text-xs text-carbon-400">{d.phone}</span>}
                      <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {fmt(d.total_debt)} debiendo
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {d.invoices.map((inv) => (
                      <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-carbon-50 px-3 py-2.5 text-sm">
                        <div>
                          <span className="font-medium text-carbon-800">{inv.invoice_number}</span>
                          <span className="ml-2 text-xs text-carbon-400">{inv.issue_date}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-carbon-500">
                            Pagado <b className="text-carbon-700">{fmt(inv.paid_amount)}</b> / {fmt(inv.total)}
                          </span>
                          <span className="font-semibold text-red-600">Falta {fmt(inv.outstanding)}</span>
                          <button
                            onClick={() => openPayHistory(inv)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                          >
                            <History className="h-3.5 w-3.5" />
                            Ver pagos
                          </button>
                          <button
                            onClick={() => {
                              setPayTarget(inv)
                              setAbonoForm({ amount: String(inv.outstanding), method: 'efectivo', reference: '', notes: '' })
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Registrar abono
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal cerrar caja */}
      <Modal
        open={!!closeModal}
        onClose={() => setCloseModal(null)}
        title="Cerrar turno"
        subtitle="Cuadra el efectivo físico. La diferencia se calcula automáticamente."
        variant="brand"
        footer={
          <>
            <button onClick={() => setCloseModal(null)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button onClick={() => finishClose().catch(() => {})} disabled={acting} className="rounded-xl bg-carbon-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-carbon-700 disabled:opacity-50">
              {acting ? 'Cerrando…' : 'Cerrar caja'}
            </button>
          </>
        }
      >
        {closeModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-carbon-800">
              <div className="flex justify-between"><span>Fondo inicial</span><span className="font-semibold">{fmt(closeModal.opening_amount)}</span></div>
              <div className="mt-1 flex justify-between">
                <span>Ventas en efectivo del turno</span>
                <span className="font-semibold">{fmt(closeModal.expected_efectivo ? closeModal.expected_efectivo - closeModal.opening_amount : 0)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2">
                <span className="font-semibold">Efectivo esperado</span>
                <span className="font-bold text-emerald-700">{fmt(closeModal.expected_efectivo ?? 0)}</span>
              </div>
            </div>
            <Field label="Efectivo contado al cierre" variant="brand">
              <Input type="number" min={0} step="0.01" value={closing} onChange={(e) => setClosing(e.target.value)} variant="brand" />
            </Field>
            <Field label="Notas del cierre" variant="brand">
              <Input value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Sobrante/faltante, depósito…" variant="brand" />
            </Field>
            {closeModal.expected_efectivo != null && Number(closing || 0) > 0 && (
              <div className="text-sm">
                <span className="text-carbon-500">Diferencia prevista: </span>
                <span className={`font-bold ${Math.abs(Number(closing) - closeModal.expected_efectivo) < 0.01 ? 'text-carbon-700' : Number(closing) > (closeModal.expected_efectivo ?? 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Number(closing) >= closeModal.expected_efectivo ? '+' : ''}
                  {fmt(Number(closing) - closeModal.expected_efectivo)}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal editar pago */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar pago"
        subtitle="Corrige monto, método o referencia. La factura se recalcula."
        variant="brand"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button onClick={() => saveEdit().catch(() => {})} disabled={editSaving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {editSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            {editError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{editError}</div>}
            <div className="rounded-xl bg-carbon-50 px-4 py-3 text-sm text-carbon-700">
              <span className="font-semibold text-carbon-900">{editing.invoice_number ?? 'Sin factura'}</span> · {editing.customer ?? 'Sin cliente'} · recibo {editing.receipt_number ?? '—'}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Monto" variant="brand">
                <Input type="number" min={0.01} step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} variant="brand" />
              </Field>
              <Field label="Método" variant="brand">
                <Select value={editForm.method} onChange={(e) => setEditForm({ ...editForm, method: e.target.value })} variant="brand">
                  {methodOrder.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Referencia" variant="brand">
              <Input value={editForm.reference} onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })} placeholder="Nº transferencia" variant="brand" />
            </Field>
            <Field label="Notas" variant="brand">
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} variant="brand" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Modal abono */}
      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Registrar abono"
        subtitle="Aplica un pago parcial o total a la factura pendiente."
        variant="brand"
        footer={
          <>
            <button onClick={() => setPayTarget(null)} className="rounded-xl border border-brand-300 px-4 py-2.5 text-sm font-semibold text-carbon-700 transition hover:bg-brand-50">
              Cancelar
            </button>
            <button onClick={(e) => recordAbono(e as unknown as React.FormEvent)} disabled={acting} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {acting ? 'Registrando…' : 'Registrar abono'}
            </button>
          </>
        }
      >
        {payTarget && (
          <form onSubmit={recordAbono} className="space-y-4">
            <div className="rounded-xl bg-carbon-50 px-4 py-3 text-sm">
              <span className="font-medium text-carbon-800">{payTarget.invoice_number}</span>
              <span className="text-carbon-500"> — queda por pagar </span>
              <span className="font-bold text-red-600">{fmt(payTarget.outstanding)}</span>
            </div>
            <Field label="Monto del abono" variant="brand">
              <Input type="number" min={0.01} max={payTarget.outstanding} step="0.01" value={abonoForm.amount} onChange={(e) => setAbonoForm({ ...abonoForm, amount: e.target.value })} variant="brand" />
            </Field>
            <Field label="Método de pago" variant="brand">
              <Select value={abonoForm.method} onChange={(e) => setAbonoForm({ ...abonoForm, method: e.target.value })} variant="brand">
                {methodOrder.map((m) => <option key={m} value={m}>{methodLabel[m]}</option>)}
              </Select>
            </Field>
            <Field label="Referencia (transferencias)" variant="brand">
              <Input value={abonoForm.reference} onChange={(e) => setAbonoForm({ ...abonoForm, reference: e.target.value })} variant="brand" />
            </Field>
            <Field label="Notas" variant="brand">
              <Input value={abonoForm.notes} onChange={(e) => setAbonoForm({ ...abonoForm, notes: e.target.value })} variant="brand" />
            </Field>
          </form>
        )}
      </Modal>

      {/* Modal historial de pagos de factura */}
      <Modal
        open={!!payHistoryTarget}
        onClose={() => setPayHistoryTarget(null)}
        title="Pagos de la factura"
        subtitle={payHistoryTarget ? `${payHistoryTarget.invoice_number} · ${fmt(payHistoryTarget.paid_amount)} pagado de ${fmt(payHistoryTarget.total)}` : ''}
        size="lg"
        variant="brand"
      >
        {payHistoryLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-carbon-400">Cargando pagos…</div>
        ) : payHistory.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-carbon-400">
            <History className="h-6 w-6" />
            Esta factura aún no tiene pagos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-carbon-200">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="border-b-2 border-brand-400 bg-brand-50 text-left text-[11px] uppercase tracking-widest text-carbon-950">
                <tr>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Fecha</th>
                  <th className="px-4 py-3">Recibo / ref.</th>
                  <th className="px-4 py-3">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {payHistory.map((p) => (
                  <tr key={p.id} className="border-t border-carbon-100 hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <Badge tone={methodTone[p.method] ?? 'dark'}>{methodLabel[p.method] ?? p.method}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-carbon-900">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-right text-carbon-500">
                      {p.paid_at ? new Date(p.paid_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-carbon-600">
                      {p.receipt_number ? `Recibo ${p.receipt_number}` : p.reference ? `Ref: ${p.reference}` : '—'}
                      {p.notes && <p className="text-xs text-carbon-400">“{p.notes}”</p>}
                    </td>
                    <td className="px-4 py-3 text-carbon-600">{p.recorded_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => confirmDelete().catch(() => {})}
        title="Eliminar pago"
        message={`¿Eliminar el pago de ${toDelete ? fmt(toDelete.amount) : ''} (${toDelete && methodLabel[toDelete.method]}) de la factura ${toDelete?.invoice_number ?? ''}? La factura se recalculará.`}
        loading={deleting}
      />
    </div>
  )
}