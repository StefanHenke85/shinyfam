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

// Instagram lehnt den Embed ab (X-Frame-Options: deny), wenn die URL das
// Benutzername-Präfix enthält (instagram.com/<user>/reel/<id>/) — es muss die
// kanonische Kurzform instagram.com/reel/<id>/ sein.
function normalizePermalink(url: string): string {
  const match = url.match(/\/(reel|p|tv)\/([^/?]+)/)
  if (!match) return url
  return `https://www.instagram.com/${match[1]}/${match[2]}/`
}

export default function InstagramEmbed({ url }: { url: string }) {
  const permalink = normalizePermalink(url)

  useEffect(() => {
    loadInstagramScript().then(() => window.instgrm?.Embeds.process())
  }, [permalink])

  return (
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={permalink}
      data-instgrm-version="14"
      style={{ width: '100%', margin: 0, border: 0 }}
    />
  )
}
