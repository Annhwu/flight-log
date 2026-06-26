import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      // boring-avatars imports React — redirect to lightweight Preact compat
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react-dom':         'preact/compat',
      'react':             'preact/compat',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['preact', 'preact-render-to-string', 'boring-avatars', 'marked'],
        },
      },
    },
  },
});
