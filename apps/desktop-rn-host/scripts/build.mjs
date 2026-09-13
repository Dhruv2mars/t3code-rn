import * as esbuild from "esbuild";

// Runtime externals mirror scripts/lib/cli-external-packages.ts
// (CLI_RUNTIME_EXTERNAL_PREFIXES): native addons and the JS wrappers that
// load them by real path. They must resolve from dist/host.cjs at runtime,
// so this package declares them as dependencies.
const runtimeExternals = [
  "node-pty",
  "ffi-rs",
  "@yuuang",
  "@clerk",
  "@msgpackr-extract",
  "msgpackr-extract",
  "node-gyp-build",
  "node-addon-api",
  "detect-libc",
  "bufferutil",
  "utf-8-validate",
];

// Runtime-conditional bun-only imports Node never takes (server code picks
// them via `typeof Bun !== "undefined"` guards); they resolve bun:* specifiers
// that cannot be bundled for Node.
const buildOnlyExternals = ["@effect/platform-bun", "@effect/sql-sqlite-bun", "bun:*"];

await esbuild.build({
  entryPoints: ["src/host.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: "dist/host.cjs",
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: '#!/usr/bin/env node\nvar __t3HostFileUrl = require("node:url").pathToFileURL(__filename).href;\n',
  },
  // The server reads import.meta.dirname for optional asset paths (bundled web
  // client, resource-monitor binary) and import.meta.url in the Claude adapter.
  // In CJS output the sidecar's dist/ is the bundle origin, and all of these
  // paths degrade gracefully when absent.
  define: {
    "import.meta.dirname": "__dirname",
    "import.meta.url": "__t3HostFileUrl",
  },
  external: [...runtimeExternals, ...buildOnlyExternals],
});
