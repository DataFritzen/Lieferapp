self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || '🛒 Neue Bestellung!', {
      body: data.body || 'Eine neue Bestellung ist eingegangen.',
      icon: '/app-icon.png',
      badge: '/app-icon.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
