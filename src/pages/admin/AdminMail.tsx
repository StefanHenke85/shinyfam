import { useState, useEffect } from 'react'
import { RefreshCw, Send, Mail, Inbox, Bell, BellOff, Trash2, Forward, FolderPlus, Folder, FolderOpen, X, FileText, Plus, Pencil, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import AdminDunning from './AdminDunning'

interface MailTemplate {
  id: number; name: string; type: string; subject: string; body: string
}

const VAPID_PUBLIC_KEY = 'BPqi4PkgX16Z2LdiVDqct1qu9EsFL6gWQYax2jSI2iC3Fidnd2yLnlsR3hO33t4h1FoJLe8or2T9sVpy8DiCtMU'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

interface MailMessage {
  id: number
  from: string
  subject: string
  date: string
  text: string
  html: string
}

export default function AdminMail({ token }: { token: string }) {
  const [mails, setMails] = useState<MailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<MailMessage | null>(null)
  const [view, setView] = useState<'inbox' | 'compose' | 'templates' | 'dunning'>('inbox')
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [folders, setFolders] = useState<{id: number, name: string}[]>([])
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null)
  const [folderItems, setFolderItems] = useState<{mail_uid: string}[]>([])
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [assignMsg, setAssignMsg] = useState('')
  const [templates, setTemplates] = useState<MailTemplate[]>([])
  const [tmplView, setTmplView] = useState<'list' | 'edit'>('list')
  const [editTmpl, setEditTmpl] = useState<Partial<MailTemplate> | null>(null)
  const [tmplSaving, setTmplSaving] = useState(false)
  const [expandedTmpl, setExpandedTmpl] = useState<number | null>(null)

  async function loadMails() {
    setLoading(true)
    try {
      const r = await fetch('/api/mail/inbox', { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (Array.isArray(data)) setMails(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMails()
    checkPush()
    loadFolders()
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const r = await fetch('/api/mail/templates', { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (Array.isArray(data)) setTemplates(data)
    } catch { /* ignore */ }
  }

  async function saveTmpl(e: React.FormEvent) {
    e.preventDefault()
    if (!editTmpl) return
    setTmplSaving(true)
    try {
      if (editTmpl.id) {
        await fetch(`/api/mail/templates/${editTmpl.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editTmpl),
        })
      } else {
        await fetch('/api/mail/templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(editTmpl),
        })
      }
      await loadTemplates()
      setTmplView('list')
      setEditTmpl(null)
    } finally {
      setTmplSaving(false)
    }
  }

  async function deleteTmpl(id: number, name: string) {
    if (!confirm(`Vorlage „${name}" löschen?`)) return
    await fetch(`/api/mail/templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    loadTemplates()
  }

  async function loadFolders() {
    try {
      const r = await fetch('/api/mail/folders', { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (Array.isArray(data)) setFolders(data)
    } catch { /* ignore */ }
  }

  async function loadFolderItems(fid: number) {
    try {
      const r = await fetch(`/api/mail/folders/${fid}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (Array.isArray(data)) setFolderItems(data)
    } catch { /* ignore */ }
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    await fetch('/api/mail/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    setNewFolderName('')
    setShowNewFolder(false)
    loadFolders()
  }

  async function deleteFolder(id: number) {
    if (!confirm('Ordner löschen?')) return
    await fetch(`/api/mail/folders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (selectedFolder === id) setSelectedFolder(null)
    loadFolders()
  }

  async function assignToFolder(mail: MailMessage, folderId: number) {
    const folderName = folders.find(f => f.id === folderId)?.name ?? 'Ordner'
    await fetch('/api/mail/folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ folder_id: folderId, mail_uid: String(mail.id), mail_subject: mail.subject, mail_from: mail.from, mail_date: mail.date }),
    })
    setAssignMsg(`✓ In „${folderName}" abgelegt`)
    setTimeout(() => setAssignMsg(''), 3000)
    loadFolderItems(folderId)
  }

  async function unassignFromFolder(mailUid: string, folderId: number) {
    await fetch('/api/mail/folders/unassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ folder_id: folderId, mail_uid: mailUid }),
    })
    loadFolderItems(folderId)
  }

  async function checkPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setPushEnabled(!!sub)
  }

  async function togglePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push-Benachrichtigungen werden in diesem Browser nicht unterstützt.')
      return
    }
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(sub) })
          await sub.unsubscribe()
        }
        setPushEnabled(false)
      } else {
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
        await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(sub) })
        setPushEnabled(true)
      }
    } catch (e: any) {
      alert('Fehler: ' + e.message)
    } finally {
      setPushLoading(false)
    }
  }

  async function deleteMail(id: number) {
    if (!confirm('Mail löschen?')) return
    await fetch('/api/mail/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setMails(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function forwardMail(mail: MailMessage) {
    setTo('')
    setSubject('Fwd: ' + mail.subject.replace(/^Fwd: /i, ''))
    setText('\n\n--- Weitergeleitet ---\nVon: ' + mail.from + '\nDatum: ' + (mail.date ? new Date(mail.date).toLocaleString('de-DE') : '') + '\n\n' + mail.text)
    setView('compose')
  }

  async function sendMail(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setSendMsg('')
    try {
      const r = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, subject, text }),
      })
      if (r.ok) {
        setSendMsg('Mail gesendet!')
        setTo('')
        setSubject('')
        setText('')
      } else {
        const d = await r.json()
        setSendMsg('Fehler: ' + d.error)
      }
    } catch (e: any) {
      setSendMsg('Fehler: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  function replyTo(mail: MailMessage) {
    setTo(mail.from.replace(/.*<(.+)>/, '$1').trim() || mail.from)
    setSubject('Re: ' + mail.subject.replace(/^Re: /i, ''))
    setText('\n\n--- Original ---\nVon: ' + mail.from + '\n' + mail.text)
    setView('compose')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title text-xl font-bold font-display">Postfach info@shinyfam.de</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={togglePush}
            disabled={pushLoading}
            title={pushEnabled ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pushEnabled ? 'bg-green-500 text-white' : 'bg-bg-raised text-muted border border-theme'}`}
          >
            {pushEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            {pushEnabled ? 'Push AN' : 'Push AUS'}
          </button>
          <button
            type="button"
            onClick={() => setView('inbox')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'inbox' ? 'bg-primary text-white' : 'bg-bg-raised text-muted border border-theme'}`}
          >
            <Inbox size={14} /> Posteingang
          </button>
          <button
            type="button"
            onClick={() => { setView('compose'); setSelected(null) }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'compose' ? 'bg-primary text-white' : 'bg-bg-raised text-muted border border-theme'}`}
          >
            <Send size={14} /> Neue Mail
          </button>
          <button
            type="button"
            onClick={() => { setView('templates'); setTmplView('list'); setEditTmpl(null) }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'templates' ? 'bg-accent-purple text-white' : 'bg-bg-raised text-muted border border-theme'}`}
          >
            <FileText size={14} /> Vorlagen
          </button>
          <button
            type="button"
            onClick={() => { setView('dunning'); setSelected(null) }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'dunning' ? 'bg-red-600 text-white' : 'bg-bg-raised text-muted border border-theme'}`}
          >
            <AlertTriangle size={14} /> Mahnung
          </button>
        </div>
      </div>

      {view === 'inbox' && (
        <div className="flex gap-4" style={{ minHeight: 500 }}>
          {/* Ordner-Sidebar */}
          <div className="w-48 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted font-semibold uppercase tracking-wider">Ordner</span>
              <button type="button" onClick={() => setShowNewFolder(v => !v)} title="Neuer Ordner" className="p-1 rounded hover:bg-bg-hover text-muted hover:text-primary">
                <FolderPlus size={14} />
              </button>
            </div>
            {showNewFolder && (
              <form onSubmit={createFolder} className="mb-2 flex gap-1">
                <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Ordnername" className="admin-input text-xs py-1 px-2 flex-1 min-w-0" />
                <button type="submit" className="p-1.5 rounded bg-accent-purple text-white text-xs">+</button>
              </form>
            )}
            <div className="space-y-0.5">
              <button type="button" onClick={() => setSelectedFolder(null)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${selectedFolder === null ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-bg-hover'}`}>
                <Inbox size={13} /> Posteingang
                <span className="ml-auto text-xs text-muted">{mails.length}</span>
              </button>
              {folders.map(f => (
                <div key={f.id} className="group flex items-center">
                  <button type="button" onClick={() => { setSelectedFolder(f.id); loadFolderItems(f.id) }}
                    className={`flex-1 text-left px-2 py-1.5 rounded-l text-sm flex items-center gap-2 transition-colors ${selectedFolder === f.id ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-bg-hover'}`}>
                    {selectedFolder === f.id ? <FolderOpen size={13} /> : <Folder size={13} />}
                    <span className="truncate">{f.name}</span>
                  </button>
                  <button type="button" onClick={() => deleteFolder(f.id)} title="Ordner löschen"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded-r transition-all">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Mail-Liste */}
          <div className="w-72 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted">
                {selectedFolder === null ? `${mails.length} Nachrichten` : `${folderItems.length} zugeordnet`}
              </span>
              {selectedFolder === null && (
                <button type="button" onClick={loadMails} disabled={loading} title="Aktualisieren" className="p-1.5 rounded-lg bg-bg-raised border border-theme hover:bg-bg-hover transition-colors">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {selectedFolder === null ? (
                <>
                  {mails.length === 0 && !loading && (
                    <div className="text-muted text-sm text-center py-8">Keine Mails</div>
                  )}
                  {mails.map(mail => (
                    <button
                      key={mail.id}
                      type="button"
                      onClick={() => setSelected(mail)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${selected?.id === mail.id ? 'border-primary bg-primary/10' : 'border-theme bg-bg-raised hover:bg-bg-hover'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Mail size={12} className="text-primary flex-shrink-0" />
                        <span className="text-xs text-muted truncate">{mail.from}</span>
                      </div>
                      <div className="text-sm font-medium truncate">{mail.subject}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted">{mail.date ? new Date(mail.date).toLocaleString('de-DE') : ''}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); deleteMail(mail.id) }} title="Löschen" className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {folderItems.length === 0 && (
                    <div className="text-muted text-sm text-center py-8">Ordner ist leer</div>
                  )}
                  {folderItems.map(item => {
                    const mail = mails.find(m => String(m.id) === item.mail_uid)
                    return (
                      <div key={item.mail_uid} className={`p-3 rounded-lg border transition-colors cursor-pointer ${selected && String(selected.id) === item.mail_uid ? 'border-primary bg-primary/10' : 'border-theme bg-bg-raised hover:bg-bg-hover'}`}
                        onClick={() => mail && setSelected(mail)}>
                        <div className="flex items-center gap-2 mb-1">
                          <Mail size={12} className="text-primary flex-shrink-0" />
                          <span className="text-xs text-muted truncate">{(item as any).mail_from || '?'}</span>
                        </div>
                        <div className="text-sm font-medium truncate">{(item as any).mail_subject || '(kein Betreff)'}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted">{(item as any).mail_date ? new Date((item as any).mail_date).toLocaleString('de-DE') : ''}</span>
                          <button type="button" onClick={e => { e.stopPropagation(); unassignFromFolder(item.mail_uid, selectedFolder!) }}
                            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Aus Ordner entfernen">
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Mail-Detail */}
          <div className="flex-1 rounded-xl border border-theme bg-bg-raised p-6">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-muted">
                <div className="text-center">
                  <Mail size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Mail auswählen</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 pb-4 border-b border-theme">
                  <h3 className="text-lg font-bold mb-2">{selected.subject}</h3>
                  <div className="text-sm text-muted space-y-1">
                    <div><span className="font-medium">Von:</span> {selected.from}</div>
                    <div><span className="font-medium">Datum:</span> {selected.date ? new Date(selected.date).toLocaleString('de-DE') : ''}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => replyTo(selected)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-white hover:bg-primary/80 transition-colors">
                      <Send size={13} /> Antworten
                    </button>
                    <button type="button" onClick={() => forwardMail(selected)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-bg-raised border border-theme hover:bg-bg-hover transition-colors">
                      <Forward size={13} /> Weiterleiten
                    </button>
                    {folders.length > 0 && (
                      <select title="Mail einem Ordner zuordnen" onChange={e => { if (e.target.value) assignToFolder(selected, Number(e.target.value)); e.target.value = '' }}
                        className="admin-input text-sm py-1 px-2">
                        <option value="">In Ordner…</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    )}
                    <button type="button" onClick={() => deleteMail(selected.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                      <Trash2 size={13} /> Löschen
                    </button>
                  </div>
                  {assignMsg && (
                    <div className="mt-2 text-xs text-green-600 bg-green-500/10 px-3 py-1.5 rounded-lg">{assignMsg}</div>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {selected.text || '(kein Text)'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'templates' && (
        <div>
          {tmplView === 'list' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-secondary">
                  Vorlagen werden beim Versand aus <strong>Händler-Anfragen</strong> verwendet.<br />
                  <span className="text-muted text-xs">Platzhalter: <code className="bg-bg-raised px-1 rounded">{'{{name}}'}</code> <code className="bg-bg-raised px-1 rounded">{'{{event}}'}</code> <code className="bg-bg-raised px-1 rounded">{'{{datum}}'}</code> <code className="bg-bg-raised px-1 rounded">{'{{meters}}'}</code> <code className="bg-bg-raised px-1 rounded">{'{{tcg}}'}</code></span>
                </p>
                <button type="button" onClick={() => { setEditTmpl({ type: 'custom', name: '', subject: '', body: '' }); setTmplView('edit') }}
                  className="flex items-center gap-2 btn-primary text-sm">
                  <Plus size={14} /> Neue Vorlage
                </button>
              </div>
              {templates.length === 0 ? (
                <div className="admin-card text-center py-10">
                  <FileText size={36} className="mx-auto mb-3 text-muted opacity-30" />
                  <p className="text-secondary text-sm">Noch keine Vorlagen. Erstelle z.B. „Vertrag", „Rechnung" oder „Veranstaltungsinfos".</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {templates.map(t => (
                    <div key={t.id} className="admin-card p-0 overflow-hidden">
                      <button type="button" onClick={() => setExpandedTmpl(expandedTmpl === t.id ? null : t.id)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={15} className="text-accent-purple shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm section-title">{t.name}</p>
                            <p className="text-muted text-xs truncate">{t.subject}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button type="button" title="Vorlage bearbeiten" onClick={e => { e.stopPropagation(); setEditTmpl(t); setTmplView('edit') }}
                            className="p-1.5 rounded-lg text-muted hover:text-accent-purple hover:bg-accent-purple/10 transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button type="button" title="Vorlage löschen" onClick={e => { e.stopPropagation(); deleteTmpl(t.id, t.name) }}
                            className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                          {expandedTmpl === t.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                        </div>
                      </button>
                      {expandedTmpl === t.id && (
                        <div className="px-4 pb-4 border-t border-theme pt-3">
                          <p className="text-xs text-muted mb-1">Vorschau:</p>
                          <p className="text-sm font-medium mb-1">Betreff: {t.subject}</p>
                          <pre className="text-xs text-secondary whitespace-pre-wrap bg-bg-raised rounded-lg p-3 max-h-48 overflow-y-auto">{t.body}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={saveTmpl} className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button type="button" onClick={() => { setTmplView('list'); setEditTmpl(null) }}
                  className="text-sm text-muted hover:text-primary transition-colors">← Zurück</button>
                <h3 className="font-semibold section-title">{editTmpl?.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name der Vorlage</label>
                  <input type="text" required value={editTmpl?.name ?? ''} onChange={e => setEditTmpl(p => ({ ...p!, name: e.target.value }))}
                    className="admin-input w-full" placeholder="z.B. Vertrag, Rechnung, Veranstaltungsinfos" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Typ</label>
                  <select title="Vorlagen-Typ" value={editTmpl?.type ?? 'custom'} onChange={e => setEditTmpl(p => ({ ...p!, type: e.target.value }))}
                    className="admin-input w-full">
                    <option value="custom">📄 Text-Mail</option>
                    <option value="pdf">📎 Mit PDF-Anhang</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Betreff</label>
                <input type="text" required value={editTmpl?.subject ?? ''} onChange={e => setEditTmpl(p => ({ ...p!, subject: e.target.value }))}
                  className="admin-input w-full" placeholder="z.B. Dein Händlervertrag – {{event}}" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Text</label>
                <textarea required rows={14} value={editTmpl?.body ?? ''} onChange={e => setEditTmpl(p => ({ ...p!, body: e.target.value }))}
                  className="admin-input w-full font-mono text-sm"
                  placeholder={`Hallo {{name}},\n\nhiermit senden wir dir den Händlervertrag für die {{event}} am {{datum}}.\n\nDeine gebuchte Standfläche: {{meters}}\n\nViele Grüße\nDas ShinyFam-Team`} />
                <p className="text-xs text-muted mt-1">Platzhalter: {'{{name}}'} {'{{event}}'} {'{{datum}}'} {'{{meters}}'} {'{{tcg}}'}</p>
              </div>
              <button type="submit" disabled={tmplSaving} className="flex items-center gap-2 btn-primary">
                {tmplSaving ? 'Speichert…' : 'Vorlage speichern'}
              </button>
            </form>
          )}
        </div>
      )}

      {view === 'dunning' && <AdminDunning token={token} />}

      {view === 'compose' && (
        <form onSubmit={sendMail} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">An</label>
            <input type="email" value={to} onChange={e => setTo(e.target.value)} required className="admin-input w-full" placeholder="empfaenger@beispiel.de" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Betreff</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className="admin-input w-full" placeholder="Betreff eingeben" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nachricht</label>
            <textarea value={text} onChange={e => setText(e.target.value)} required rows={10} className="admin-input w-full font-mono text-sm" placeholder="Nachricht eingeben" />
          </div>
          {sendMsg && (
            <div className={`text-sm p-3 rounded-lg ${sendMsg.startsWith('Fehler') ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'}`}>
              {sendMsg}
            </div>
          )}
          <button type="submit" disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50">
            <Send size={14} /> {sending ? 'Sende...' : 'Senden'}
          </button>
        </form>
      )}
    </div>
  )
}
