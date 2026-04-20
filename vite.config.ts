import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = __dirname;
const vuetifyExtendedPath = path.resolve(__dirname, 'node_modules/vuetify-extended');

export default defineConfig({
  plugins: [vue()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      'vuetify-extended': vuetifyExtendedPath,
    },
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@bookmame/web-utils'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    fs: {
      allow: [appRoot],
    },
    host: '0.0.0.0',
    port: 4181,
  },
});
