import { type JSX } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";

/** Menu colors sampled from the reference composer surfaces. */
const colors = {
  surface: "#1c1c1f",
  border: "#2a2a2e",
  label: "#e5e5e7",
  check: "#8f8f96",
  backdrop: "transparent",
} as const;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 8,
    overflow: "hidden",
    paddingVertical: 5,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  menuCentered: {
    alignSelf: "center",
  },
  menuLeft: {
    marginLeft: 28,
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
 * Menu-lite picker overlay: a small floating list anchored above the
 * composer (centered for the model pill, left for the row pickers).
 */
export function PickerMenu(props: {
  readonly visible: boolean;
  readonly anchor: "center" | "left";
  readonly items: ReadonlyArray<{ readonly label: string; readonly checked: boolean }>;
  readonly onSelect: (index: number) => void;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Modal animationType="none" onRequestClose={props.onClose} transparent visible={props.visible}>
      <Pressable onPress={props.onClose} style={styles.backdrop}>
        <View
          style={[
            styles.menu,
            props.anchor === "center" ? styles.menuCentered : styles.menuLeft,
            { bottom: 96 },
          ]}
        >
          {props.items.map((item, index) => (
            <Pressable key={item.label} onPress={() => props.onSelect(index)} style={styles.item}>
              <AppText style={styles.itemCheck}>{item.checked ? "✓" : ""}</AppText>
              <AppText style={styles.itemLabel}>{item.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
