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
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 10 },
                        { name: 'r3f', test: /node_modules[\\/]@react-three[\\/]/, maxSize: 700_000, includeDependenciesRecursively: false, priority: 5 },
                        { name: 'vendor', test: /node_modules[\\/]/, maxSize: 700_000, priority: -1 },
                    ],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['three', '@react-three/fiber', '@react-three/drei'],
    },
});
