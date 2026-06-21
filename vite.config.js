import { defineConfig } from 'vite';
// https://vitejs.dev/config/
export default defineConfig({
    // Tauri dev server runs on this port
    server: {
        port: 1420,
        strictPort: true,
    },
    // Put built files in dist/ (Tauri frontendDist)
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
    // Vite serves from project root, index.html is at root
    root: '.',
});
