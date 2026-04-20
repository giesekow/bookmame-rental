import { $MI, AppManager, Menu } from 'vuetify-extended';
import { rentalAccess } from '../misc/access';
import { RENTAL_DASHBOARD_WIDGET } from '../pages/dashboard';
import { rentalFinanceSummaryReport } from '../pages/finance-summary';
import { rentalInventoryCollection } from '../pages/inventory';
import { rentalProfileReport } from '../pages/profile';
import { rentalReservationsCollection } from '../pages/reservations';

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
          action: 'function',
          color: 'primary',
        }, {
          callback: async () => {
            AppManager.showCollection(rentalInventoryCollection());
          },
          access: rentalAccess('rental.inventory.view'),
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
          action: 'report',
          mode: 'display',
          color: 'secondary',
        }, {
          report: rentalFinanceSummaryReport,
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
