self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: 'ShinyFam', body: 'Neue Nachricht' }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ShinyFam', {
      body: data.body || '',
      icon: '/logo.jpg',
      badge: '/logo.jpg',
      tag: data.tag || 'shinyfam',
      data: data.url ? { url: data.url } : {}
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/admin'
  event.waitUntil(clients.openWindow(url))
})
