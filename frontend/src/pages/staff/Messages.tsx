import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Phone, Send } from 'lucide-react'
import { apiStaff as api } from '../../lib/api'
import type { Paginated } from '../../lib/pagination'
import { useToast } from '../../lib/toast'
import { usePolling, useRefetchOnFocus } from '../../lib/useRefetch'

interface Message {
  id: number
  name: string
  email: string
  phone?: string | null
  subject?: string | null
  message: string
  is_read: boolean
  created_at?: string
}

interface ChatConversation {
  user: { id: number; name: string; email: string; phone?: string | null; photo?: string | null }
  last_message: string
  last_sender: string
  last_at?: string
  unread: number
}

interface ChatMsg {
  id: number
  sender: 'client' | 'staff'
  staff: { id: number; name: string } | null
  message: string
  is_read: boolean
  created_at?: string
}

type Tab = 'chat' | 'contact'

export default function Messages() {
  const toast = useToast().toast
  const [tab, setTab] = useState<Tab>('chat')

  // ---------- Contacto (formulario web) ----------
  const [messages, setMessages] = useState<Message[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  // ---------- Chat con clientes ----------
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeClient, setActiveClient] = useState<number | null>(null)
  const [thread, setThread] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sending, setSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  async function load(page = 1) {
    const res = await api<Paginated<Message>>(`/staff/messages?page=${page}${unreadOnly ? '&unread_only=1' : ''}`)
    setMessages(res.data)
    setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total })
    setLoading(false)
  }

  async function loadConversations() {
    try {
      const data = await api<ChatConversation[]>('/staff/chat')
      const activeStillThere = data.some((c) => c.user.id === activeClient)
      setConversations(data)
      if (activeClient !== null && !activeStillThere) {
        setActiveClient(null)
        setThread([])
      }
    } catch {
      /* noop */
    }
  }

  async function openConversation(clientId: number) {
    setActiveClient(clientId)
    api<ChatMsg[]>(`/staff/chat/${clientId}`)
      .then(setThread)
      .catch(() => {})
    api(`/staff/chat/${clientId}/read`, { method: 'POST' }).catch(() => {})
  }

  useEffect(() => {
    load().catch(() => setLoading(false))
    LoadChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function LoadChat() {
    loadConversations()
  }

  useRefetchOnFocus(() => {
    loadConversations()
    if (activeClient !== null) {
      openConversation(activeClient)
    }
  })
  usePolling(() => {
    loadConversations()
    if (activeClient !== null) {
      api<ChatMsg[]>(`/staff/chat/${activeClient}`).then(setThread).catch(() => {})
      api(`/staff/chat/${activeClient}/read`, { method: 'POST' }).catch(() => {})
    }
  }, 8000)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || activeClient === null || sending) return
    setSending(true)
    try {
      const created = await api<ChatMsg>(`/staff/chat/${activeClient}`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setThread((prev) => [...prev, created])
      setChatInput('')
      await loadConversations()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  function toggleUnread() {
    setUnreadOnly((v) => !v)
  }

  useEffect(() => {
    if (unreadOnly) load(1).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly])

  async function markRead(m: Message) {
    if (m.is_read) return
    try {
      await api(`/staff/messages/${m.id}/read`, { method: 'PATCH' })
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)))
    } catch {
      /* noop */
    }
  }

  async function remove(m: Message) {
    if (!confirm(`¿Eliminar el mensaje de ${m.name}?`)) return
    try {
      await api(`/staff/messages/${m.id}`, { method: 'DELETE' })
      toast.success('Mensaje eliminado')
      load(meta.current_page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  if (tab === 'chat' && loading === true && conversations.length === 0) {
    // no-op: chat no depende de loading de contacto
  }

  const totalUnreadChat = conversations.reduce((acc, c) => acc + c.unread, 0)

  const chatPanel =
    activeClient === null ? (
      <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
        <div className="border-b border-carbon-100 bg-carbon-50/60 px-5 py-3.5 dark:bg-carbon-200/40 dark:border-carbon-200">
          <h2 className="text-sm font-bold text-carbon-900 dark:text-carbon-700">Conversaciones</h2>
          <p className="text-xs text-carbon-500">Elige un cliente para ver y responder su chat.</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="py-16 text-center text-sm text-carbon-400">
              Aún no hay conversaciones. Cuando un cliente escriba desde su portal, aparecerá aquí.
            </p>
          ) : (
            <div className="divide-y divide-carbon-100 dark:divide-carbon-200">
              {conversations.map((c) => (
                <button
                  key={c.user.id}
                  onClick={() => openConversation(c.user.id)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-carbon-50 dark:hover:bg-carbon-200/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                    {c.user.photo ? <img src={c.user.photo} alt="" className="h-full w-full object-cover" /> : (c.user.name || '?')[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-carbon-900 dark:text-carbon-700">{c.user.name}</span>
                      {c.last_at && (
                        <span className="shrink-0 text-[11px] text-carbon-400">
                          {new Date(c.last_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-carbon-500">
                      {c.last_sender === 'client' ? '' : 'Tú: '}
                      {c.last_message}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    ) : (
      <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
        <div className="flex items-center gap-3 border-b border-carbon-100 bg-carbon-50/60 px-5 py-3.5 dark:bg-carbon-200/40 dark:border-carbon-200">
          <button
            onClick={() => { setActiveClient(null); setThread([]) }}
            className="rounded-lg p-1.5 text-carbon-500 transition hover:bg-carbon-100 hover:text-carbon-800 dark:hover:bg-carbon-200"
            title="Volver"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="min-w-0 flex-1">
            {(() => {
              const c = conversations.find((x) => x.user.id === activeClient)
              return (
                <>
                  <p className="truncate text-sm font-bold text-carbon-900 dark:text-carbon-700">{c?.user.name ?? 'Cliente'}</p>
                  <p className="truncate text-xs text-carbon-500">{c?.user.email ?? ''}</p>
                </>
              )
            })()}
          </div>
          {(() => {
            const c = conversations.find((x) => x.user.id === activeClient)
            return c?.user.phone ? (
              <a href={`tel:${c.user.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-200 px-2.5 py-1.5 text-xs font-semibold text-carbon-700 hover:bg-carbon-50 dark:border-carbon-200 dark:text-carbon-500">
                <Phone className="h-[13px] w-[13px]" />
                Llamar
              </a>
            ) : null
          })()}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-carbon-50/40 p-5 dark:bg-carbon-200/20">
          {thread.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-carbon-400">
              Sin mensajes todavía. Envía el primer mensaje.
            </div>
          ) : (
            thread.map((m) => {
              const isStaff = m.sender === 'staff'
              return (
                <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      isStaff
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md border border-carbon-100 bg-white text-carbon-800 dark:border-carbon-200 dark:bg-carbon-100 dark:text-carbon-600'
                    }`}
                  >
                    {!isStaff && (
                      <p className="mb-0.5 text-[11px] font-bold text-brand-600 dark:text-brand-400">Cliente</p>
                    )}
                    <p className="whitespace-pre-line leading-relaxed">{m.message}</p>
                    <p className={`mt-1 text-right text-[10px] ${isStaff ? 'text-white/60' : 'text-carbon-400'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); sendChat() }}
          className="flex items-end gap-2 border-t border-carbon-100 bg-white p-3 dark:bg-carbon-100 dark:border-carbon-200"
        >
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendChat()
              }
            }}
            placeholder="Responde al cliente… (Enter para enviar)"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
          />
          <button
            type="submit"
            disabled={sending || !chatInput.trim()}
            className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </button>
        </form>
      </div>
    )

  return (
    <div className="anim-fade-up">
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-brand-300 bg-white p-1">
        <button
          onClick={() => setTab('chat')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            tab === 'chat' ? 'bg-brand-600 text-white shadow' : 'text-carbon-600 hover:bg-brand-50 hover:text-brand-700'
          }`}
        >
          Chat con clientes
          {totalUnreadChat > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${tab === 'chat' ? 'bg-white/20' : 'bg-brand-600 text-white'}`}>
              {totalUnreadChat}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('contact')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            tab === 'contact' ? 'bg-brand-600 text-white shadow' : 'text-carbon-600 hover:bg-brand-50 hover:text-brand-700'
          }`}
        >
          Contacto web
        </button>
      </div>

      {tab === 'chat' ? (
        <div className="mt-5">{chatPanel}</div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <h2 className="font-bold text-carbon-700">Consultas del formulario de contacto</h2>
            <label className="flex items-center gap-2 text-sm text-carbon-600">
              <input type="checkbox" checked={unreadOnly} onChange={toggleUnread} />
              Solo no leídos
            </label>
          </div>

          <div className="mt-3 space-y-3">
            {loading && <p className="py-8 text-center text-carbon-400">Cargando mensajes...</p>}
            {!loading && messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border bg-white p-4 ${m.is_read ? 'border-carbon-200' : 'border-brand-300 ring-1 ring-brand-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!m.is_read && <span className="chip bg-brand-600 text-white">Nuevo</span>}
                      <h3 className="font-semibold text-carbon-900">{m.name}</h3>
                      <span className="text-xs text-carbon-400">{m.email}</span>
                    </div>
                    {m.subject && <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-brand-600">{m.subject}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => { setOpenId(openId === m.id ? null : m.id); markRead(m) }}
                      className="rounded-lg border border-carbon-200 px-2.5 py-1 text-xs font-semibold text-carbon-700 hover:bg-carbon-100"
                    >
                      {openId === m.id ? 'Ocultar' : 'Ver'}
                    </button>
                    <button onClick={() => remove(m)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50">Eliminar</button>
                  </div>
                </div>
                {m.created_at && <p className="mt-1 text-xs text-carbon-400">{new Date(m.created_at).toLocaleString('es-CO')}</p>}
                {openId === m.id && (
                  <div className="anim-fade-up mt-3 rounded-xl bg-carbon-50 p-4">
                    <p className="whitespace-pre-line text-sm text-carbon-700">{m.message}</p>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <Phone className="h-[15px] w-[15px]" />
                        {m.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!loading && messages.length === 0 && <p className="py-8 text-center text-carbon-400">No hay mensajes de contacto.</p>}

            {unreadOnly === false && messages.filter((m) => !m.is_read).length > 0 && messages.length > 0 && (
              <p className="text-xs text-carbon-500">{messages.filter((m) => !m.is_read).length} sin leer en esta página</p>
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button disabled={meta.current_page <= 1} onClick={() => load(meta.current_page - 1)} className="rounded-lg border border-carbon-200 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
            <span className="text-sm text-carbon-500">Página {meta.current_page} de {meta.last_page} · {meta.total} total</span>
            <button disabled={meta.current_page >= meta.last_page} onClick={() => load(meta.current_page + 1)} className="rounded-lg border border-carbon-200 px-3 py-1.5 text-sm disabled:opacity-40">Siguiente</button>
          </div>
        </>
      )}
    </div>
  )
}