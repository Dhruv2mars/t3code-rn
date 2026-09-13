module.exports = {
  presets: ["module:@react-native/babel-preset"],
  // client-runtime re-exports namespaces (e.g. `export * as TokenStore`), which
  // the RN 0.81 preset's commonjs transform does not handle on its own.
  plugins: ["@babel/plugin-transform-export-namespace-from"],
};
