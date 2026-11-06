import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from "@tailwindcss/vite";

const githubPagesFallback: Plugin = {
  name: 'github-pages-spa-fallback',
  apply: 'build',
  writeBundle({ dir }) {
    const outputDir = resolve(dir ?? 'dist')
    copyFileSync(resolve(outputDir, 'index.html'), resolve(outputDir, '404.html'))
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Edu-Vacancy/',
  plugins: [react(), tailwindcss(), githubPagesFallback]
});
