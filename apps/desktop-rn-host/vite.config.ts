import "vite-plus/test/config";
import { defineConfig, mergeConfig } from "vite-plus";

import baseConfig from "../../vite.config.ts";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // The smoke test boots the full server; it runs alone and needs a wide
      // budget for a cold start (sqlite migrations, provider registries).
      fileParallelism: false,
      hookTimeout: 120_000,
      testTimeout: 300_000,
    },
  }),
);
