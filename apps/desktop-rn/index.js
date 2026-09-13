/**
 * @format
 */

// Hermes 0.81 has no TextDecoder; effect's Encoding module builds one at
// import time, so the polyfill must load before anything else.
import "./src/polyfills/textEncoding";

import { AppRegistry } from "react-native";
import { name as appName } from "./app.json";
import App from "./src/App";

AppRegistry.registerComponent(appName, () => App);
