import { defineConfig } from 'wxt'
import tailwindcss from "@tailwindcss/vite"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    action: {
      default_title: 'Open Chat Panel',
    },
    host_permissions: [
      'https://api.kimi.com/coding/*',
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
  })

})
