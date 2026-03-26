import { useState } from 'react'
import { Lock } from 'lucide-react'

interface Props { onLogin: (token: string) => void }

export default function AdminLogin({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('shinyfam-admin-token', data.token)
        onLogin(data.token)
      } else {
        setError(data.error || 'Falsches Passwort')
      }
    } catch {
      setError('Verbindungsfehler – bitte erneut versuchen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="text-center mb-6">
          <img src="/logo.jpg" alt="ShinyFam" className="admin-login-logo" />
          <h1 className="font-display text-2xl font-bold section-title mt-3">Admin</h1>
          <p className="text-secondary text-sm">ShinyFam Backend</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            autoFocus
            className="input-field"
          />
          {error && <p className="text-sm text-center text-error">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary justify-center">
            <Lock size={14} aria-hidden="true" />
            {loading ? 'Wird geprüft…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
