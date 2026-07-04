import { defineConfig } from 'wxt'
import tailwindcss from "@tailwindcss/vite"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {
      default_title: 'Open Chat Panel',
    },
    permissions: [
      'tabs',
      'activeTab',
      'scripting',
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
