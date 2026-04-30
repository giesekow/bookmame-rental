import { $SL, AppManager, Dialogs } from 'vuetify-extended';
import { useAppStore } from '../store/app';

export const createRentalSwitchSelector = async () => {
  const selector = $SL({
    title: 'Switch Rental Provider',
    width: 520,
  }, {
    async selected(item, currentSelector) {
      const appStore = useAppStore();
      Dialogs.$showProgress({});
      const switched = await appStore.switchRentalProvider(item);
      Dialogs.$hideProgress();

      if (switched) {
        currentSelector.forceCancel();
        AppManager.reload();
        location.reload()
      }
    },
    load: async () => {
      const appStore = useAppStore();
      return appStore.accessibleRentalProviders();
    },
  });

  return selector;
};
