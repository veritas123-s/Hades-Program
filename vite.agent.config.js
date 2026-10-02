import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'android/app/src/main/assets/pi', emptyOutDir: true,
    lib: { entry: 'src/agent/mobile-entry.mjs', name: 'MedstackAgent', formats: ['iife'], fileName: ()=>'agent.js' },
    sourcemap: false, minify: true,
  },
});
