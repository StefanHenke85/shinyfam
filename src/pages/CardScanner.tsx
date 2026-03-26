import { useRef, useState, useCallback } from 'react'
import { Camera, ScanLine, X, Loader2, RefreshCw } from 'lucide-react'

type ScanState = 'idle' | 'camera' | 'analyzing' | 'result' | 'error'

const GEMINI_KEY = 'AIzaSyDoQppp4CbVXkYJ-52-NardbPdb9pUXsB8'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`

const PROMPT = `Du bist ein Pokémon-Karten-Experte. Analysiere dieses Bild einer Pokémon-Karte und gib alle Informationen strukturiert auf Deutsch aus.

Extrahiere folgende Informationen:
- Name des Pokémon (auch japanisch falls sichtbar)
- Level und KP/HP
- Typ (Feuer, Wasser, Elektro etc.)
- Pokémon-Daten (Größe, Gewicht, Kategorie)
- Alle Attacken mit Name, Energiekosten, Schaden und Effekt übersetzt
- Fähigkeiten/Abilities falls vorhanden
- Schwäche, Resistenz, Rückzugskosten
- Set und Kartennummer
- Illustrator
- Besonderheiten oder Sammlerwert

Antworte klar und strukturiert auf Deutsch. Wenn Text japanisch ist, übersetze ihn vollständig.`

async function analyzeWithGemini(imageBase64: string, mimeType: string): Promise<string> {
  const body = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType, data: imageBase64 } }
      ]
    }]
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Fehler ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Keine Antwort erhalten.'
}

function resizeImage(imageData: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1024
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.src = imageData
  })
}

export default function CardScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  async function startCamera() {
    setState('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setErrorMsg('Kamerazugriff verweigert. Bitte Berechtigung erteilen.')
      setState('error')
    }
  }

  function captureFrame(): string | null {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.95)
  }

  async function processImage(imageData: string) {
    stopCamera()
    setPreview(imageData)
    setState('analyzing')
    try {
      const { base64, mimeType } = await resizeImage(imageData)
      const result = await analyzeWithGemini(base64, mimeType)
      setAnalysis(result)
      setState('result')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
      setErrorMsg(`Fehler: ${msg}`)
      setState('error')
    }
  }

  function handleCapture() {
    const img = captureFrame()
    if (img) processImage(img)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      if (data) processImage(data)
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    stopCamera()
    setState('idle')
    setPreview(null)
    setAnalysis('')
    setErrorMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // Render markdown-like bold (**text**) simply
  function renderAnalysis(text: string) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <p key={i} className={`text-sm leading-relaxed ${line.startsWith('#') ? 'font-bold section-title text-base mt-3' : 'text-secondary'} ${line === '' ? 'mt-2' : ''}`}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="section-title">{part}</strong> : part
          )}
        </p>
      )
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-accent-purple/10 text-accent-purple px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <ScanLine size={14} />
          Beta-Feature
        </div>
        <h1 className="font-display text-3xl font-black section-title mb-2">Karten-Scanner</h1>
        <p className="text-secondary text-sm max-w-sm mx-auto">
          Fotografiere eine japanische Pokémon-Karte — KI liest und übersetzt sie vollständig ins Deutsche.
        </p>
      </div>

      {/* IDLE */}
      {state === 'idle' && (
        <div className="card rounded-2xl p-8 text-center flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
            <Camera size={36} className="text-accent-purple" />
          </div>
          <p className="text-secondary text-sm">Karte fotografieren oder aus Galerie wählen</p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button type="button" onClick={startCamera} className="btn-primary flex-1 justify-center">
              <Camera size={16} /> Kamera
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-outline flex-1 justify-center">
              Galerie
            </button>
          </div>
          <label htmlFor="card-file-input" className="sr-only">Kartenfoto auswählen</label>
          <input id="card-file-input" ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="sr-only" />
          <p className="text-muted text-xs mt-1">
            Tipp: Gute Beleuchtung und flacher Winkel verbessern die Erkennung.
          </p>
        </div>
      )}

      {/* CAMERA */}
      {state === 'camera' && (
        <div className="card rounded-2xl overflow-hidden">
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full max-h-[60vh] object-contain" playsInline muted />
            <canvas ref={canvasRef} className="sr-only" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-2 border-accent-gold rounded-xl w-48 h-64 opacity-70" />
            </div>
          </div>
          <div className="p-4 flex gap-3">
            <button type="button" onClick={handleCapture} className="btn-primary flex-1 justify-center">
              <Camera size={16} /> Foto aufnehmen
            </button>
            <button type="button" onClick={reset} className="btn-outline px-4" aria-label="Abbrechen">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ANALYZING */}
      {state === 'analyzing' && (
        <div className="flex flex-col gap-4">
          {preview && (
            <div className="card rounded-2xl overflow-hidden">
              <img src={preview} alt="Karte wird analysiert" className="w-full max-h-48 object-contain bg-black" />
            </div>
          )}
          <div className="card rounded-2xl p-8 text-center flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-accent-purple animate-spin" />
            <p className="font-semibold section-title">KI analysiert die Karte…</p>
            <p className="text-muted text-xs">Gemini liest und übersetzt den japanischen Text</p>
          </div>
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div className="card rounded-2xl p-8 text-center flex flex-col items-center gap-4">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <button type="button" onClick={reset} className="btn-primary">
            <RefreshCw size={16} /> Erneut versuchen
          </button>
        </div>
      )}

      {/* RESULT */}
      {state === 'result' && (
        <div className="flex flex-col gap-4">
          {preview && (
            <div className="card rounded-2xl overflow-hidden">
              <img src={preview} alt="Gescannte Karte" className="w-full max-h-48 object-contain bg-black" />
            </div>
          )}
          <div className="card rounded-2xl p-5">
            <h3 className="font-semibold section-title mb-4 text-sm">Karten-Analyse</h3>
            <div className="flex flex-col gap-1">
              {renderAnalysis(analysis)}
            </div>
          </div>
          <button type="button" onClick={reset} className="btn-primary justify-center">
            <RefreshCw size={16} /> Neue Karte scannen
          </button>
        </div>
      )}
    </div>
  )
}
