import { useState, useEffect } from 'react'
import { Plus, Trash2, ShoppingBag } from 'lucide-react'

interface Product {
  id: string; name: string; description: string
  price: number; stock: number; image_url: string
  tags: string[]; is_featured: boolean; is_active: boolean
}

export default function AdminProducts({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '1', image_url: '', tags: '', is_featured: false })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/products/admin', { headers })
    const data = await res.json()
    setProducts(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/products', {
      method: 'POST', headers,
      body: JSON.stringify({
        id: `prod-${Date.now()}`, name: form.name, description: form.description,
        price: parseFloat(form.price), stock: parseInt(form.stock),
        image_url: form.image_url,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        is_featured: form.is_featured,
      }),
    })
    setForm({ name: '', description: '', price: '', stock: '1', image_url: '', tags: '', is_featured: false })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Produkt löschen?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE', headers })
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <ShoppingBag size={22} className="text-accent-purple" aria-hidden="true" /> Shop-Produkte
      </h2>

      <form onSubmit={handleSave} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          <Plus size={16} aria-hidden="true" /> Neues Produkt
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-name" className="admin-label">Name *</label>
            <input id="prod-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label htmlFor="prod-img" className="admin-label">Bild-URL</label>
            <input id="prod-img" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." className="input-field" />
          </div>
          <div>
            <label htmlFor="prod-price" className="admin-label">Preis (€) *</label>
            <input id="prod-price" required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" />
          </div>
          <div>
            <label htmlFor="prod-stock" className="admin-label">Lagerbestand</label>
            <input id="prod-stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-field" />
          </div>
          <div>
            <label htmlFor="prod-tags" className="admin-label">Tags</label>
            <input id="prod-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Pokémon, Kunstdruck" className="input-field" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="prod-featured" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
            <label htmlFor="prod-featured" className="text-secondary text-sm cursor-pointer">✨ Als Featured markieren</label>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="prod-desc" className="admin-label">Beschreibung</label>
            <textarea id="prod-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-none" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary mt-4">
          {saving ? 'Wird gespeichert…' : 'Produkt speichern'}
        </button>
      </form>

      {loading ? (
        <p className="text-secondary text-center py-8">Lädt…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.length === 0
            ? <p className="text-muted text-center py-8">Noch keine Produkte.</p>
            : products.map((p) => (
              <div key={p.id} className="admin-list-item">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    : <div className="w-12 h-12 raised rounded-lg flex items-center justify-center shrink-0"><ShoppingBag size={16} className="text-muted" /></div>}
                  <div className="min-w-0">
                    <p className="font-medium section-title truncate">{p.name} {p.is_featured && '✨'}</p>
                    <p className="text-secondary text-sm">€{p.price.toFixed(2)} · Lager: {p.stock}</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(p.id)} className="icon-btn text-muted hover:text-red-500 shrink-0" aria-label={`${p.name} löschen`}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
