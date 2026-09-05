import { useEffect } from 'react'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

let scriptPromise: Promise<void> | null = null

function loadInstagramScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://www.instagram.com/embed.js'
      script.async = true
      script.onload = () => resolve()
      document.body.appendChild(script)
    })
  }
  return scriptPromise
}

export default function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    loadInstagramScript().then(() => window.instgrm?.Embeds.process())
  }, [url])

  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      style={{ width: '100%', margin: 0, border: 0 }}
    />
  )
}
