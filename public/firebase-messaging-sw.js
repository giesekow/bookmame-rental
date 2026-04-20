importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: 'AIzaSyDhCGFA50V0f4-aKLJHHRCahPUX1cSizGE',
  authDomain: 'bookmame.firebaseapp.com',
  projectId: 'bookmame',
  storageBucket: 'bookmame.firebasestorage.app',
  messagingSenderId: '38671540208',
  appId: '1:38671540208:web:b5ae540cca3de7e8108735',
}

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const data = payload?.data || {}
    const title = payload?.notification?.title || data.title || 'Bookmame notification'
    const body = payload?.notification?.body || data.body || ''

    self.registration.showNotification(title, {
      body,
      data,
    })
  })
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification?.data || {}
  event.notification?.close()

  const url = new URL(typeof data.actionTarget === 'string' && data.actionTarget ? data.actionTarget : '/', self.location.origin)
  for (const key of ['notificationId', 'sourceService', 'sourceEntityId', 'actionTarget', 'eventType', 'category']) {
    if (typeof data[key] === 'string' && data[key]) {
      url.searchParams.set(key, data[key])
    }
  }

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })

    for (const client of clientList) {
      client.postMessage({
        type: 'bookmame:notification-click',
        payload: data,
      })
      if ('focus' in client) {
        await client.focus()
        return
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(url.toString())
    }
  })())
})
