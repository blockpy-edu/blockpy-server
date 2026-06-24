import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/libs/blockpy_react/',
  build: {
    outDir: path.resolve(__dirname, '../static/libs/blockpy_react'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // Use stable (non-hashed) filenames so the Flask template doesn't
        // need to be updated after every build.
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5001',
      '/courses': 'http://localhost:5001',
      '/assignments': 'http://localhost:5001',
      '/grading': 'http://localhost:5001',
      '/blockpy': 'http://localhost:5001',
    },
  },
})
