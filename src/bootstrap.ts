import { createVuetifyExtendedApp } from 'vuetify-extended';
import { createMainApp } from './app';

export const mainApp = createMainApp();

export function initializeBootstrap() {
  const bootstrap = createVuetifyExtendedApp({
    api: {
      type: 'axios',
      apiURL: import.meta.env.VITE_API_BASE_URL,
      keycloakConfig: {
        keycloakConfig: {
          url: import.meta.env.VITE_KEYCLOAK_URL,
          realm: import.meta.env.VITE_KEYCLOAK_REALM,
          clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
        },
        keycloakInit: {
          onLoad: 'login-required',
          checkLoginIframe: false,
        },
      },
      options: {
        authPath: 'auth/me',
        refreshAuthPath: 'auth/me',
        authCreateMethod: 'get',
        authRefreshMethod: 'get',
      },
    },
    app: mainApp,
    dialogs: {
      progressSize: 96,
      progressWidth: 10,
      successTimeout: 2400,
      warningTimeout: 3200,
      errorTimeout: 4200,
    },
    notifications: {
      location: 'top-right',
      maxVisible: 4,
      defaultTimeout: 3600,
    },
    defaults: {
      menuItem: {
        shortcutDisplay: 'compact',
      },
      master: {
        idField: 'id',
      },
      field: {
        variant: 'outlined',
      },
    },
  });

  return bootstrap;
}
