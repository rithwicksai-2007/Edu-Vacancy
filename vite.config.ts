import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from "@tailwindcss/vite";

const githubPagesFallback: Plugin = {
  name: 'github-pages-spa-fallback',
  apply: 'build',
  writeBundle({ dir }) {
    const outputDir = resolve(dir ?? 'dist')
    const indexPath = resolve(outputDir, 'index.html')
    const fallbackPath = resolve(outputDir, '404.html')
    const legacyRouteRedirect = `<script>(function(){var base='/Edu-Vacancy/';if(location.pathname.startsWith(base)&&location.pathname!==base){var route=location.pathname.slice(base.length);location.replace(base+'#/'+route+location.search)}})()</script>`
    const html = readFileSync(indexPath, 'utf8').replace(
      '</head>',
      `${legacyRouteRedirect}</head>`,
    )
    writeFileSync(fallbackPath, html)
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Edu-Vacancy/',
  plugins: [react(), tailwindcss(), githubPagesFallback]
});
