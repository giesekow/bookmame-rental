import { $BN, $FD, $FM, $PT, $RP, Api, Dialogs, Field, Part } from 'vuetify-extended'
import { rentalAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderSettingsCard(requiresReturn: boolean) {
  const statusBg = requiresReturn ? 'rgba(76,175,80,0.18)' : 'rgba(255,193,7,0.18)'
  const statusBorder = requiresReturn ? 'rgba(76,175,80,0.35)' : 'rgba(255,193,7,0.35)'
  const statusColor = requiresReturn ? '#4caf50' : '#ffc107'
  const statusLabel = requiresReturn ? 'Enabled' : 'Disabled'

  return `
    <div style="display:grid; gap:16px; font-family:inherit;">
      <section style="background:rgba(var(--v-theme-surface),0.85); border:1px solid rgba(var(--v-theme-on-surface),0.14); border-radius:20px; padding:20px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:rgba(var(--v-theme-on-surface),0.6); margin-bottom:8px;">Failed Delivery</div>
        <div style="font-size:20px; font-weight:800; color:rgb(var(--v-theme-on-surface));">Return on failed delivery</div>
        <div style="margin-top:8px; font-size:14px; color:rgba(var(--v-theme-on-surface),0.72);">When enabled, riders must return undelivered rental items to the delivery company depot. The DC will create a return task back to your depot address. When disabled, the reservation delivery is closed as failed and a refund is triggered automatically. Default for rental providers is enabled.</div>
        <div style="margin-top:14px;">
          <span style="display:inline-block; padding:6px 14px; border-radius:999px; background:${escapeHtml(statusBg)}; border:1px solid ${escapeHtml(statusBorder)}; color:${escapeHtml(statusColor)}; font-size:13px; font-weight:700;">${escapeHtml(statusLabel)}</span>
        </div>
      </section>
    </div>
  `
}

let activeReport: any = null

async function loadSettings(report: any) {
  const appStore = useAppStore()
  const rentalProviderId = appStore.rentalProvider?.id

  if (!rentalProviderId || !report?.$master) {
    return
  }

  try {
    const provider = await Api.instance.service('rental-providers').get(rentalProviderId, {
      query: { $select: ['id', 'requiresReturnOnFailedDelivery'] },
    }) as any
    const requiresReturn = Boolean(provider?.requiresReturnOnFailedDelivery ?? true)
    report.$master.$set('settingsView', renderSettingsCard(requiresReturn))
    report.$master.$set('requiresReturnOnFailedDelivery', requiresReturn)
  } catch (error: any) {
    Dialogs.$error(error?.message || 'Failed to load delivery settings.')
  }
}

async function toggleRequiresReturn(report: any) {
  const appStore = useAppStore()
  const rentalProviderId = appStore.rentalProvider?.id

  if (!rentalProviderId || !report?.$master) {
    return
  }

  const current = Boolean(report.$master.$get('requiresReturnOnFailedDelivery', true))
  const next = !current

  const action = next ? 'enable' : 'disable'
  const confirmed = await Dialogs.$confirm(
    `Are you sure you want to ${action} "Return on failed delivery"? ${next ? 'Riders will be required to return undelivered items to the depot.' : 'Failed reservations will be closed immediately and refunds triggered automatically.'}`,
    'Confirm change',
  )
  if (!confirmed) return

  try {
    await Api.instance.service(`rental-providers/${rentalProviderId}/delivery-settings`).patch('', {
      requiresReturnOnFailedDelivery: next,
    })
    await loadSettings(report)
  } catch (error: any) {
    Dialogs.$error(error?.message || 'Failed to update delivery settings.')
  }
}

export const rentalDeliverySettingsReport = () => {
  const fields: (Field | Part)[] = [
    $FD({
      label: 'Settings',
      storage: 'settingsView',
      type: 'htmlview',
      readonly: true,
      cols: 12,
      minHeight: 260,
    }, {
      default() {
        return renderSettingsCard(true)
      },
    }),
  ]

  return $RP({ title: 'Delivery Settings', fluid: true, sideButtonWidth: 280 }, {
    form: () => $FM({ title: 'Delivery Settings', width: 860 }, {
      children: () => [
        $PT({}, {
          children: () => fields,
        }),
      ],
      access: rentalAccess('rental.delivery_partners.manage'),
    }),
    sideButtons: () => [
      $BN({ text: 'Toggle return on failure', color: 'warning' }, {
        async onClicked() {
          if (activeReport) {
            await toggleRequiresReturn(activeReport)
          }
        },
      }),
      $BN({ text: 'Reload', color: 'secondary' }, {
        async onClicked() {
          if (activeReport) {
            await loadSettings(activeReport)
          }
        },
      }),
    ],
    setup(report) {
      activeReport = report
      void loadSettings(report)
    },
    access: rentalAccess('rental.delivery_partners.manage'),
  })
}
