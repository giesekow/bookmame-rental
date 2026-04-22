import { $DB, $DMW, $MI, Api } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function currentProvider() {
  return useAppStore().rentalProvider || null;
}

function providerId() {
  return currentProvider()?.id || null;
}

async function loadReservationCount(statuses: string[]) {
  const rentalProviderId = providerId();
  if (!rentalProviderId) {
    return 0;
  }

  const result = await Api.instance.service(`rental-providers/${rentalProviderId}/reservations`).find({
    query: {
      reservationStatus: { $in: statuses },
      $limit: 1,
      $skip: 0,
    },
  });

  return Number(result?.total ?? result?.length ?? 0);
}

async function loadFinanceSummary() {
  const rentalProviderId = providerId();
  if (!rentalProviderId) {
    return null;
  }

  return Api.instance.service(`rental-providers/${rentalProviderId}/settlements/summary`).find({
    query: {
      $limit: 1,
      $skip: 0,
      currency: currentProvider()?.defaultCurrencyCode || undefined,
    },
  });
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0);
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD';

  try {
    if (!Number.isFinite(amount) || amount === 0) {
      return '0.00';
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount / 100);
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`;
  }
}

export const RENTAL_DASHBOARD_WIDGET = $DB({
  title: 'Dashboard',
  subtitle: 'Operational visibility for reservations, payouts, remittances, and the currently selected rental provider.',
  fluid: true,
  theme: 'light',
  backgroundColor: '#fbf8f4',
  backgroundGradient: 'linear-gradient(180deg, rgba(255,252,248,0.98) 0%, rgba(246,240,231,0.94) 100%)',
  textColor: '#3b2a18',
}, {
  menuItems: () => [
    $MI({
      text: 'Refresh',
      icon: 'mdi-refresh',
      action: 'function',
      color: 'primary',
    }, {
      callback: async () => {
        await useAppStore().switchRentalProvider(currentProvider()?.id);
        await RENTAL_DASHBOARD_WIDGET.refresh();
      },
    }),
  ],
  topChildren: () => [
    $DMW({
      title: 'Selected Provider',
      subtitle: 'The rental provider currently active in this workspace.',
      icon: 'mdi-car-convertible',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => currentProvider()?.name || 'No provider selected',
    }),
    $DMW({
      title: 'Pending Review',
      subtitle: 'Paid reservations that are waiting for provider confirmation.',
      icon: 'mdi-timer-sand',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => loadReservationCount(['requested']),
    }),
    $DMW({
      title: 'In Progress',
      subtitle: 'Confirmed or picked-up reservations that still need provider action.',
      icon: 'mdi-calendar-clock-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => loadReservationCount(['confirmed', 'picked_up']),
    }),
    $DMW({
      title: 'Completed',
      subtitle: 'Reservations already returned and closed operationally.',
      icon: 'mdi-check-decagram-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#e7f7ef',
      cardStyle: { border: '1px solid #a8d9be' },
    }, {
      value: async () => loadReservationCount(['returned']),
    }),
  ],
  bottomChildren: () => [
    $DMW({
      title: 'Ready For Payout',
      subtitle: 'Net amount that is currently eligible for payout to this rental provider.',
      icon: 'mdi-cash-fast',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => {
        const summary = await loadFinanceSummary();
        return money(summary?.readyForManualPayoutAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
    }),
    $DMW({
      title: 'Payout Initiated',
      subtitle: 'Amount already moved into an initiated payout batch.',
      icon: 'mdi-bank-transfer-out',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => {
        const summary = await loadFinanceSummary();
        return money(summary?.payoutInitiatedAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
    }),
    $DMW({
      title: 'Ready For Remittance',
      subtitle: 'Amount that should still be remitted back to the platform.',
      icon: 'mdi-cash-refund',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => {
        const summary = await loadFinanceSummary();
        return money(summary?.readyForManualRemittanceAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
    }),
    $DMW({
      title: 'Net Settlement Position',
      subtitle: 'Current net finance position from rental settlements and remittances.',
      icon: 'mdi-chart-line',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#e7f7ef',
      cardStyle: { border: '1px solid #a8d9be' },
    }, {
      value: async () => {
        const summary = await loadFinanceSummary();
        return money(summary?.netSettlementPosition, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
    }),
  ],
});
