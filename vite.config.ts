/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import localAssets from './scripts/local-assets';

export default defineConfig({
  plugins: [react(), tailwindcss(), localAssets()],
  test: { environment: 'node' },
});
