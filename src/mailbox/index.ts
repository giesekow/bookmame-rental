import { Api, AppManager, Dialogs, Mailbox, type MailboxItem } from 'vuetify-extended'
import { rentalReservationsReport } from '../pages/reservations'

const APP_CLIENT_ID = 'bookmame-rental'
const SOCKET_EVENT_REF = Symbol('bookmame-rental-mailbox-events')
const SOCKET_CONNECT_REF = Symbol('bookmame-rental-mailbox-connect')

type NotificationRecord = {
  id: string
  title: string
  body?: string | null
  icon?: string | null
  category?: string | null
  targetApp?: string | null
  sourceService?: string | null
  sourceEntityId?: string | null
  createdAt?: string | null
  readAt?: string | null
  read?: boolean
}

let configured = false
let socketBound = false

function hasUsableApiSession() {
  return Boolean(Api.instance.tokenRef?.value && Api.instance.userRef?.value)
}

function normalizeItems(payload: any): NotificationRecord[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && Array.isArray(payload.data)) {
    return payload.data
  }

  if (payload && Array.isArray(payload.items)) {
    return payload.items
  }

  if (payload?.data && Array.isArray(payload.data.data)) {
    return payload.data.data
  }

  if (payload?.data && Array.isArray(payload.data.items)) {
    return payload.data.items
  }

  return []
}

function toMailboxItem(notification: NotificationRecord): MailboxItem {
  return {
    id: notification.id,
    title: notification.title || 'Rental notification',
    text: notification.body || 'Open this message to view the reservation update.',
    timestamp: notification.createdAt || undefined,
    read: Boolean(notification.read || notification.readAt),
    category: notification.category || undefined,
    icon: notification.icon || 'mdi-bell-outline',
    meta: { raw: notification },
  }
}

function getReservationIdFromNotification(item: MailboxItem) {
  const raw = item?.meta?.raw as NotificationRecord | undefined

  if (!raw?.sourceEntityId) {
    return null
  }

  const sourceService = String(raw.sourceService || '')
  if (!sourceService.includes('/reservations')) {
    return null
  }

  return String(raw.sourceEntityId)
}

async function loadMailboxPage({ page, pageSize }: { page: number; pageSize: number }) {
  if (!hasUsableApiSession()) {
    return { items: [], total: 0 }
  }

  const response = await Api.instance.service('notifications').find({
    query: {
      targetApp: APP_CLIENT_ID,
      $paginate: false,
      $sort: {
        createdAt: -1,
      },
    },
  }) as any

  const allItems = normalizeItems(response).map(toMailboxItem)
  const skip = Math.max(0, (page - 1) * pageSize)

  return {
    items: allItems.slice(skip, skip + pageSize),
    total: allItems.length,
  }
}

async function loadUnreadCount() {
  if (!hasUsableApiSession()) {
    return 0
  }

  const response = await Api.instance.service('notifications/unread-count').find({
    query: {
      targetApp: APP_CLIENT_ID,
    },
  }) as any

  return Number(response?.unreadCount || 0)
}

async function markRead(item: MailboxItem) {
  await Api.instance.service(`notifications/${item.id}/read`).patch('', {})
}

async function markReadMany(items: MailboxItem[]) {
  await Api.instance.service('notifications/read-many').patch('', {
    ids: items.map((item) => item.id),
  })
}

async function markUnread(item: MailboxItem) {
  await Api.instance.service(`notifications/${item.id}/unread`).patch('', {})
}

async function remove(item: MailboxItem) {
  await Api.instance.service(`notifications/${item.id}/remove`).patch('', {})
}

async function removeMany(items: MailboxItem[]) {
  await Api.instance.service('notifications/remove-many').patch('', {
    ids: items.map((item) => item.id),
  })
}

async function viewItem(item: MailboxItem) {
  const reservationId = getReservationIdFromNotification(item)

  if (reservationId) {
    const report = rentalReservationsReport(reservationId)()
    report.$params.mode = 'display'
    await report.$master?.$load()
    AppManager.showReport(report)
    return undefined
  }

  await Dialogs.$info(item.text || 'No additional details available.', item.title, {
    width: 720,
    height: 420,
  })
  return undefined
}

function bindRealtime() {
  if (socketBound) {
    return
  }

  ;(Api.instance as any).on?.(
    'socket:event',
    (routed: any) => {
      if (routed?.service !== 'notifications') {
        return
      }

      if (routed?.data?.targetApp && routed.data.targetApp !== APP_CLIENT_ID) {
        return
      }

      if (routed?.event === 'created' && routed?.data) {
        Mailbox.push(toMailboxItem(routed.data))
        return
      }

      if (Mailbox.$loaded) {
        void Mailbox.refresh()
      } else {
        void Mailbox.refreshUnreadCount()
      }
    },
    SOCKET_EVENT_REF,
  )

  ;(Api.instance as any).on?.(
    'socket:connect',
    () => {
      if (Mailbox.$loaded) {
        void Mailbox.refresh()
      } else {
        void Mailbox.refreshUnreadCount()
      }
    },
    SOCKET_CONNECT_REF,
  )

  socketBound = true
}

export function initializeMailbox() {
  if (!configured) {
    Mailbox.configure(
      {
        title: 'Rental Mailbox',
        pageSize: 8,
        load: loadMailboxPage,
        loadUnreadCount,
        markRead,
        markReadMany,
        markUnread,
        remove,
        removeMany,
        viewItem,
      },
      true,
    )

    configured = true
  }

  bindRealtime()

  if (Mailbox.$loaded) {
    void Mailbox.refresh()
  } else {
    void Mailbox.refreshUnreadCount()
  }
}
