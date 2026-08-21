import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isStaffRole } from '../lib/roles'
import { api, ApiError } from '../lib/api'
import { AuthInput, AuthShell, AuthSubmit } from '../components/AuthShell'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Bloqueo temporal tras varios intentos fallidos (el backend manda retry_in_seconds).
  const [retryIn, setRetryIn] = useState(0)

  // Flujo "¿Olvidaste tu contraseña?"
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  useEffect(() => {
    if (retryIn <= 0) return
    const t = setInterval(() => setRetryIn((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [retryIn])

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    return 'Error al iniciar sesión'
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const logged = await login(email, password)
      if (from) navigate(from, { replace: true })
      else if (isStaffRole(logged.role)) navigate('/admin/dashboard', { replace: true })
      else navigate('/panel', { replace: true })
} catch (err) {
      if (err instanceof ApiError && err.retryIn) setRetryIn(err.retryIn)
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault()
    setResetMsg('')
    setResetErr('')
    setResetSubmitting(true)
    try {
      const data = await api<{ message: string; whatsapp_sent?: boolean; debug_code?: string }>('/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      })
      setCodeSent(true)
      let msg = data.whatsapp_sent
        ? 'Te enviamos el código por WhatsApp. Es válido por 5 minutos.'
        : 'Te enviamos el código por WhatsApp. Revisa tu teléfono.'
      if (data.debug_code) {
        msg = `Recibiste el código ${data.debug_code} en el log del servidor (WhatsApp aún no configurado). Escribelo abajo.`
      }
      setResetMsg(msg)
    } catch (err) {
      setResetErr(err instanceof Error ? err.message : 'Error al enviar el código')
    } finally {
      setResetSubmitting(false)
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setResetMsg('')
    setResetErr('')
    setResetSubmitting(true)
    try {
      await api('/password/reset', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, code: resetCode, password: resetPassword }),
      })
      setMode('login')
      setResetCode('')
      setResetPassword('')
      setCodeSent(false)
      setError('')
    } catch (err) {
      setResetErr(err instanceof Error ? err.message : 'Error al restablecer la contraseña')
    } finally {
      setResetSubmitting(false)
    }
  }

  function goToForgot() {
    setMode('forgot')
    setError('')
    setRetryIn(0)
    setResetMsg('')
    setResetErr('')
    setCodeSent(false)
  }

  return (
    <AuthShell
      title="Bienvenido"
      subtitle="Accede a tu garaje digital y lleva el control de tu moto"
      footer={
        <p className="mt-4 text-center text-sm text-carbon-500">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-brand-600 hover:underline">
            Regístrate
          </Link>
        </p>
      }
    >
      {mode === 'login' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <AuthInput
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {retryIn > 0 && (
            <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700">
              Demasiados intentos fallidos. Inténtalo de nuevo en {Math.ceil(retryIn / 60)} min ({retryIn} s).
            </p>
          )}
          <AuthSubmit submitting={submitting} >
            {submitting ? 'Entrando...' : 'Entrar'}
          </AuthSubmit>
          <button
            type="button"
            onClick={goToForgot}
            className="mt-2 block w-full text-center text-sm font-medium text-brand-600 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            ← Volver al inicio de sesión
          </button>

          {!codeSent ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <p className="text-sm text-carbon-500">
                Ingresa el correo de tu cuenta y te enviaremos un código de recuperación por WhatsApp.
              </p>
              <AuthInput label="Email" type="email" value={resetEmail} onChange={setResetEmail} autoComplete="email" />
              {resetErr && <p className="text-sm text-red-600">{resetErr}</p>}
              <AuthSubmit submitting={resetSubmitting}>{resetSubmitting ? 'Enviando...' : 'Enviar código'}</AuthSubmit>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <AuthInput label="Código de WhatsApp" type="text" value={resetCode} onChange={setResetCode} placeholder="123456" />
              <AuthInput
                label="Nueva contraseña"
                type="password"
                value={resetPassword}
                onChange={setResetPassword}
                autoComplete="new-password"
              />
              {resetMsg && <p className="text-sm text-green-600">{resetMsg}</p>}
              {resetErr && <p className="text-sm text-red-600">{resetErr}</p>}
              <AuthSubmit submitting={resetSubmitting}>{resetSubmitting ? 'Guardando...' : 'Restablecer contraseña'}</AuthSubmit>
            </form>
          )}
        </div>
      )}
    </AuthShell>
  )
}