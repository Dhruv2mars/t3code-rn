const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("@react-native/metro-config");

const config = getDefaultConfig(__dirname);

// macOS and Windows are out-of-tree platforms; upstream metro defaults only
// cover android/ios.
config.resolver.platforms = [...config.resolver.platforms, "macos", "windows"];

// pnpm stores every package under a content-addressed .pnpm store at the
// workspace root, so metro's file map and name lookup both need those paths.
const workspaceRoot = path.resolve(__dirname, "../..");

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// react-native-windows ships build/ and target/ output, and run-windows drops
// msbuild.ProjectImports.zip; a running metro server must not watch them.
// See the react-native-windows metro template.
const rnwPath = path.resolve(require.resolve("react-native-windows/package.json"), "..");

config.resolver.blockList = [
  new RegExp(`${path.resolve(__dirname, "windows").replace(/[/\\]/g, "/")}.*`),
  new RegExp(`${rnwPath}/build/.*`),
  new RegExp(`${rnwPath}/target/.*`),
  /.*\.ProjectImports\.zip/,
];

// react-native-macos and react-native-windows are out-of-tree forks: when
// bundling for those platforms, every `react-native` import must resolve to
// the platform fork, otherwise vanilla RN's ios/android-only internals (e.g.
// ReactDevToolsSettingsManager) break the bundle. See https://aka.ms/rnm-metro.
const platformForks = {
  macos: "react-native-macos",
  windows: "react-native-windows",
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fork = platformForks[platform];
  if (fork && (moduleName === "react-native" || moduleName.startsWith("react-native/"))) {
    moduleName = `${fork}${moduleName.slice("react-native".length)}`;
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

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
