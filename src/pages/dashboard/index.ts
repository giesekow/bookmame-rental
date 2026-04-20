import { $DB, $DMW, $MI } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function currentProvider() {
  return useAppStore().rentalProvider || null;
}

function countCountries(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export const RENTAL_DASHBOARD_WIDGET = $DB({
  title: 'Dashboard',
  subtitle: 'Workspace readiness, current rental partner profile, and the first reservation scaffold.',
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
      subtitle: 'The rental workspace currently active in this session.',
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
      title: 'Operational Status',
      subtitle: 'The current lifecycle status configured on the rental provider record.',
      icon: 'mdi-signal-cellular-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => currentProvider()?.status || 'unknown',
    }),
    $DMW({
      title: 'Approval Status',
      subtitle: 'Whether the rental provider is ready for production use.',
      icon: 'mdi-check-decagram-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => currentProvider()?.approvalStatus || 'pending',
    }),
    $DMW({
      title: 'Countries',
      subtitle: 'Number of operating countries already configured on the provider.',
      icon: 'mdi-earth',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => countCountries(currentProvider()?.countryOfOperationCodes),
    }),
  ],
  bottomChildren: () => [
    $DMW({
      title: 'Scaffold Status',
      subtitle: 'The rental app shell, provider switching, and access-aware workspace are now in place.',
      icon: 'mdi-hammer-wrench',
      cols: 12,
      md: 12,
      lg: 6,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => 'Ready for inventory, reservations, and finance slices',
    }),
    $DMW({
      title: 'Next Recommended Slice',
      subtitle: 'The most natural next step is rentable inventory CRUD plus reservation and availability workflows.',
      icon: 'mdi-arrow-right-circle-outline',
      cols: 12,
      md: 12,
      lg: 6,
      color: '#ffffff',
      cardStyle: { border: '1px solid #eadfcf' },
    }, {
      value: async () => 'Inventory + Reservations MVP',
    }),
  ],
});
