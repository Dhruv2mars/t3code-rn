const path = require("path");
const { getDefaultConfig } = require("@react-native/metro-config");

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

config.resolver.resolveRequest = (context, moduleName, platform) => {
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

module.exports = config;
