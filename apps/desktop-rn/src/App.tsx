import type { JSX } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import rnPackageJson from "react-native/package.json";

const reactNativeVersion: string = rnPackageJson.version;

function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>T3 Code RN</Text>
      <Text style={styles.subtitle}>
        {`Platform: ${Platform.OS} · React Native ${reactNativeVersion}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#101014",
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#8a8a93",
    fontSize: 14,
    marginTop: 8,
  },
});

export default App;
