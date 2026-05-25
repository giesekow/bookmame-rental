import { $MI, AppManager, Menu } from 'vuetify-extended';
import { rentalAccess, rentalHasAccess } from '../misc/access';
import { RENTAL_DASHBOARD_WIDGET } from '../pages/dashboard';
import { rentalDeliveryPartnersMenu } from '../pages/delivery-partners';
import { rentalFinanceSummaryReport } from '../pages/finance-summary';
import { rentalInventoryCollection, rentalInventoryMenu } from '../pages/inventory';
import { rentalInventoryCalendarSelector } from '../pages/inventory-calendar';
import { openInventoryCatalogDialog } from '../misc/inventory-catalog';
import { rentalNotificationPreferencesReport } from '../pages/notification-preferences';
import { rentalDeliverySettingsReport } from '../pages/delivery-settings';
import { rentalProfileReport } from '../pages/profile';
import { rentalRatingsCollection } from '../pages/ratings';
import { rentalReservationsCollection } from '../pages/reservations';
import { rentalStaffMenu } from '../pages/staff';
import { supportCasesCollection } from '../pages/support-cases';
import { rentalCancellationRefundsCollection } from '../pages/cancellation-refunds';
import { rentalRemittanceBatchesCollection, rentalSettlementBatchesCollection } from '../pages/settlement-batches';
import { rentalRemittanceHistoryCollection, rentalSettlementHistoryCollection } from '../pages/settlement-history';

export function buildHomeMenu() {
  return new Menu(
    {
      title: 'Rental Workspace',
      cols: 12,
      width: 320,
    },
    {
      children: async () => [
        $MI({
          text: 'Dashboard',
          icon: 'mdi-view-dashboard-outline',
          shortcut: 'D',
          action: 'function',
          color: 'warning',
        }, {
          callback: async () => {
            AppManager.showUI(RENTAL_DASHBOARD_WIDGET);
          },
          access: rentalAccess('rental.dashboard.view'),
        }),
        $MI({
          text: 'Inventory',
          icon: 'mdi-package-variant-closed',
          shortcut: 'I',
          action: 'menu',
          color: 'primary',
        }, {
          menu: rentalInventoryMenu,
          access: rentalAccess('rental.inventory.view'),
        }),
        $MI({
          text: 'Print Inventory Catalog',
          icon: 'mdi-printer-outline',
          shortcut: 'P',
          action: 'function',
          color: 'error',
        }, {
          callback: async () => { openInventoryCatalogDialog() },
          access: rentalAccess('rental.inventory.view'),
        }),
        $MI({
          text: 'Inventory Calendar',
          icon: 'mdi-calendar-blank-outline',
          shortcut: 'C',
          action: 'function',
          color: 'secondary',
        }, {
          callback: async () => {
            const selector = rentalInventoryCalendarSelector()
            AppManager.showSelector(selector)
          },
          access: rentalAccess('rental.inventory.view'),
        }),
        $MI({
          text: 'Reservations',
          icon: 'mdi-calendar-clock-outline',
          shortcut: 'R',
          action: 'collection',
          mode: 'display',
          color: 'info',
        }, {
          collection: rentalReservationsCollection(),
          access: rentalAccess('rental.reservations.view'),
        }),
        $MI({
          text: 'Ratings',
          icon: 'mdi-star-circle-outline',
          shortcut: 'A',
          action: 'collection',
          mode: 'display',
          color: 'info',
        }, {
          collection: rentalRatingsCollection,
          access: rentalAccess('rental.reservations.view'),
        }),
        $MI({
          text: 'Support Cases',
          icon: 'mdi-lifebuoy',
          shortcut: 'U',
          action: 'collection',
          mode: 'display',
          color: 'warning',
        }, {
          collection: supportCasesCollection,
          access: rentalAccess('rental.support_cases.view'),
        }),
        $MI({
          text: 'Finance',
          icon: 'mdi-currency-usd',
          shortcut: 'F',
          action: 'menu',
          color: 'secondary',
        }, {
          menu: buildFinanceMenu,
          access: rentalAccess('rental.finance.view'),
        }),
        $MI({
          text: 'Settings',
          icon: 'mdi-cog-outline',
          shortcut: 'S',
          action: 'menu',
          color: 'warning',
        }, {
          menu: buildSettingsMenu,
          access: async () =>
            (await rentalHasAccess('rental.profile.view')) ||
            (await rentalHasAccess('rental.staff.manage')) ||
            (await rentalHasAccess('rental.notifications.view')),
        }),
      ],
    },
  );
}

const buildFinanceMenu = () => new Menu(
  {
    title: 'Finance',
    cols: 12,
    width: 320,
  },
  {
    children: async () => [
      $MI({
        text: 'Finance Summary',
        icon: 'mdi-cash-register',
        shortcut: 'F',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: rentalFinanceSummaryReport,
        access: rentalAccess('rental.finance.view'),
      }),
      $MI({
        text: 'Settlement Batches',
        icon: 'mdi-cash-sync',
        shortcut: 'B',
        action: 'collection',
        mode: 'display',
        color: 'warning',
      }, {
        collection: rentalSettlementBatchesCollection,
        access: rentalAccess('rental.finance.view'),
      }),
      $MI({
        text: 'Remittance Batches',
        icon: 'mdi-cash-refund',
        shortcut: 'R',
        action: 'collection',
        mode: 'display',
        color: 'info',
      }, {
        collection: rentalRemittanceBatchesCollection,
        access: rentalAccess('rental.finance.view'),
      }),
      $MI({
        text: 'Remittance History',
        icon: 'mdi-history',
        shortcut: 'Y',
        action: 'collection',
        mode: 'display',
        color: 'secondary',
      }, {
        collection: rentalRemittanceHistoryCollection,
        access: rentalAccess('rental.finance.view'),
      }),
      $MI({
        text: 'Settlement History',
        icon: 'mdi-bank-transfer',
        shortcut: 'T',
        action: 'collection',
        mode: 'display',
        color: 'secondary',
      }, {
        collection: rentalSettlementHistoryCollection,
        access: rentalAccess('rental.finance.view'),
      }),
      $MI({
        text: 'Cancellation Refunds',
        icon: 'mdi-cash-remove',
        shortcut: 'C',
        action: 'collection',
        mode: 'display',
        color: 'error',
      }, {
        collection: rentalCancellationRefundsCollection,
        access: rentalAccess('rental.finance.view'),
      }),
    ],
  },
);

const buildSettingsMenu = () => new Menu(
  {
    title: 'Settings',
    cols: 12,
    width: 320,
  },
  {
    children: async () => [
      $MI({
        text: 'Profile',
        icon: 'mdi-domain',
        shortcut: 'P',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: rentalProfileReport,
        access: rentalAccess('rental.profile.view'),
      }),
      $MI({
        text: 'Delivery Partners',
        icon: 'mdi-truck-delivery-outline',
        shortcut: 'L',
        action: 'menu',
        color: 'success',
      }, {
        menu: rentalDeliveryPartnersMenu,
        access: rentalAccess('rental.delivery_partners.manage'),
      }),
      $MI({
        text: 'Delivery Settings',
        icon: 'mdi-truck-check-outline',
        shortcut: 'V',
        action: 'report',
        mode: 'display',
        color: 'primary',
      }, {
        report: rentalDeliverySettingsReport,
        access: rentalAccess('rental.profile.view'),
      }),
      $MI({
        text: 'Staff',
        icon: 'mdi-account-group-outline',
        shortcut: 'T',
        action: 'menu',
        color: 'info',
      }, {
        menu: rentalStaffMenu,
        access: rentalAccess('rental.staff.manage'),
      }),
      $MI({
        text: 'Notifications',
        icon: 'mdi-bell-ring-outline',
        shortcut: 'N',
        action: 'report',
        mode: 'display',
        color: 'secondary',
      }, {
        report: rentalNotificationPreferencesReport,
        access: rentalAccess('rental.notifications.view'),
      }),
    ],
  },
);
