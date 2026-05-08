import { $BN, $FD, $FM, $PT, $RP, Api, Dialogs, Field, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'

const REPORT_TOKEN = 'rental-notification-preferences'
let activePreferenceReport: any = null
let preferenceEventsBound = false

type NotificationPreferenceEntry = {
  eventType: string
  audienceType?: string | null
  category?: string | null
  titleTemplate?: string | null
  bodyTemplate?: string | null
  isCritical?: boolean
  isEnabled?: boolean
  preference?: {
    muted?: boolean | null
    inAppEnabled?: boolean | null
    emailEnabled?: boolean | null
    pushEnabled?: boolean | null
    smsEnabled?: boolean | null
  } | null
  resolvedChannels?: {
    muted?: boolean
    inAppEnabled?: boolean
    emailEnabled?: boolean
    pushEnabled?: boolean
    smsEnabled?: boolean
  } | null
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripTemplateVariables(value: unknown) {
  return String(value ?? '')
    .replace(/\{\{[^}]+\}\}/g, '...')
    .trim()
}

function audienceMatches(entry: NotificationPreferenceEntry) {
  return ['rental_provider', 'user'].includes(String(entry.audienceType || ''))
}

function categoryLabel(entry: NotificationPreferenceEntry) {
  return String(entry.category || 'general').replace(/_/g, ' ')
}

function titleLabel(entry: NotificationPreferenceEntry) {
  const template = stripTemplateVariables(entry.titleTemplate)
  if (template) {
    return template
  }

  return String(entry.eventType || '')
    .split('.')
    .slice(-1)[0]
    .replace(/_/g, ' ')
}

function effectiveValue(
  entry: NotificationPreferenceEntry,
  field: 'muted' | 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'smsEnabled',
) {
  if (field === 'muted') {
    return Boolean(entry.preference?.muted ?? entry.resolvedChannels?.muted)
  }

  return Boolean(entry.preference?.[field] ?? entry.resolvedChannels?.[field] ?? false)
}

function renderToggle(
  entry: NotificationPreferenceEntry,
  field: 'muted' | 'inAppEnabled' | 'emailEnabled' | 'pushEnabled' | 'smsEnabled',
  label: string,
) {
  return `
    <label style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:#fff; border:1px solid #eadfcf; border-radius:12px;">
      <input
        type="checkbox"
        data-notification-preferences="${REPORT_TOKEN}"
        data-event-type="${escapeHtml(entry.eventType)}"
        data-field="${field}"
        ${effectiveValue(entry, field) ? 'checked' : ''}
      />
      <span style="font-size:13px; color:#5f4e43; font-weight:600;">${escapeHtml(label)}</span>
    </label>
  `
}

function renderPreferences(entries: NotificationPreferenceEntry[]) {
  if (entries.length === 0) {
    return '<div style="padding:18px; border:1px solid #eadfcf; border-radius:14px; background:#fff; color:#6f6258;">No rental notification preferences are available yet.</div>'
  }

  return `
    <div style="display:grid; gap:14px; font-family:inherit;">
      ${entries.map((entry) => `
        <section style="background:#fff; border:1px solid #eadfcf; border-radius:18px; padding:18px;">
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <span style="display:inline-block; padding:4px 10px; border-radius:999px; background:#faf2e4; border:1px solid #ead9bb; color:#8a5a12; font-size:12px; font-weight:700;">${escapeHtml(categoryLabel(entry))}</span>
            <span style="display:inline-block; padding:4px 10px; border-radius:999px; background:${entry.isEnabled === false ? '#fff4f4' : '#eef9f1'}; border:1px solid ${entry.isEnabled === false ? '#efc2c2' : '#b9e0c2'}; color:${entry.isEnabled === false ? '#9d2f2f' : '#1f6b36'}; font-size:12px; font-weight:700;">${entry.isEnabled === false ? 'Template disabled' : 'Template enabled'}</span>
            ${entry.isCritical ? '<span style="display:inline-block; padding:4px 10px; border-radius:999px; background:#fff8dd; border:1px solid #ebd58c; color:#8a6500; font-size:12px; font-weight:700;">Critical</span>' : ''}
          </div>
          <div style="font-size:18px; font-weight:800; color:#241a14;">${escapeHtml(titleLabel(entry))}</div>
          <div style="margin-top:4px; font-size:13px; color:#8a7768;">${escapeHtml(entry.eventType)}</div>
          ${entry.bodyTemplate ? `<p style="margin:10px 0 0; color:#5f4e43; font-size:14px;">${escapeHtml(stripTemplateVariables(entry.bodyTemplate))}</p>` : ''}
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:16px;">
            ${renderToggle(entry, 'muted', 'Mute')}
            ${renderToggle(entry, 'inAppEnabled', 'In-App')}
            ${renderToggle(entry, 'emailEnabled', 'Email')}
            ${renderToggle(entry, 'pushEnabled', 'Push')}
            ${renderToggle(entry, 'smsEnabled', 'SMS')}
          </div>
        </section>
      `).join('')}
    </div>
  `
}

async function loadPreferences(report: any) {
  const master = report?.$master

  if (!master) {
    return
  }

  try {
    const response = await Api.instance.service('notifications/preferences').find()
    const items = (Array.isArray(response) ? response : []).filter(audienceMatches)
    master.$set('preferencesView', renderPreferences(items))
  } catch (error: any) {
    Dialogs.$error(error?.message || 'Failed to load notification preferences.')
  }
}

function bindPreferenceEvents() {
  if (preferenceEventsBound || typeof document === 'undefined') {
    return
  }

  preferenceEventsBound = true

  document.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement | null

    if (!target?.matches?.(`input[data-notification-preferences="${REPORT_TOKEN}"]`)) {
      return
    }

    const eventType = String(target.getAttribute('data-event-type') || '').trim()
    const field = String(target.getAttribute('data-field') || '').trim()

    if (!eventType || !field) {
      return
    }

    try {
      await Api.instance.service(`notifications/preferences/${eventType}`).patch('', {
        [field]: target.checked,
      })
      if (activePreferenceReport) {
        await loadPreferences(activePreferenceReport)
      }
    } catch (error: any) {
      target.checked = !target.checked
      Dialogs.$error(error?.message || 'Failed to update notification preference.')
    }
  })
}

export const rentalNotificationPreferencesReport = () => {
  const fields: (Field | Part)[] = [
    $FD({
      label: 'Mailbox Note',
      storage: 'mailboxNote',
      type: 'htmlview',
      readonly: true,
      cols: 12,
    }, {
      default() {
        return `
          <div style="padding:18px; border:1px solid #eadfcf; border-radius:18px; background:#fffaf5; color:#5f4e43;">
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#8a7768; margin-bottom:8px;">Rental mailbox</div>
            <div style="font-size:16px; font-weight:800; color:#241a14;">New reservations and payout updates arrive in the header mailbox.</div>
            <div style="margin-top:8px; font-size:14px;">Use these preferences to control which rental notifications stay visible in-app and which delivery channels remain enabled.</div>
          </div>
        `
      },
    }),
    $FD({
      label: 'Preferences',
      storage: 'preferencesView',
      type: 'htmlview',
      readonly: true,
      cols: 12,
      minHeight: 560,
    }, {
      default() {
        return renderPreferences([])
      },
    }),
  ]

  return $RP({ title: 'Notification Preferences' }, {
    form: () => $FM({ title: 'Notification Preferences', width: 1240 }, {
      children: () => [
        $PT({}, {
          children: () => fields,
        }),
      ],
      access: rentalAccess('rental.notifications.view'),
    }),
    sideButtons: () => [
      $BN({ text: 'Reload', color: 'secondary' }, {
        async onClicked() {
          if (activePreferenceReport) {
            await loadPreferences(activePreferenceReport)
          }
        },
      }),
    ],
    setup(report) {
      activePreferenceReport = report
      bindPreferenceEvents()
      void loadPreferences(report)
    },
    access: rentalAccess('rental.notifications.view'),
  })
}
