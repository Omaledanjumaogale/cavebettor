import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      // SvelteKit's virtual env modules are not available outside the app
      // runtime, so tests get a process.env-backed stub instead.
      '$env/dynamic/private': fileURLToPath(new URL('./tests/stubs/env-private.ts', import.meta.url)),
      '$env/dynamic/public': fileURLToPath(new URL('./tests/stubs/env-public.ts', import.meta.url))
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
