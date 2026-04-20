import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';
import { Api, Dialogs } from 'vuetify-extended';

const STORAGE_KEY = 'bookmame-rental-current-provider-id';

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

  async function switchRentalProvider(itemId?: any): Promise<boolean> {
    const targetProviderId = normalizeProviderId(itemId) ?? localStorage.getItem(STORAGE_KEY);

    try {
      const providers = await accessibleRentalProviders();

      if (providers.length === 0) {
        rentalProvider.value = null;
        hasInitializedRentalProvider.value = true;
        return false;
      }

      let selectedProvider = providers[0];
      if (targetProviderId) {
        selectedProvider = providers.find((item: any) => item.id.toString() === targetProviderId) || providers[0];
      }

      rentalProvider.value = selectedProvider;
      localStorage.setItem(STORAGE_KEY, selectedProvider.id.toString());
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
