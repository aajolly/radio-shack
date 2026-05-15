import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    // UI tests run in jsdom; server tests run in node (default)
    environmentMatchGlobs: [
      ['tests/ui.*.test.js', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      include: ['public/ratings-ui.js', 'server.js'],
    },
  },
});
