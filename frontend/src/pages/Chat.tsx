import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthContext'
import { usePolling, useRefetchOnFocus } from '../lib/useRefetch'

interface ChatMessage {
  id: number
  sender: 'client' | 'staff'
  staff: { id: number; name: string } | null
  message: string
  is_read: boolean
  created_at: string | null
}

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const data = await api<ChatMessage[]>('/chat')
      setMessages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el chat')
    } finally {
      setLoading(false)
    }
  }

  function markRead() {
    api('/chat/read', { method: 'POST' }).catch(() => {})
  }

  useEffect(() => {
    load()
    markRead()
  }, [])

  useRefetchOnFocus(() => {
    load()
    markRead()
  })
  usePolling(() => {
    load()
    markRead()
  }, 8000)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const created = await api<ChatMessage>('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      setMessages((prev) => [...prev, created])
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 anim-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-carbon-900 dark:text-carbon-700">Chatea con el taller</h1>
          <p className="mt-0.5 text-sm text-carbon-500">
            Escribe tu consulta y el equipo de {user?.name?.split(' ')[0] ?? ''} te responderá aquí o por WhatsApp.
          </p>
        </div>
        <span className="chip bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Atendemos tu mensaje
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex h-[520px] flex-col overflow-hidden rounded-2xl border border-carbon-200 bg-white shadow-sm dark:bg-carbon-100 dark:border-carbon-200">
        <div className="flex items-center gap-3 border-b border-carbon-100 bg-carbon-50/60 px-5 py-3.5 dark:bg-carbon-200/40 dark:border-carbon-200">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
            T
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-carbon-900 dark:text-carbon-700">Taller {user?.name?.split(' ')[0] ?? ''}</p>
            <p className="text-xs text-carbon-500">Soporte y seguimiento de tus órdenes</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-carbon-50/40 p-5 dark:bg-carbon-200/20">
          {loading ? (
            <div className="space-y-3">
              <div className="h-14 w-2/3 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
              <div className="ml-auto h-10 w-1/3 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
              <div className="h-12 w-1/2 animate-pulse rounded-xl bg-carbon-100 dark:bg-carbon-200" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
              </span>
              <div>
                <p className="font-bold text-carbon-800 dark:text-carbon-600">¡Hola {user?.name?.split(' ')[0] ?? ''}! 👋</p>
                <p className="mt-1 max-w-sm text-sm text-carbon-500">
                  Cuéntanos qué necesitas: dudas sobre tu moto, estado de una orden o una cotización.
                </p>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isClient = m.sender === 'client'
              return (
                <div key={m.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      isClient
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md border border-carbon-100 bg-white text-carbon-800 dark:border-carbon-200 dark:bg-carbon-100 dark:text-carbon-600'
                    }`}
                  >
                    {!isClient && (
                      <p className="mb-0.5 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        {m.staff?.name ?? 'Taller'}
                      </p>
                    )}
                    <p className="whitespace-pre-line leading-relaxed">{m.message}</p>
                    <p className={`mt-1 text-right text-[10px] ${isClient ? 'text-white/60' : 'text-carbon-400'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send() }}
          className="flex items-end gap-2 border-t border-carbon-100 bg-white p-3 dark:bg-carbon-100 dark:border-carbon-200"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Escribe tu mensaje… (Enter para enviar)"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-carbon-200 bg-carbon-50 px-4 py-2.5 text-sm text-carbon-800 placeholder-carbon-400 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-carbon-200 dark:bg-carbon-200 dark:text-carbon-600"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.97] disabled:opacity-50"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            )}
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}