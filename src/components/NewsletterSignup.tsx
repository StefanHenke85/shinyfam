import { useState } from 'react'
import { Mail, CheckCircle } from 'lucide-react'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    await fetch('/api/newsletter/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    }).catch(() => {})
    setSent(true)
    setSending(false)
  }

  if (sent) return (
    <div className="flex items-center gap-3 py-4 px-5 rounded-2xl bg-accent-purple/10 border border-accent-purple/20">
      <CheckCircle size={22} className="text-accent-purple shrink-0" />
      <div>
        <p className="font-semibold text-primary text-sm">Du bist dabei!</p>
        <p className="text-secondary text-xs mt-0.5">Wir informieren dich über neue Events & Neuigkeiten.</p>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
      <input
        type="text"
        placeholder="Dein Name"
        value={name}
        onChange={e => setName(e.target.value)}
        className="flex-1 bg-bg-surface border border-theme rounded-xl px-4 py-2.5 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
      />
      <input
        required
        type="email"
        placeholder="deine@email.de"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 bg-bg-surface border border-theme rounded-xl px-4 py-2.5 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
      />
      <button
        type="submit"
        disabled={sending}
        className="btn-primary text-sm shrink-0 flex items-center gap-1.5"
      >
        <Mail size={14} aria-hidden="true" />
        {sending ? 'Wird eingetragen…' : 'Anmelden'}
      </button>
    </form>
  )
}
