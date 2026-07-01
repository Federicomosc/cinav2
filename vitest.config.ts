import { defineConfig } from 'vitest/config';

// Config separata da vite.config.ts: i test coprono solo la logica pura in
// src/lib e src/db, niente bisogno del plugin PWA/Svelte per queste unità.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
