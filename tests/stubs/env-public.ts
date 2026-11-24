/**
 * Test stub for SvelteKit's `$env/dynamic/public`.
 *
 * Only PUBLIC_* variables are exposed, mirroring the real contract.
 */
export const env: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => key.startsWith('PUBLIC_'))
);
