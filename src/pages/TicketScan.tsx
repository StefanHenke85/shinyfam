import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { Camera, Loader2, ScanLine } from 'lucide-react'

// Einlass-Scanner: Kamera direkt in der Seite, damit der Treffer im selben
// Browser (mit Admin-Login) geoeffnet wird. Die Handy-Kamera-App oeffnet
// Links sonst oft in einem anderen Browser ohne Login.

export function ticketCodeFrom(text: string): string | null {
  const t = text.trim()
  const m = t.match(/\/t\/([A-Za-z0-9]{10})(?:[/?#]|$)/) || t.match(/^([A-Za-z0-9]{10})$/)
  return m ? m[1].toUpperCase() : null
}

export default function TicketScan() {
  const nav = useNavigate()
  const token = localStorage.getItem('shinyfam-admin-token')
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'start' | 'running' | 'error'>('start')
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [manual, setManual] = useState('')
  const stream = useRef<MediaStream | null>(null)
  const done = useRef(false)

  function stop() {
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
  }

  async function start() {
    setErr(''); setHint('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      stream.current = s
      const v = video.current!
      v.srcObject = s
      await v.play()
      setState('running')
    } catch (e) {
      setState('error')
      setErr(e instanceof Error && e.name === 'NotAllowedError'
        ? 'Kamera-Zugriff wurde abgelehnt. Bitte in den Browser-Einstellungen für shinyfam.de die Kamera erlauben und neu laden.'
        : 'Kamera konnte nicht gestartet werden. Ticket-Code unten von Hand eingeben.')
    }
  }

  useEffect(() => {
    if (state !== 'running') return
    let raf = 0, last = 0
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick)
      if (done.current || ts - last < 120) return
      last = ts
      const v = video.current, c = canvas.current
      if (!v || !c || v.readyState < 2 || !v.videoWidth) return
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight))
      c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale)
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(v, 0, 0, c.width, c.height)
      const hit = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'dontInvert' })
      if (!hit?.data) return
      const code = ticketCodeFrom(hit.data)
      if (!code) { setHint('Das ist kein ShinyFam-Ticket-QR-Code.'); return }
      done.current = true
      navigator.vibrate?.(80)
      stop()
      nav(`/t/${code}`)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [state, nav])

  useEffect(() => { if (token) start(); return stop }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return (
    <div className="max-w-md mx-auto px-4 pt-28 pb-12 text-center">
      <p className="text-primary font-bold mb-2">Einlass-Scanner</p>
      <p className="text-secondary text-sm mb-4">Bitte zuerst in diesem Browser im Admin anmelden.</p>
      <Link to="/admin" className="btn-primary">Zum Admin-Login</Link>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 pt-24 pb-12">
      <h1 className="text-xl font-black text-primary mb-1 flex items-center gap-2"><ScanLine size={20} /> Einlass-Scanner</h1>
      <p className="text-secondary text-sm mb-3">QR-Code vom Ticket ins Bild halten – das Ticket öffnet sich automatisch.</p>

      <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-3">
        <video ref={video} playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvas} className="hidden" />
        {state === 'running' && <div className="absolute inset-[18%] border-4 border-white/80 rounded-2xl pointer-events-none" />}
        {state === 'start' && <div className="absolute inset-0 flex items-center justify-center text-white/80 gap-2"><Loader2 size={18} className="animate-spin" /> Kamera startet…</div>}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-6 gap-3">
            <p className="text-sm">{err}</p>
            <button type="button" onClick={start} className="btn-primary inline-flex items-center gap-2"><Camera size={16} /> Erneut versuchen</button>
          </div>
        )}
      </div>
      {hint && <p className="text-amber-500 text-sm font-semibold text-center mb-3">{hint}</p>}

      <form onSubmit={e => { e.preventDefault(); const c = ticketCodeFrom(manual) || manual.trim().toUpperCase(); if (c) { stop(); nav(`/t/${c}`) } }} className="flex gap-2">
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Ticket-Code von Hand, z.B. JKKPSL73BY" className="flex-1 bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm uppercase" />
        <button type="submit" className="btn-primary text-sm">Prüfen</button>
      </form>
    </div>
  )
}
