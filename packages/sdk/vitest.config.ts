import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    server: {
      deps: {
        // ethers and viem are CJS — let vitest handle the transform
        fallbackCJS: true,
      },
    },
  },
});
