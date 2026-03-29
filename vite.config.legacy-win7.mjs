/**
 * Build del renderer para el paquete Windows 7 (Chromium 108 / Electron 22).
 * La app principal sigue usando vite.config.js + Electron 33.
 */
import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

export default mergeConfig(
  baseConfig,
  defineConfig({
    build: {
      target: ['chrome108', 'edge108'],
      outDir: 'dist-legacy-win7',
      emptyOutDir: true,
    },
  })
)
