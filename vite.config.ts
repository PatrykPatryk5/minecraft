import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': '/src',
        },
    },
    server: {
        port: 5173,
        open: true,
    },
    build: {
        target: 'esnext',
        sourcemap: false,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    r3f: ['@react-three/fiber', '@react-three/drei'],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei'],
    },
});
