import {
  AccessDeniedScreen,
  Api,
  AppMain,
  AppManager,
  AppTitleBlock,
  EnvironmentTag,
  MailboxBell,
  ShellIconAction,
  UserArea,
  $BN,
} from 'vuetify-extended';
import { buildHomeMenu } from './menu';
import { createRentalSwitchSelector } from './rental-switch';
import { useAppStore } from '../store/app';
import { hasPartnerPortalReturnTarget, returnToPartnerPortal } from '../misc/partner-launch-target';
import { resolveThemeMode, saveThemeMode } from '../misc/theme-mode';

type ThemeMode = 'light' | 'dark';

const lightShell = {
  backgroundColor: '#f5f2ef',
  backgroundGradient: 'linear-gradient(160deg, rgba(255,252,248,0.95) 0%, rgba(244,238,231,0.90) 52%, rgba(225,214,198,0.94) 100%)',
  backgroundOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(248,245,240,0.90) 100%)',
};

const darkShell = {
  backgroundColor: '#11171d',
  backgroundGradient: 'radial-gradient(circle at top left, rgba(232,122,63,0.18), transparent 30%), radial-gradient(circle at 85% 15%, rgba(242,195,91,0.14), transparent 24%), radial-gradient(circle at bottom right, rgba(45,143,122,0.16), transparent 26%), linear-gradient(180deg, #1a2027 0%, #151b22 46%, #11171d 100%)',
  backgroundOverlay: 'linear-gradient(180deg, rgba(17,23,29,0.40) 0%, rgba(17,23,29,0.62) 100%)',
};

export function createMainApp() {
  return new AppMain(
    {
      ref: 'bookmame-rental',
      title: import.meta.env.VITE_APP_TITLE,
      mobileTitle: import.meta.env.VITE_APP_TITLE,
      mobileLogo: '/favicon.png',
      showHeader: true,
      showFooter: true,
      headerLayout: 'auto',
      footerLayout: 'auto',
      ...lightShell,
    },
    {
      menu: async () => buildHomeMenu(),
      udfs: async () => [],
      headerStart: (app) => [
        new AppTitleBlock({
          title: app.$params.title || 'Bookmame Rental',
          subtitle: `Rental partner workspace for ${import.meta.env.VITE_APP_NAME || 'Bookmame'}`,
          icon: 'mdi-car-convertible',
          image: '/favicon.png',
          color: '#8a5a12',
          hideOnMobile: true,
        }),
      ],
      headerCenter: () => {
        const appStore = useAppStore();
        return [
          new EnvironmentTag({
            text: appStore.rentalProvider?.name || 'No rental provider selected',
            color: 'warning',
            hideOnMobile: true,
          }),
        ];
      },
      headerEnd: () => [
        new ShellIconAction({
          icon: 'mdi-home-switch-outline',
          color: 'warning',
          mobileLocation: 'header',
        }, {
          onClicked: async () => {
            const selector = await createRentalSwitchSelector();
            AppManager.showSelector(selector);
          },
        }),
        new MailboxBell({
          color: 'warning',
          badgeColor: 'error',
          title: 'Open Rental Mailbox',
          viewWidth: 980,
          mobileLocation: 'header',
        }),
        new UserArea({
          name: Api.instance.userRef?.value?.user?.displayName || 'Anonymous',
          email: Api.instance.userRef?.value?.user?.email || '',
          accountId: Api.instance.userRef?.value?.user?.accountId,
          avatarColor: 'warning',
          mobileLocation: 'header',
        }, {
          buttons() {
            const currentMode = resolveThemeMode(Api.instance.userRef?.value ?? null);
            const nextMode = currentMode === 'dark' ? 'light' : 'dark';
            return [
              $BN({ text: `Theme: ${currentMode === 'dark' ? 'Dark' : 'Light'} (Switch to ${nextMode === 'dark' ? 'Dark' : 'Light'})`, icon: currentMode === 'dark' ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }, {
                onClicked() {
                  saveThemeMode(nextMode);
                  window.dispatchEvent(new CustomEvent('bookmame-theme-mode-changed'));
                },
              }),
              { label: 'Session', type: 'separator' },
              $BN({ text: 'Logout', icon: 'mdi-lock' }, {
                onClicked() {
                  Api.instance.logout!();
                },
              }),
            ];
          },
        }),
      ],
      footerStart: () => {
        const appStore = useAppStore();
        return [
          ...(hasPartnerPortalReturnTarget()
            ? [
              new EnvironmentTag({
                text: 'Back to Portal',
                color: 'warning',
                variant: 'outlined',
                hideOnMobile: true,
              }, {
                onClicked() {
                  returnToPartnerPortal();
                },
              }),
            ]
            : []),
          new EnvironmentTag({
            text: appStore.rentalProvider?.name || 'No rental provider selected',
            color: 'warning',
            hideOnNonMobile: true,
          }),
        ];
      },
      footerEnd: () => [
        ...(hasPartnerPortalReturnTarget()
          ? [
            new EnvironmentTag({
              text: 'Back to Portal',
              color: 'warning',
              variant: 'outlined',
              hideOnNonMobile: true,
            }, {
              onClicked() {
                returnToPartnerPortal();
              },
            }),
          ]
          : []),
        new EnvironmentTag({
          text: 'Copyright 2026 Hawkedin Limited',
          color: 'warning',
          variant: 'outlined',
        }),
      ],
    },
  );
}

export function createPlainScreen() {
  return new AppMain({
    ref: 'bookmame-rental',
    title: import.meta.env.VITE_APP_TITLE,
    ...lightShell,
  });
}

export function applyShellThemeMode(
  app: AppMain,
  plainScreen: AppMain,
  mode: ThemeMode,
) {
  const shell = mode === 'dark' ? darkShell : lightShell;
  Object.assign(app.$params, shell);
  Object.assign(plainScreen.$params, shell);
}

export function createAccessDeniedScreen() {
  return new AccessDeniedScreen({
    title: 'Application Access Required',
    subtitle: 'Authorization Needed',
    message: 'Access to this app is granted when your account is assigned as a rental provider super user or receives an active scoped role for a rental provider workspace.',
    backgroundGradient: 'radial-gradient(circle at top, rgba(245,158,11,0.18), transparent 44%), linear-gradient(160deg, #3f2b18 0%, #6f4e1f 52%, #8a5a12 100%)',
    actionText: 'Logout',
  }, {
    action() {
      Api.instance.logout!();
    },
  });
}
