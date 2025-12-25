import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../static/libs/blockpy_server_solid',
    lib: {
      entry: path.resolve(__dirname, 'src/app.tsx'),
      name: 'frontendSolid',
      formats: ['umd'],
      fileName: () => 'frontend-solid.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'frontend-solid.css';
          }
          return assetInfo.name || '';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
  },
});
