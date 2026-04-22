import { $MI, AppManager, Menu } from 'vuetify-extended';
import { rentalAccess } from '../misc/access';
import { RENTAL_DASHBOARD_WIDGET } from '../pages/dashboard';
import { rentalDeliveryPartnersMenu } from '../pages/delivery-partners';
import { rentalFinanceSummaryReport } from '../pages/finance-summary';
import { rentalInventoryCollection, rentalInventoryMenu } from '../pages/inventory';
import { rentalProfileReport } from '../pages/profile';
import { rentalReservationsCollection } from '../pages/reservations';
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
          text: 'Reservations',
          icon: 'mdi-calendar-clock-outline',
          shortcut: 'R',
          action: 'function',
          color: 'info',
        }, {
          callback: async () => {
            AppManager.showCollection(rentalReservationsCollection());
          },
          access: rentalAccess('rental.reservations.view'),
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
          text: 'Profile',
          icon: 'mdi-domain',
          shortcut: 'P',
          action: 'report',
          mode: 'display',
          color: 'warning',
        }, {
          report: rentalProfileReport,
          access: rentalAccess('rental.profile.view'),
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
    ],
  },
);
