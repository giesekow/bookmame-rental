import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { Api, AppManager, Collection, Dialogs, Report } from 'vuetify-extended';
import { updateRentalReservationView } from '../pages/reservations';

const STORAGE_KEY = 'bookmame-rental-current-provider-id';
const RESERVATION_CHANNEL = 'rental.reservations';
const SOCKET_LISTENER_REF = Symbol('bookmame-rental-reservation-realtime');

let activeRealtimeProviderId: string | null = null;
let activeRealtimeServicePath: string | null = null;
let socketListenerBound = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRealtimeRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    const currentView = AppManager.$app?.activeItemRef.value;
    if (!currentView) {
      return;
    }

    if (currentView.type === 'collection' && currentView.item instanceof Collection) {
      const coll = currentView.item;
      if (coll.$currentReport?.$get('isRentalReservationView', false)) {
        await updateRentalReservationView(coll.$currentReport.$master);
        coll.$currentReport.forceRender();
      }
    }

    if (currentView.type === 'report' && currentView.item instanceof Report) {
      const currentReport = currentView.item;
      if (currentReport.$get('isRentalReservationView', false)) {
        await updateRentalReservationView(currentReport.$master);
        currentReport.forceRender();
      }
    }
  }, 250);
}

function bindReservationRealtimeService(servicePath: string) {
  if (activeRealtimeServicePath === servicePath) {
    return;
  }

  if (activeRealtimeServicePath) {
    const previousService = Api.instance.service(activeRealtimeServicePath) as any;
    previousService.removeListener('created', scheduleRealtimeRefresh);
    previousService.removeListener('patched', scheduleRealtimeRefresh);
    previousService.removeListener('removed', scheduleRealtimeRefresh);
  }

  const nextService = Api.instance.service(servicePath) as any;
  nextService.on('created', scheduleRealtimeRefresh);
  nextService.on('patched', scheduleRealtimeRefresh);
  nextService.on('removed', scheduleRealtimeRefresh);
  activeRealtimeServicePath = servicePath;
}

function leaveReservationRoom(rentalProviderId: string | null) {
  if (!rentalProviderId) {
    return;
  }

  Api.instance.emitSocket?.('channel.leave', {
    channel: RESERVATION_CHANNEL,
    rentalProviderId,
  });
}

function joinReservationRoom(rentalProviderId: string) {
  Api.instance.emitSocket?.('channel.join', {
    channel: RESERVATION_CHANNEL,
    rentalProviderId,
  });
}

function ensureSocketReconnectBinding(getActiveProviderId: () => string | null) {
  if (socketListenerBound) {
    return;
  }

  (Api.instance as any).on?.(
    'socket:connect',
    () => {
      const rentalProviderId = getActiveProviderId();
      if (rentalProviderId) {
        joinReservationRoom(rentalProviderId);
      }
    },
    SOCKET_LISTENER_REF,
  );

  socketListenerBound = true;
}

export const useAppStore = defineStore('app', () => {
  const rentalProvider: Ref<any | null> = ref(null);
  const hasInitializedRentalProvider = ref(false);

  function normalizeProviderId(item: any): string | null {
    if (!item) {
      return null;
    }

    if (typeof item === 'object' && item.id) {
      return item.id.toString();
    }

    return item.toString();
  }

  async function accessibleRentalProviders() {
    try {
      const providers: any[] = await Api.instance.service('me').get('rental-providers', {
        query: { $paginate: false },
      });
      return providers;
    } catch (error: any) {
      Dialogs.$error(error?.message || 'Failed to load accessible rental providers.');
      return [];
    }
  }

  function syncRentalRealtime(nextProviderId: string | null) {
    ensureSocketReconnectBinding(() => normalizeProviderId(rentalProvider.value));

    if (activeRealtimeProviderId && activeRealtimeProviderId !== nextProviderId) {
      leaveReservationRoom(activeRealtimeProviderId);
    }

    if (!nextProviderId) {
      if (activeRealtimeServicePath) {
        const previousService = Api.instance.service(activeRealtimeServicePath) as any;
        previousService.removeListener('created', scheduleRealtimeRefresh);
        previousService.removeListener('patched', scheduleRealtimeRefresh);
        previousService.removeListener('removed', scheduleRealtimeRefresh);
      }

      activeRealtimeProviderId = null;
      activeRealtimeServicePath = null;
      return;
    }

    bindReservationRealtimeService(`rental-providers/${nextProviderId}/reservations`);
    joinReservationRoom(nextProviderId);
    activeRealtimeProviderId = nextProviderId;
  }

  async function switchRentalProvider(itemId?: any): Promise<boolean> {
    const targetProviderId = normalizeProviderId(itemId) ?? localStorage.getItem(STORAGE_KEY);

    try {
      const providers = await accessibleRentalProviders();

      if (providers.length === 0) {
        rentalProvider.value = null;
        syncRentalRealtime(null);
        hasInitializedRentalProvider.value = true;
        return false;
      }

      let selectedProvider = providers[0];
      if (targetProviderId) {
        selectedProvider = providers.find((item: any) => item.id.toString() === targetProviderId) || providers[0];
      }

      rentalProvider.value = selectedProvider;
      const rentalProviderId = selectedProvider.id.toString();
      localStorage.setItem(STORAGE_KEY, rentalProviderId);
      syncRentalRealtime(rentalProviderId);
      hasInitializedRentalProvider.value = true;
      return true;
    } catch (error: any) {
      Dialogs.$error(error?.message || 'Failed to load accessible rental providers.');
      return false;
    }
  }

  async function initializeRentalProvider() {
    if (hasInitializedRentalProvider.value) {
      return Boolean(rentalProvider.value);
    }

    return switchRentalProvider();
  }

  async function logout() {
    rentalProvider.value = null;
    syncRentalRealtime(null);
    hasInitializedRentalProvider.value = false;
  }

  return {
    rentalProvider,
    hasInitializedRentalProvider,
    accessibleRentalProviders,
    switchRentalProvider,
    initializeRentalProvider,
    logout,
  };
});
