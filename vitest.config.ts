import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@features': '/src/features',
      '@shared': '/src/shared',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'app/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
})
