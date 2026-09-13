import { type JSX } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";

/** Menu colors sampled from the reference composer surfaces. */
const colors = {
  surface: "#1c1c1f",
  border: "#2a2a2e",
  label: "#e5e5e7",
  check: "#8f8f96",
} as const;

const styles = StyleSheet.create({
  dismiss: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    bottom: 108,
    elevation: 8,
    left: 16,
    maxWidth: 448,
    minWidth: 200,
    paddingVertical: 5,
    position: "absolute",
    right: 16,
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    zIndex: 20,
  },
  item: {
    alignItems: "center",
    borderRadius: 6,
    flexDirection: "row",
    minHeight: 28,
    paddingHorizontal: 10,
  },
  itemCheck: {
    color: colors.check,
    fontSize: 12,
    width: 18,
  },
  itemLabel: {
    color: colors.label,
    fontSize: 13,
  },
});

/**
 * Menu-lite picker overlay: a small floating list rendered just above the
 * composer card (the brief's "simple positioned View" — RN macOS Modal is
 * not available here).
 */
export function PickerMenu(props: {
  readonly visible: boolean;
  readonly items: ReadonlyArray<{ readonly label: string; readonly checked: boolean }>;
  readonly onSelect: (index: number) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  if (!props.visible) return null;
  return (
    <>
      <Pressable onPress={props.onClose} style={styles.dismiss} />
      <View style={styles.menu}>
        {props.items.map((item, index) => (
          <Pressable key={item.label} onPress={() => props.onSelect(index)} style={styles.item}>
            <AppText style={styles.itemCheck}>{item.checked ? "✓" : ""}</AppText>
            <AppText style={styles.itemLabel}>{item.label}</AppText>
          </Pressable>
        ))}
      </View>
    </>
  );
}
