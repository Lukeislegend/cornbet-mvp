import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Exact alias for our local supabase info only (avoids hijacking @supabase/supabase-js npm package)
      '@supabase/info': path.resolve(__dirname, './supabase/info'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Proxy /api to Supabase for local dev (avoids CORS)
  server: {
    proxy: {
      '/api': {
        target: 'https://hkguncfsuubqzsdguhfk.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/functions/v1/make-server-55aa94ce'),
      },
    },
  },
})
