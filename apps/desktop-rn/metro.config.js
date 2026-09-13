const path = require("path");
const { getDefaultConfig } = require("@react-native/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

// macOS is an out-of-tree platform; upstream metro defaults only cover android/ios.
config.resolver.platforms = [...config.resolver.platforms, "macos"];

// pnpm stores every package under a content-addressed .pnpm store at the
// workspace root, so metro's file map and name lookup both need those paths.
const workspaceRoot = path.resolve(__dirname, "../..");

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// react-native-macos is an out-of-tree fork: when bundling for macos, every
// `react-native` import must resolve to react-native-macos, otherwise vanilla
// RN's ios/android-only internals (e.g. ReactDevToolsSettingsManager) break
// the bundle. See https://aka.ms/rnm-metro.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "macos" &&
    (moduleName === "react-native" || moduleName.startsWith("react-native/"))
  ) {
    moduleName = `react-native-macos${moduleName.slice("react-native".length)}`;
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    try {
      const filePath = require.resolve(moduleName, { paths: [__dirname] });
      return { type: "sourceFile", filePath };
    } catch {
      throw error;
    }
  }
};

// Uniwind compiles `className` props at bundle time through this metro wrapper.
// It wraps the resolver above, so the react-native-macos remap still runs.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
});
