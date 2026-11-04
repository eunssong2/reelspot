import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: [
    { find: /^react-native$/, replacement: local('./tests/flows/native.tsx') },
    { find: /^expo-router$/, replacement: local('./tests/flows/router.tsx') },
  ] },
  test: { include: ['tests/flows/*.test.tsx'], environment: 'node', setupFiles: ['./tests/flows/setup.tsx'], fileParallelism: false },
});
