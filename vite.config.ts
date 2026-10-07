import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'include-license-notices',
    generateBundle() {
      for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
        this.emitFile({ type: 'asset', fileName: file, source: readFileSync(new URL(file, import.meta.url), 'utf8') });
      }
    },
  }],
  build: {
    target: 'es2022',
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'], physics: ['matter-js'] } } },
    chunkSizeWarningLimit: 1600,
  },
});
