import { createApp, defineComponent, h, watchEffect } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import 'vuetify-extended/lib/esm/css/index.css';
import { Api } from 'vuetify-extended';
import { initializeBootstrap } from './bootstrap';
import { createAccessDeniedScreen, createPlainScreen } from './app';
import { initializeMailbox } from './mailbox';
import { initializeWebPush, unregisterCurrentPushDevice } from './push/web-push';
import store from './store';
import { useAppStore } from './store/app';

const vuetify = createVuetify({
  components,
  directives,
});

const bootstrap = initializeBootstrap();
const plainScreen = createPlainScreen();
const noAccessScreen = createAccessDeniedScreen();

const Root = defineComponent({
  name: 'BookmameRentalApp',
  setup() {
    const appStore = useAppStore();

    watchEffect(() => {
      const hasAccess = Boolean(
        Api.instance.tokenRef?.value &&
        (Api.instance.userRef?.value?.user?.allowedApps || []).includes('bookmame-rental'),
      );

      if (hasAccess) {
        initializeMailbox();
        void initializeWebPush();
        void appStore.initializeRentalProvider();
      } else {
        void unregisterCurrentPushDevice();
        void appStore.logout();
      }
    });

    return () => {
      let screen = bootstrap.component;

      if (!Api.instance.tokenRef?.value) {
        screen = plainScreen.component;
      } else if (!Api.instance.userRef?.value) {
        screen = noAccessScreen.component;
      } else if (!(Api.instance.userRef?.value?.user?.allowedApps || []).includes('bookmame-rental')) {
        screen = noAccessScreen.component;
      }

      return [h(screen), h(bootstrap.dialogs), h(bootstrap.notifications)];
    };
  },
});

createApp(Root).use(store).use(vuetify).use(bootstrap.plugin).mount('#app');
bootstrap.validate({ warn: true });
