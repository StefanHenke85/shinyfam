import { useState } from 'react'
import { Play } from 'lucide-react'

interface Props {
  videoId: string
  title?: string
}

export default function YouTubeEmbed({ videoId, title = 'Video' }: Props) {
  const [loaded, setLoaded] = useState(false)

  if (!loaded) {
    return (
      <div
        className="relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer group bg-bg-raised"
        onClick={() => setLoaded(true)}
      >
        <img
          src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
          alt={title}
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full p-4 group-hover:scale-110 transition-transform">
            <Play size={32} className="text-white fill-white ml-1" />
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white text-sm font-medium bg-black/40 backdrop-blur-sm rounded px-2 py-1 inline-block">
            {title}
          </p>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-xs text-gray-400 bg-black/60 rounded px-2 py-1">
            Klicken zum Laden (YouTube)
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
