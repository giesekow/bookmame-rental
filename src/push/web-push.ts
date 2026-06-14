import { Api, AppManager, Dialogs, Mailbox } from 'vuetify-extended'
import { rentalReservationsReport } from '../pages/reservations'
import { useAppStore } from '../store/app'

declare global {
  interface Window {
    firebase?: any
  }
}

const APP_CLIENT_ID = 'bookmame-rental'
const TOKEN_STORAGE_KEY = 'bookmame.rental.web-push.token'
const DEVICE_ID_STORAGE_KEY = 'bookmame.rental.web-push.device-id'
const FIREBASE_APP_SCRIPT = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'
const FIREBASE_MESSAGING_SCRIPT = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
const PUSH_MESSAGE_EVENT = 'bookmame:notification-click'
const PUSH_QUERY_KEYS = [
  'notificationId',
  'sourceService',
  'sourceEntityId',
  'tenantId',
  'actionTarget',
  'eventType',
  'category',
] as const

let listenersBound = false
let foregroundMessageBound = false
let firebaseLoadPromise: Promise<any> | null = null

function isWebPushCapable() {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    window.isSecureContext === true &&
    'serviceWorker' in navigator &&
    'Notification' in window
  )
}

function hasFirebaseWebPushConfig() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID &&
      import.meta.env.VITE_FIREBASE_VAPID_KEY,
  )
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    return
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const created =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `rental-web-${Date.now()}`

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, created)
  return created
}

function getDeviceName() {
  return [navigator.platform, navigator.userAgent].filter(Boolean).join(' | ').slice(0, 191)
}

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

function buildServiceWorkerUrl() {
  return '/firebase-messaging-sw.js'
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }

      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function loadFirebaseCompat() {
  if (window.firebase?.messaging) {
    return window.firebase
  }

  if (!firebaseLoadPromise) {
    firebaseLoadPromise = (async () => {
      await loadScript(FIREBASE_APP_SCRIPT)
      await loadScript(FIREBASE_MESSAGING_SCRIPT)

      if (!window.firebase?.initializeApp) {
        throw new Error('Firebase messaging scripts failed to initialize.')
      }

      return window.firebase
    })()
  }

  return firebaseLoadPromise
}

async function getWebMessaging() {
  const firebase = await loadFirebaseCompat()

  if (!firebase.apps?.length) {
    firebase.initializeApp(getFirebaseConfig())
  }

  return firebase.messaging()
}

async function showForegroundWebNotification(payload: any) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') {
    return
  }

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    'Bookmame notification'
  const body = payload?.notification?.body || payload?.data?.body || ''
  const data = payload?.data || {}
  const registration = await navigator.serviceWorker.ready

  await registration.showNotification(title, {
    body,
    data,
  })
}

async function registerToken(token: string) {
  await Api.instance.service('notifications/push-device').patch('', {
    token,
    targetApp: APP_CLIENT_ID,
    platform: 'web',
    provider: 'fcm',
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  })

  setStoredToken(token)
}

async function markNotificationRead(notificationId: string) {
  await Api.instance.service(`notifications/${notificationId}/read`).patch('', {})
}

function getTenantIdFromPayload(data: Record<string, unknown>) {
  const tenantId = typeof data.tenantId === 'string' ? data.tenantId.trim() : ''
  return tenantId || null
}

async function ensureTenantAccess(tenantId: string | null) {
  if (!tenantId) {
    return true
  }

  const appStore = useAppStore()
  const accessibleRentalProviders = await appStore.accessibleRentalProviders()
  const hasAccess = accessibleRentalProviders.some((item: any) => String(item?.id || '') === tenantId)

  if (!hasAccess) {
    await Dialogs.$error('You do not have access to the workspace for this notification.')
    return false
  }

  const currentProviderId = String(appStore.rentalProvider?.id || '')
  if (currentProviderId !== tenantId) {
    const switched = await appStore.switchRentalProvider(tenantId)
    if (!switched) {
      await Dialogs.$error('You do not have access to the workspace for this notification.')
      return false
    }
  }

  return true
}

function getReservationIdFromPayload(data: Record<string, unknown>) {
  const sourceService = typeof data.sourceService === 'string' ? data.sourceService : ''
  const sourceEntityId =
    typeof data.sourceEntityId === 'string' ? data.sourceEntityId : ''

  if (!sourceService.includes('/reservations') || !sourceEntityId) {
    return null
  }

  return sourceEntityId
}

async function openRentalReservationReport(reservationId: string) {
  const report = rentalReservationsReport(reservationId)()
  report.$params.mode = 'display'
  await report.$master?.$load().catch(() => undefined)
  AppManager.showReport(report)
}

async function handlePushPayload(data: Record<string, unknown>) {
  const notificationId =
    typeof data.notificationId === 'string' ? data.notificationId : ''

  if (notificationId) {
    await markNotificationRead(notificationId).catch(() => undefined)
  }

  const tenantId = getTenantIdFromPayload(data)
  const tenantAccessGranted = await ensureTenantAccess(tenantId)
  if (!tenantAccessGranted) {
    return
  }

  const reservationId = getReservationIdFromPayload(data)

  if (reservationId) {
    await openRentalReservationReport(reservationId)
  }

  if (Mailbox.$loaded) {
    await Mailbox.refresh().catch(() => undefined)
  } else {
    await Mailbox.refreshUnreadCount().catch(() => undefined)
  }
}

function consumePendingPushPayload() {
  const url = new URL(window.location.href)
  const payload: Record<string, unknown> = {}
  let hasValue = false

  for (const key of PUSH_QUERY_KEYS) {
    const value = url.searchParams.get(key)
    if (value) {
      payload[key] = value
      url.searchParams.delete(key)
      hasValue = true
    }
  }

  if (hasValue) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return hasValue ? payload : null
}

async function bindListeners() {
  if (listenersBound || !isWebPushCapable()) {
    return
  }

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== PUSH_MESSAGE_EVENT || !event.data?.payload) {
      return
    }

    void handlePushPayload(event.data.payload)
  })

  const messaging = await getWebMessaging()

  if (!foregroundMessageBound && typeof messaging.onMessage === 'function') {
    messaging.onMessage((payload: any) => {
      void showForegroundWebNotification(payload)
      if (Mailbox.$loaded) {
        void Mailbox.refresh()
      } else {
        void Mailbox.refreshUnreadCount()
      }
    })
    foregroundMessageBound = true
  }

  const pendingPayload = consumePendingPushPayload()
  if (pendingPayload) {
    void handlePushPayload(pendingPayload)
  }

  listenersBound = true
}

export async function initializeWebPush() {
  if (!isWebPushCapable() || !hasFirebaseWebPushConfig()) {
    return
  }

  await bindListeners()

  let permission = Notification.permission
  if (permission !== 'granted') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    return
  }

  const registration = await navigator.serviceWorker.register(buildServiceWorkerUrl())
  const messaging = await getWebMessaging()
  const token = await messaging.getToken({
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (token) {
    await registerToken(token)
  }
}

export async function unregisterCurrentPushDevice() {
  const token = getStoredToken()

  if (!token || !Api.instance.tokenRef?.value) {
    return
  }

  try {
    await Api.instance.service('notifications/push-device/remove').patch('', {
      token,
      targetApp: APP_CLIENT_ID,
    })
  } catch (_error) {
    // Ignore logout-time unregister failures; the next successful registration rebinds the browser.
  } finally {
    setStoredToken(null)
  }
}
