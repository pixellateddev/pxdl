import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { copyFileSync, mkdirSync } from 'node:fs'

const root = resolve(__dirname, '../../')
const outDir = resolve(__dirname, 'dist')

export default defineConfig({
  root,
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        mkdirSync(resolve(outDir, 'icons'), { recursive: true })
        // Copy icons — run `bun gen-icons` first if directory is empty
        for (const size of [16, 48, 128]) {
          try {
            copyFileSync(
              resolve(root, `icons/icon${size}.png`),
              resolve(outDir, `icons/icon${size}.png`),
            )
          } catch {
            // Silently skip missing icons — Chrome loads without them
          }
        }
        // Copy manifest last so it ends up alongside the built files
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(outDir, 'manifest.json'))
      },
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        background: resolve(root, 'src/background/index.ts'),
      },
      output: {
        // background must be a single flat file — service workers can't use dynamic imports
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : '[name].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
})
