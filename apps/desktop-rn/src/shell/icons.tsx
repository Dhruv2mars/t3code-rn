import { useEffect, useRef, type JSX } from "react";
import { Animated, Easing, StyleSheet, View, type ColorValue } from "react-native";

/**
 * Sidebar icons drawn with plain RN views. Neither @tabler/icons-react-native
 * nor react-native-svg resolves from the desktop-rn workspace, and adding the
 * svg native module is outside this unit's scope, so every glyph is a small
 * composition of bordered and filled views matching the reference pixels.
 */

const styles = StyleSheet.create({
  dash: {
    borderRadius: 1,
    height: 2,
    left: 6.5,
    position: "absolute",
    top: 6.5,
    width: 3,
  },
  disk: {
    alignItems: "center",
    height: 16,
    justifyContent: "center",
    width: 16,
  },
});

export function PanelLeftIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View
      style={{
        borderColor: color,
        borderRadius: 4,
        borderWidth: 1.5,
        height: 15,
        width: 15,
      }}
    >
      <View
        style={{
          backgroundColor: color,
          bottom: 1.5,
          left: 4,
          position: "absolute",
          top: 1.5,
          width: 1.5,
        }}
      />
    </View>
  );
}

export function SearchIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 16 }}>
      <View
        style={{
          borderColor: color,
          borderRadius: 6,
          borderWidth: 1.5,
          height: 12,
          left: 0.5,
          position: "absolute",
          top: 0.5,
          width: 12,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderRadius: 1,
          bottom: 0,
          height: 6,
          position: "absolute",
          right: 0,
          transform: [{ rotate: "-45deg" }],
          width: 1.5,
        }}
      />
    </View>
  );
}

const folderTab = (color: ColorValue): JSX.Element => (
  <View
    style={{
      borderColor: color,
      borderLeftWidth: 1.5,
      borderRightWidth: 1.5,
      borderTopLeftRadius: 2.5,
      borderTopRightRadius: 2.5,
      borderTopWidth: 1.5,
      height: 6,
      left: 0,
      position: "absolute",
      top: 0,
      width: 7.5,
    }}
  />
);

export function FolderIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 17 }}>
      {folderTab(color)}
      <View
        style={{
          borderColor: color,
          borderRadius: 2.5,
          borderWidth: 1.5,
          bottom: 0,
          height: 12.5,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </View>
  );
}

export function FolderPlusIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 17 }}>
      {folderTab(color)}
      <View
        style={{
          borderColor: color,
          borderRadius: 2.5,
          borderWidth: 1.5,
          bottom: 0,
          height: 12.5,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          bottom: 4.5,
          height: 1.5,
          left: 7.5,
          position: "absolute",
          width: 6,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          bottom: 2,
          height: 6,
          left: 9.5,
          position: "absolute",
          width: 1.5,
        }}
      />
    </View>
  );
}

export function ComposeIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 16 }}>
      <View
        style={{
          borderColor: color,
          borderRadius: 3,
          borderWidth: 1.5,
          bottom: 0,
          height: 12.5,
          left: 0,
          position: "absolute",
          width: 12.5,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderRadius: 1,
          height: 11,
          position: "absolute",
          right: 0.5,
          top: 0,
          transform: [{ rotate: "45deg" }],
          width: 2.5,
        }}
      />
    </View>
  );
}

export function WorkingSpinner({ color }: { readonly color: ColorValue }): JSX.Element {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={[styles.disk, { transform: [{ rotate: spin }] }]}>
      {Array.from({ length: 10 }, (_, index) => index * 36).map((angle) => (
        <View
          key={angle}
          style={[
            styles.dash,
            {
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }, { translateY: -6.5 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

export function ChevronDownIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View
      style={{
        borderBottomColor: color,
        borderBottomWidth: 1.5,
        borderRightColor: color,
        borderRightWidth: 1.5,
        height: 7,
        transform: [{ rotate: "45deg" }],
        width: 7,
      }}
    />
  );
}

export function DraftIcon({
  ring,
  core,
}: {
  readonly ring: ColorValue;
  readonly core: ColorValue;
}): JSX.Element {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: ring,
        borderRadius: 3,
        height: 16,
        justifyContent: "center",
        width: 12,
      }}
    >
      <View style={{ backgroundColor: core, borderRadius: 1.5, height: 10, width: 6 }} />
    </View>
  );
}

export function GearIcon({
  color,
  holeColor,
}: {
  readonly color: ColorValue;
  readonly holeColor: ColorValue;
}): JSX.Element {
  return (
    <View style={{ alignItems: "center", height: 18, justifyContent: "center", width: 18 }}>
      <View
        style={{
          backgroundColor: color,
          borderRadius: 3,
          height: 12,
          position: "absolute",
          width: 12,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          borderRadius: 3,
          height: 12,
          position: "absolute",
          transform: [{ rotate: "45deg" }],
          width: 12,
        }}
      />
      <View style={{ backgroundColor: holeColor, borderRadius: 3, height: 5, width: 5 }} />
    </View>
  );
}

export function GitPullRequestIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 13 }}>
      <View
        style={{
          borderColor: color,
          borderRadius: 3.25,
          borderWidth: 1.5,
          height: 6.5,
          left: 0,
          position: "absolute",
          top: 0,
          width: 6.5,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          height: 8,
          left: 2.5,
          position: "absolute",
          top: 6,
          width: 1.5,
        }}
      />
      <View
        style={{
          backgroundColor: color,
          height: 9.5,
          left: 9,
          position: "absolute",
          top: 0,
          width: 1.5,
        }}
      />
      <View
        style={{
          borderColor: color,
          borderRadius: 3.25,
          borderWidth: 1.5,
          bottom: 0,
          height: 6.5,
          left: 6.5,
          position: "absolute",
          width: 6.5,
        }}
      />
    </View>
  );
}

export function BarChartIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ alignItems: "flex-end", columnGap: 2, flexDirection: "row", height: 16 }}>
      <View style={{ backgroundColor: color, borderRadius: 1, height: 7, width: 2 }} />
      <View style={{ backgroundColor: color, borderRadius: 1, height: 16, width: 2 }} />
      <View style={{ backgroundColor: color, borderRadius: 1, height: 11, width: 2 }} />
    </View>
  );
}

export function RefreshIcon({ color }: { readonly color: ColorValue }): JSX.Element {
  return (
    <View style={{ height: 16, width: 16 }}>
      <View
        style={{
          borderColor: color,
          borderRadius: 8,
          borderWidth: 1.5,
          borderTopColor: "transparent",
          height: 15,
          left: 0.5,
          position: "absolute",
          top: 0.5,
          transform: [{ rotate: "30deg" }],
          width: 15,
        }}
      />
      <View
        style={{
          borderLeftColor: "transparent",
          borderLeftWidth: 3,
          borderRightColor: "transparent",
          borderRightWidth: 3,
          borderTopColor: color,
          borderTopWidth: 4,
          height: 0,
          position: "absolute",
          right: -1,
          top: 2,
          transform: [{ rotate: "38deg" }],
          width: 0,
        }}
      />
    </View>
  );
}
