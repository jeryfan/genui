import { defineConfig } from 'wxt'
import tailwindcss from "@tailwindcss/vite"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'GenUI',
    action: {
      default_title: 'Open Chat Panel',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    permissions: [
      'tabs',
      'activeTab',
      'scripting',
      'storage',
    ],
    host_permissions: [
      '<all_urls>',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
  })

})
