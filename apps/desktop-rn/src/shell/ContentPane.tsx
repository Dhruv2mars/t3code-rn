import { StyleSheet, View } from "react-native";

import type { HandledKeyEvent, KeyEvent } from "react-native/Libraries/Types/CoreEventTypes";

import { AppText, tokens } from "../components/AppText";
import { ThreadView } from "../thread/ThreadView";
import type { ThreadSession } from "../thread/session";

const styles = StyleSheet.create({
  breadcrumbProject: {
    color: tokens.foregroundMuted,
    fontSize: 14,
  },
  breadcrumbSeparator: {
    color: tokens.foregroundMuted,
    fontSize: 14,
    marginHorizontal: 8,
  },
  breadcrumbTitle: {
    color: tokens.foreground,
    flex: 1,
    fontWeight: "600",
    fontSize: 14,
  },
  footer: {
    borderTopColor: tokens.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  footerHint: {
    color: tokens.foregroundMuted,
    flex: 1,
    fontSize: 12,
  },
  footerState: {
    color: tokens.foregroundMuted,
    fontSize: 12,
  },
  headerBar: {
    alignItems: "center",
    borderBottomColor: tokens.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  newThreadButton: {
    borderColor: tokens.border,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newThreadLabel: {
    color: tokens.foregroundSecondary,
    fontSize: 13,
  },
  pane: {
    backgroundColor: tokens.screen,
    flex: 1,
    minHeight: 0,
  },
});

export const KEYBOARD_EVENTS: HandledKeyEvent[] = [
  { key: "ArrowUp" },
  { key: "ArrowDown" },
  { key: "Enter" },
];

/**
 * Main content pane: breadcrumb over the live thread view (stream +
 * composer), with the U-008 keyboard-selection footer kept for evidence.
 */
export function ContentPane(props: {
  readonly projectTitle: string;
  readonly selectedTitle: string;
  readonly highlightedTitle: string;
  readonly session: ThreadSession;
  readonly threadId: string | null;
  readonly onKeyDown: (event: KeyEvent) => void;
  readonly onThreadCreated: (threadId: string) => void;
}) {
  return (
    <View style={styles.pane}>
      <View style={styles.headerBar}>
        <AppText style={styles.breadcrumbProject}>{props.projectTitle}</AppText>
        <AppText style={styles.breadcrumbSeparator}>|</AppText>
        <AppText numberOfLines={1} style={styles.breadcrumbTitle}>
          {props.selectedTitle}
        </AppText>
        <View style={styles.newThreadButton}>
          <AppText style={styles.newThreadLabel}>+ New thread</AppText>
        </View>
      </View>
      <View
        focusable
        keyDownEvents={KEYBOARD_EVENTS}
        onKeyDown={props.onKeyDown}
        style={styles.pane}
      >
        <ThreadView
          onThreadCreated={props.onThreadCreated}
          projectTitle={props.projectTitle}
          session={props.session}
          threadId={props.threadId}
        />
      </View>
      <View style={styles.footer}>
        <AppText numberOfLines={1} style={styles.footerHint}>
          Up/Down move, Enter selects
        </AppText>
        <AppText numberOfLines={1} style={styles.footerState}>
          {`highlight: ${props.highlightedTitle} · selected: ${props.selectedTitle}`}
        </AppText>
      </View>
    </View>
  );
}
