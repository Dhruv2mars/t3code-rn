import { View } from "react-native";

import type { HandledKeyEvent, KeyEvent } from "react-native/Libraries/Types/CoreEventTypes";

import { AppText } from "../components/AppText";

/**
 * Main content pane: breadcrumb, empty-state prompt, and a footer that proves
 * the keyboard selection state on screen (acceptance 3).
 */
export function ContentPane(props: {
  readonly projectTitle: string;
  readonly selectedTitle: string;
  readonly highlightedTitle: string;
  readonly onKeyDown: (event: KeyEvent) => void;
}) {
  return (
    <View className="h-full min-w-0 flex-1 flex-col bg-screen">
      <View className="flex-row items-center border-b border-border px-5 py-3">
        <AppText className="text-sm text-foreground-muted">{props.projectTitle}</AppText>
        <AppText className="mx-2 text-sm text-foreground-muted">|</AppText>
        <AppText numberOfLines={1} className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {props.selectedTitle}
        </AppText>
        <View className="ml-2 rounded-md border border-border px-2.5 py-1">
          <AppText className="text-xs text-foreground-secondary">+ New thread</AppText>
        </View>
      </View>
      <View
        className="flex-1 items-center justify-center px-8"
        focusable
        onKeyDown={props.onKeyDown}
        keyDownEvents={KEYBOARD_EVENTS}
      >
        <AppText className="text-lg font-semibold text-foreground">
          {`What should we build in ${props.projectTitle}?`}
        </AppText>
        <AppText className="mt-2 text-sm text-foreground-muted">
          Messages stream here in a later unit. This pane is the U-008 shell scaffold.
        </AppText>
      </View>
      <View className="flex-row items-center border-t border-border px-5 py-2">
        <AppText className="flex-1 text-2xs text-foreground-muted">
          Keyboard: Up/Down move the highlight, Enter selects. Click this pane first, then navigate.
        </AppText>
        <AppText numberOfLines={1} className="text-2xs text-foreground-muted">
          {`highlight: ${props.highlightedTitle} · selected: ${props.selectedTitle}`}
        </AppText>
      </View>
    </View>
  );
}

export const KEYBOARD_EVENTS: HandledKeyEvent[] = [
  { key: "ArrowUp" },
  { key: "ArrowDown" },
  { key: "Enter" },
];
