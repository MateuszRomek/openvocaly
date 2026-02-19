import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const parsedPort = Number.parseInt(env.RENDERER_DEV_SERVER_PORT ?? '', 10)
  const rendererPort = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : undefined

  return {
    main: {},
    preload: {},
    renderer: {
      server: rendererPort ? { port: rendererPort } : undefined,
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [
        tanstackRouter({
          target: 'react'
        }),
        react(),
        tailwindcss()
      ]
    }
  }
})
