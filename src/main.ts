import { createApp, defineComponent, h, watch, watchEffect } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import 'vuetify-extended/lib/esm/css/index.css';
import './theme/dark-overrides.css';
import { Api } from 'vuetify-extended';
import { initializeBootstrap, mainApp } from './bootstrap';
import { applyShellThemeMode, createAccessDeniedScreen, createPlainScreen } from './app';
import { initializeMailbox } from './mailbox';
import { initializeWebPush, unregisterCurrentPushDevice } from './push/web-push';
import store from './store';
import { useAppStore } from './store/app';
import { applyThemeMode, resolveThemeMode, watchSystemThemeMode } from './misc/theme-mode';
import { applyRentalDashboardThemeMode } from './pages/dashboard';
import { openPartnerLaunchTarget, readPartnerLaunchTarget } from './misc/partner-launch-target';

const vuetify = createVuetify({
  components,
  directives,
});

let lastAppliedThemeMode: 'light' | 'dark' | null = null;
const applyResolvedThemeMode = () => {
  const mode = resolveThemeMode(Api.instance.userRef?.value ?? null);
  if (lastAppliedThemeMode === mode) {
    return;
  }
  lastAppliedThemeMode = mode;
  applyShellThemeMode(mainApp, plainScreen, mode);
  applyRentalDashboardThemeMode(mode);
  vuetify.theme.global.name.value = mode;
  applyThemeMode(mode);
};

const bootstrap = initializeBootstrap();
const plainScreen = createPlainScreen();
const noAccessScreen = createAccessDeniedScreen();
const launchTarget = readPartnerLaunchTarget();
let launchTargetHandled = false;
let launchTargetInFlight = false;

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

      if (
        launchTarget &&
        !launchTargetHandled &&
        !launchTargetInFlight &&
        hasAccess &&
        appStore.hasInitializedRentalProvider &&
        Boolean(appStore.rentalProvider)
      ) {
        launchTargetInFlight = true;
        void (async () => {
          try {
            const launchTenantId = String(launchTarget.tenantId || '').trim();
            const currentProviderId = String(appStore.rentalProvider?.id || '').trim();

            if (launchTenantId && launchTenantId !== currentProviderId) {
              const switched = await appStore.switchRentalProvider(launchTenantId);
              if (!switched) {
                return;
              }
            }

            launchTargetHandled = openPartnerLaunchTarget(launchTarget);
          } finally {
            launchTargetInFlight = false;
          }
        })();
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
applyResolvedThemeMode();
watchSystemThemeMode(() => {
  applyResolvedThemeMode();
});
watch(
  () => Api.instance.userRef?.value ?? null,
  () => {
    applyResolvedThemeMode();
  },
  { deep: false },
);
window.addEventListener('bookmame-theme-mode-changed', () => {
  applyResolvedThemeMode();
});
