import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, DialogForm, Dialogs, Field, Notifications, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { useAppStore } from '../../store/app'

function getServicePath() {
  const rentalProviderId = useAppStore().rentalProvider?.id

  if (!rentalProviderId) {
    throw new Error('No active rental provider is selected.')
  }

  return `rental-providers/${rentalProviderId}/support-cases`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function label(value?: string | null) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function renderMessages(messages: any[] | undefined) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return `
      <div style="background:#fff; border:1px dashed #e6dcf5; border-radius:14px; padding:16px; color:#74628f;">
        No messages yet.
      </div>
    `
  }

  return `
    <div style="display:grid; gap:12px;">
      ${messages.map((message) => `
        <div style="background:#fff; border:1px solid #e6dcf5; border-radius:16px; padding:14px;">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; margin-bottom:8px;">
            <strong style="color:#2e2b46;">${escapeHtml(message?.senderDisplayName || label(message?.senderType))}</strong>
            <span style="font-size:12px; color:#74628f;">${escapeHtml(dateTime(message?.createdAt))}</span>
          </div>
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:6px;">${escapeHtml(label(message?.senderType))}</div>
          <div style="color:#4b4466; white-space:pre-wrap; word-break:break-word;">${escapeHtml(message?.message || '')}</div>
        </div>
      `).join('')}
    </div>
  `
}

function renderSupportCaseSummary(supportCase: any) {
  const referenceLabel =
    supportCase?.reservationNumber ||
    supportCase?.referenceNumber ||
    'n/a'

  const cards = [
    ['Reference', supportCase?.publicReference || 'n/a'],
    ['Subject', supportCase?.subject || 'n/a'],
    ['Status', label(supportCase?.status)],
    ['Priority', label(supportCase?.priority)],
    ['Reservation', referenceLabel],
    ['Customer', supportCase?.customerDisplayName || supportCase?.customerAccountId || 'n/a'],
    ['Customer Email', supportCase?.customerEmail || 'n/a'],
    ['Delivery Company', supportCase?.deliveryCompanyName || (supportCase?.fulfillmentMethod === 'customer_pickup' ? 'Customer pickup' : 'n/a')],
    ['Placed', dateTime(supportCase?.placedAt)],
    ['Completed', dateTime(supportCase?.deliveredAt)],
    ['Last Message', dateTime(supportCase?.lastMessageAt)],
    ['Created', dateTime(supportCase?.createdAt)],
  ]

  return `
    <div style="font-family:inherit; color:#2e2b46; background:#faf8ff; border:1px solid #e6dcf5; border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#74628f;">Support case</div>
        <div style="margin-top:6px; font-size:22px; font-weight:800;">${escapeHtml(supportCase?.subject || supportCase?.publicReference || 'Support case')}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `<div style="background:#fff; border:1px solid #e6dcf5; border-radius:14px; padding:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:18px; font-weight:800; color:#2e2b46;">${escapeHtml(value)}</div></div>`).join('')}
      </div>
      ${supportCase?.resolutionSummary ? `<div style="margin-top:14px; padding:14px; background:#fff; border:1px solid #e6dcf5; border-radius:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:6px;">Resolution Summary</div><div style="color:#4b4466; white-space:pre-wrap; word-break:break-word;">${escapeHtml(supportCase.resolutionSummary)}</div></div>` : ''}
      <div style="margin-top:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#74628f; margin-bottom:10px;">Conversation</div>
        ${renderMessages(supportCase?.messages)}
      </div>
    </div>
  `
}

async function refreshSupportCaseDetail(report: any) {
  const master = report?.$master
  const supportCaseId = master?.$get?.('id') || master?.$data?.id

  if (!master || !supportCaseId) {
    return
  }

  const refreshed = await Api.instance.service(getServicePath()).get(supportCaseId)
  for (const [key, value] of Object.entries(refreshed || {})) {
    master.$set(key, value)
  }
  master.$set('caseView', renderSupportCaseSummary(master.$data || {}))
  report?.forceRender?.()
}

function openReplyDialog(report: any) {
  const supportCase = report?.$master?.$data || {}
  const supportCaseId = report?.$master?.$get?.('id') || supportCase?.id

  if (!supportCaseId) {
    Dialogs.$error('Open a support case first.')
    return
  }

  const dialog = new DialogForm({}, {
    form: () => $FM({
      title: 'Reply to Customer',
      width: 620,
    }, {
      children: () => [
        $PT({}, {
          children: () => [
            $FD({ label: 'Reference', storage: 'publicReference', readonly: true }, {
              default() {
                return supportCase?.publicReference || ''
              },
            }),
            $FD({ label: 'Message', type: 'textarea', storage: 'message', required: true, cols: 12 }),
          ],
        }),
      ],
      saved: async (form) => {
        try {
          await Api.instance.service(`${getServicePath()}/${supportCaseId}/messages`).create({
            message: String(form.$master?.$get('message') || '').trim(),
          })
          Notifications.$success('Support reply sent.')
          await refreshSupportCaseDetail(report)
          dialog.forceCancel()
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to send the reply.')
        }
      },
    }),
  })

  AppManager.showDialog(dialog)
}

const trigger = () => $TG({
  title: 'Support Cases',
  selectFields: ['publicReference', 'subject', 'status', 'priority', 'reservationNumber', 'customerDisplayName', 'lastMessageAt', 'createdAt', 'id'],
  headers: [
    { title: 'Reference', value: 'publicReference' },
    { title: 'Subject', value: 'subject' },
    { title: 'Status', value: 'status' },
    { title: 'Priority', value: 'priority' },
    { title: 'Reservation', value: 'reservationNumber' },
    { title: 'Customer', value: 'customerDisplayName' },
    { title: 'Last Message', value: 'lastMessageAt' },
  ],
  query: { $sort: { lastMessageAt: -1, createdAt: -1 } },
}, {})

export const supportCaseReport = (supportCaseId?: any) => () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Support Case', storage: 'caseView', type: 'htmlview', readonly: true, cols: 12, minHeight: 500 }, {
      default(field) {
        return renderSupportCaseSummary(field.$master?.$data || {})
      },
    }),
  ]

  return $RP({ title: 'Support Case', objectType: getServicePath(), fluid: true, sideButtonWidth: 260, ...(supportCaseId ? { objectId: supportCaseId } : {}) }, {
    form: () => $FM({ title: 'Support Case', width: 1040 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: rentalAccess('rental.reservations.view'),
    }),
    access: rentalAccess('rental.reservations.view'),
    loaded: async (report) => {
      if (report.$master?.$get('id')) {
        await refreshSupportCaseDetail(report)
      }
    },
    sideButtons: (_props, _context, report) => {
      const supportCase = report?.$master?.$data || {}
      return supportCase?.status === 'closed'
        ? []
        : [
            $BN({
              text: 'Reply',
              icon: 'mdi-reply-outline',
              color: 'primary',
            }, {
              onClicked() {
                openReplyDialog(report)
              },
            }),
          ]
    },
  })
}

export const supportCasesCollection = () => $COL({
  objectType: getServicePath(),
}, {
  trigger,
  report: supportCaseReport(),
  access: rentalAccess('rental.reservations.view'),
})

export const supportCasesMenu = () => makeCollectionMenu({
  title: 'Support Cases',
  collection: supportCasesCollection,
  allowCreate: false,
  allowEdit: false,
  allowDisplay: true,
  access: rentalAccess('rental.reservations.view'),
})
