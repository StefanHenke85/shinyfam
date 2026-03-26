import { useRef, useState } from 'react'
import { Upload, X, Image } from 'lucide-react'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
}

export default function ImageUpload({ value, onChange, label = 'Foto' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const img = new window.Image()
    img.onload = () => {
      const MAX = 800
      let w = img.width, h = img.height
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
      if (h > MAX) { w = Math.round(w * MAX / h); h = MAX }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      onChange(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.src = URL.createObjectURL(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <p className="admin-label">{label}</p>
      {value ? (
        <div className="image-upload-preview">
          <img src={value} alt="Vorschau" className="image-upload-img" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="image-upload-remove"
            aria-label="Foto entfernen"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`image-upload-zone${dragging ? ' image-upload-zone-drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-label="Foto hochladen"
        >
          <Image size={28} className="text-muted mb-2" aria-hidden="true" />
          <span className="text-sm text-secondary font-medium">Foto auswählen</span>
          <span className="text-xs text-muted mt-1">oder hierher ziehen</span>
          <Upload size={14} className="text-muted mt-1" aria-hidden="true" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
