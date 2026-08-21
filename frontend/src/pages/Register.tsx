import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthInput, AuthShell, AuthSubmit } from '../components/AuthShell'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setSubmitting(true)
    try {
      await register({ name, email, phone, password })
      navigate('/panel', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarte')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Crea tu cuenta y empieza con tu garaje digital"
      footer={
        <p className="mt-4 text-center text-sm text-carbon-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput label="Nombre" value={name} onChange={setName} autoComplete="name" />
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <AuthInput label="Teléfono" type="tel" value={phone} onChange={setPhone} autoComplete="tel" placeholder="Opcional" />
        <AuthInput label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
        <AuthInput label="Confirmar contraseña" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <AuthSubmit submitting={submitting}>{submitting ? 'Creando...' : 'Registrarme'}</AuthSubmit>
      </form>
    </AuthShell>
  )
}
