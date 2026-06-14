import { $DALW, $DB, $DMW, $DTW, $MI, Api, AppManager } from 'vuetify-extended';
import { rentalHasAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';
import { rentalFinanceSummaryReport } from '../finance-summary';
import { rentalRatingsCollection } from '../ratings';
import { rentalReservationsCollection, rentalReservationsReport } from '../reservations';
import { supportCasesCollection } from '../support-cases';

type DashboardSummary = {
  pendingReviewCount: number;
  inProgressCount: number;
  completedCount: number;
  averageRating: number | null;
  ratingCount: number;
  openSupportCaseCount: number;
  readyForManualPayoutAmount?: number;
  payoutInitiatedAmount?: number;
  readyForManualRemittanceAmount?: number;
  netSettlementPosition?: number;
  paidTodayAmount?: number;
  paidTodayCount?: number;
  currency?: string | null;
};

let dashboardSummaryPromise: Promise<DashboardSummary> | null = null;
let dashboardSummaryLoadedAt = 0;
const DASHBOARD_SUMMARY_CACHE_MS = 15000;

type PaginatedResult<T> = {
  items: T[];
  total: number;
};

function currentProvider() {
  return useAppStore().rentalProvider || null;
}

function providerId() {
  return currentProvider()?.id || null;
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch (_error) {
    return date.toISOString();
  }
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateInput() {
  return formatDateInput(new Date());
}

function normalizeFindResult<T>(response: any): PaginatedResult<T> {
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      total: response.length,
    };
  }

  if (Array.isArray(response?.data)) {
    return {
      items: response.data as T[],
      total: Number(response?.total ?? response.data.length ?? 0),
    };
  }

  if (Array.isArray(response?.items)) {
    return {
      items: response.items as T[],
      total: Number(response?.total ?? response.items.length ?? 0),
    };
  }

  return {
    items: [],
    total: 0,
  };
}

async function safeFind<T>(servicePath: string, query: Record<string, any>): Promise<PaginatedResult<T>> {
  try {
    const response = await Api.instance.service(servicePath).find({ query });
    return normalizeFindResult<T>(response);
  } catch (error: any) {
    console.error(`[rental-dashboard] Failed to load ${servicePath}`, error);
    return {
      items: [],
      total: 0,
    };
  }
}

async function loadDashboardSummary(force = false) {
  const rentalProviderId = providerId();
  if (!rentalProviderId) {
    return {
      pendingReviewCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      averageRating: null,
      ratingCount: 0,
      openSupportCaseCount: 0,
      readyForManualPayoutAmount: 0,
      payoutInitiatedAmount: 0,
      readyForManualRemittanceAmount: 0,
      netSettlementPosition: 0,
      paidTodayAmount: 0,
      paidTodayCount: 0,
      currency: currentProvider()?.defaultCurrencyCode || null,
    };
  }

  const cacheExpired = (Date.now() - dashboardSummaryLoadedAt) > DASHBOARD_SUMMARY_CACHE_MS;

  if (force || !dashboardSummaryPromise || cacheExpired) {
    dashboardSummaryPromise = (async () => {
      const summary = await Api.instance.service(`rental-providers/${rentalProviderId}/dashboard/summary`).find() as DashboardSummary;
      return summary || {
        pendingReviewCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        averageRating: null,
        ratingCount: 0,
        openSupportCaseCount: 0,
        readyForManualPayoutAmount: 0,
        payoutInitiatedAmount: 0,
        readyForManualRemittanceAmount: 0,
        netSettlementPosition: 0,
        paidTodayAmount: 0,
        paidTodayCount: 0,
        currency: currentProvider()?.defaultCurrencyCode || null,
      };
    })();
    dashboardSummaryLoadedAt = Date.now();
  }

  return dashboardSummaryPromise;
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

function ratingValue(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `${value.toFixed(1)}/5`
    : 'No ratings yet';
}

export function openReservationsCollection() {
  AppManager.showCollection(rentalReservationsCollection()());
}

async function loadReservationsDueTodayCount() {
  const currentRentalProviderId = providerId();
  if (!currentRentalProviderId) {
    return 0;
  }

  const response = await Api.instance.service(`rental-providers/${currentRentalProviderId}/reservations`).find({
    query: {
      dueDateFrom: todayDateInput(),
      dueDateTo: todayDateInput(),
      $limit: 1,
      $skip: 0,
    },
  }) as any;

  return Number(response?.total ?? response?.length ?? 0);
}

export function openReservationsDueTodayCollection() {
  const today = todayDateInput();
  AppManager.showCollection(rentalReservationsCollection({
    dueDateFrom: today,
    dueDateTo: today,
  })());
}

export function openReservation(reservationId?: string) {
  if (!reservationId) {
    openReservationsCollection();
    return;
  }

  const report = rentalReservationsReport(reservationId)();
  report.$params.mode = 'display';
  AppManager.showReport(report);
}

export function openRatingsCollection() {
  AppManager.showCollection(rentalRatingsCollection());
}

export function openSupportCasesCollection() {
  AppManager.showCollection(supportCasesCollection());
}

export function openFinanceSummaryReport() {
  AppManager.showReport(rentalFinanceSummaryReport());
}

export const RENTAL_DASHBOARD_WIDGET = $DB({
  title: 'Dashboard',
  subtitle: 'Operational visibility for reservations, customer feedback, support cases, payouts, and the currently selected rental provider.',
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
        dashboardSummaryPromise = null;
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
      title: 'Reservations Due Today',
      subtitle: 'Pickups or deliveries due on the current date.',
      icon: 'mdi-calendar-today-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => loadReservationsDueTodayCount(),
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openReservationsDueTodayCollection();
        }
      },
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
      value: async () => (await loadDashboardSummary()).pendingReviewCount,
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openReservationsCollection();
        }
      },
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
      value: async () => (await loadDashboardSummary()).inProgressCount,
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openReservationsCollection();
        }
      },
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
      value: async () => (await loadDashboardSummary()).completedCount,
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openReservationsCollection();
        }
      },
    }),
    $DMW({
      title: 'Average Rating',
      subtitle: 'Current customer review score for the active provider.',
      icon: 'mdi-star-circle-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => ratingValue((await loadDashboardSummary()).averageRating),
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openRatingsCollection();
        }
      },
    }),
    $DMW({
      title: 'Ratings',
      subtitle: 'Total reviews received from customers.',
      icon: 'mdi-star-box-multiple-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => (await loadDashboardSummary()).ratingCount,
      onClicked: async () => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openRatingsCollection();
        }
      },
    }),
    $DMW({
      title: 'Open Support Cases',
      subtitle: 'Customer issues that still need provider attention.',
      icon: 'mdi-lifebuoy',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff3f0',
      cardStyle: { border: '1px solid #f2d0c6' },
    }, {
      value: async () => (await loadDashboardSummary()).openSupportCaseCount,
      onClicked: async () => {
        if (await rentalHasAccess('rental.support_cases.view')) {
          openSupportCasesCollection();
        }
      },
    }),
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
        const summary = await loadDashboardSummary();
        return money(summary?.readyForManualPayoutAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
      onClicked: async () => {
        if (await rentalHasAccess('rental.finance.view')) {
          openFinanceSummaryReport();
        }
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
        const summary = await loadDashboardSummary();
        return money(summary?.payoutInitiatedAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
      onClicked: async () => {
        if (await rentalHasAccess('rental.finance.view')) {
          openFinanceSummaryReport();
        }
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
        const summary = await loadDashboardSummary();
        return money(summary?.readyForManualRemittanceAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
      onClicked: async () => {
        if (await rentalHasAccess('rental.finance.view')) {
          openFinanceSummaryReport();
        }
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
        const summary = await loadDashboardSummary();
        return money(summary?.netSettlementPosition, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
      onClicked: async () => {
        if (await rentalHasAccess('rental.finance.view')) {
          openFinanceSummaryReport();
        }
      },
    }),
    $DMW({
      title: 'Paid Today',
      subtitle: 'Net payout amount settled to this rental provider today.',
      icon: 'mdi-bank-transfer-out',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary();
        return money(summary?.paidTodayAmount, summary?.currency || currentProvider()?.defaultCurrencyCode);
      },
      onClicked: async () => {
        if (await rentalHasAccess('rental.finance.view')) {
          openFinanceSummaryReport();
        }
      },
    }),
  ],
  children: () => [
    $DTW({
      title: 'Reservations Due Today',
      subtitle: 'Pickups or deliveries scheduled for today.',
      icon: 'mdi-calendar-today-outline',
      cols: 12,
      lg: 8,
      minHeight: 340,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
      emptyText: 'No reservations are due today.',
      headers: [
        { key: 'reservationNumber', title: 'Reservation' },
        { key: 'customerDisplayName', title: 'Customer' },
        { key: 'fulfillmentMethod', title: 'Fulfilment' },
        { key: 'startDateStr', title: 'Start' },
        { key: 'reservationStatus', title: 'Status' },
      ],
      pagination: true,
      pageSize: 10,
    }, {
      loadPage: async (_widget, args) => {
        const currentRentalProviderId = providerId();
        if (!currentRentalProviderId) {
          return { total: 0, items: [] };
        }

        const page = Math.max(1, Number(args?.page || 1));
        const pageSize = Math.max(1, Number(args?.pageSize || 10));
        const skip = (page - 1) * pageSize;
        const today = todayDateInput();
        const result = await safeFind<any>(`rental-providers/${currentRentalProviderId}/reservations`, {
          dueDateFrom: today,
          dueDateTo: today,
          $limit: pageSize,
          $skip: skip,
        });

        return {
          total: result.total,
          items: result.items.map((item: any) => ({
            id: item?.id,
            reservationNumber: item?.reservationNumber || 'Unknown reservation',
            customerDisplayName: item?.customerDisplayName || 'Unknown customer',
            fulfillmentMethod: String(item?.fulfillmentMethod || 'customer_pickup').replace(/_/g, ' '),
            startDateStr: dateTime(item?.startDate),
            reservationStatus: String(item?.reservationStatus || 'n/a').replace(/_/g, ' '),
          })),
        };
      },
      onRowClick: async (_widget, row) => {
        if (await rentalHasAccess('rental.reservations.view')) {
          openReservation(String(row?.id || ''));
        }
      },
    }),
    $DALW({
      title: 'Quick Actions',
      subtitle: 'Jump straight into the rental reports used most often.',
      icon: 'mdi-lightning-bolt-outline',
      cols: 12,
      lg: 4,
      minHeight: 300,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      items: async () => [
        ...(await rentalHasAccess('rental.reservations.view')
          ? [
              {
                key: 'reservations',
                title: 'Open Reservations',
                subtitle: 'Review incoming requests, active rentals, and completed returns.',
                icon: 'mdi-calendar-clock-outline',
                iconColor: '#2563eb',
                chipText: 'Operations',
                chipColor: 'primary',
                actionText: 'Open',
                actionColor: 'primary',
              },
              {
                key: 'ratings',
                title: 'Ratings',
                subtitle: 'Read customer feedback about provider and delivery experience.',
                icon: 'mdi-star-circle-outline',
                iconColor: '#b45309',
                chipText: String((await loadDashboardSummary()).ratingCount || 0),
                chipColor: 'warning',
                actionText: 'Open',
                actionColor: 'warning',
              },
            ]
          : []),
        ...(await rentalHasAccess('rental.support_cases.view')
          ? [
              {
                key: 'support',
                title: 'Support Cases',
                subtitle: 'Respond to customer issues tied to reservations.',
                icon: 'mdi-lifebuoy',
                iconColor: '#dc2626',
                chipText: String((await loadDashboardSummary()).openSupportCaseCount || 0),
                chipColor: 'error',
                actionText: 'Open',
                actionColor: 'error',
              },
            ]
          : []),
        ...(await rentalHasAccess('rental.finance.view')
          ? [{
              key: 'finance',
              title: 'Finance Summary',
              subtitle: 'Track payout readiness, remittance, and current net settlement position.',
              icon: 'mdi-cash-register',
              iconColor: '#166534',
              chipText: 'Finance',
              chipColor: 'success',
              actionText: 'Open',
              actionColor: 'success',
            }]
          : []),
      ],
      onItemClicked: async (_widget, item) => {
        switch (item?.key) {
          case 'reservations':
            openReservationsCollection();
            return;
          case 'ratings':
            openRatingsCollection();
            return;
          case 'support':
            openSupportCasesCollection();
            return;
          case 'finance':
            openFinanceSummaryReport();
            return;
          default:
            return;
        }
      },
    }),
  ],
  setup(dashboard) {
    dashboardSummaryPromise = null;
    void dashboard.refresh();
  },
});

export function applyRentalDashboardThemeMode(mode: 'light' | 'dark') {
  const params = (RENTAL_DASHBOARD_WIDGET as any)?.$params;
  if (!params) return;

  if (mode === 'dark') {
    params.theme = 'dark';
    params.backgroundColor = '#11171d';
    params.backgroundGradient =
      'radial-gradient(circle at top left, rgba(232,122,63,0.18), transparent 30%), radial-gradient(circle at 85% 15%, rgba(242,195,91,0.14), transparent 24%), radial-gradient(circle at bottom right, rgba(45,143,122,0.16), transparent 26%), linear-gradient(180deg, #1a2027 0%, #151b22 46%, #11171d 100%)';
    params.textColor = '#e2e8f0';
    return;
  }

  params.theme = 'light';
  params.backgroundColor = '#fbf8f4';
  params.backgroundGradient = 'linear-gradient(180deg, rgba(255,252,248,0.98) 0%, rgba(246,240,231,0.94) 100%)';
  params.textColor = '#3b2a18';
}
