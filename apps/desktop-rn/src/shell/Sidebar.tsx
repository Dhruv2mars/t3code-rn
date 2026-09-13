// @effect-diagnostics globalDate:off -- The relative-time label anchors to wall-clock now at launch; Intl formatting lives in listModel.
import { memo, useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import type { OrchestrationProjectShell, OrchestrationThreadShell } from "@t3tools/contracts";

import { AppText, AppTextInput, tokens } from "../components/AppText";
import { formatRelativeTime, type ShellListItem } from "./listModel";

const NOW = new Date().toISOString();

/** Deterministic accent per project id; stand-in for real project favicons. */
const PROJECT_ACCENTS = ["#6366f1", "#10b981", "#f59e0b", "#0ea5e9"];
const projectAccent = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return PROJECT_ACCENTS[Math.abs(hash) % PROJECT_ACCENTS.length] ?? PROJECT_ACCENTS[0]!;
};

const listStyle: StyleProp<ViewStyle> = { flex: 1 };
const listContentStyle: StyleProp<ViewStyle> = { paddingBottom: 12 };

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    borderRadius: 4,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  avatarLetter: {
    color: tokens.white,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomBar: {
    borderTopColor: tokens.border,
    borderTopWidth: 1,
    columnGap: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomItem: {
    color: tokens.foregroundMuted,
    fontSize: 12,
  },
  brandBox: {
    alignItems: "center",
    backgroundColor: tokens.accent,
    borderRadius: 6,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  brandRow: {
    alignItems: "center",
    columnGap: 8,
    flexDirection: "row",
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  brandTitle: {
    color: tokens.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  headerRow: {
    alignItems: "center",
    columnGap: 8,
    flexDirection: "row",
    paddingBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTitle: {
    color: tokens.foregroundMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  hoverActions: {
    columnGap: 12,
    flexDirection: "row",
    marginLeft: 8,
  },
  hoverAction: {
    color: tokens.foregroundSecondary,
    fontSize: 12,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    height: 44,
    paddingHorizontal: 16,
  },
  rowHighlighted: {
    backgroundColor: tokens.subtle,
  },
  rowSelected: {
    backgroundColor: tokens.subtleStrong,
  },
  rowSelectedBar: {
    backgroundColor: tokens.accent,
    borderRadius: 2,
    height: 16,
    marginLeft: 4,
    width: 2,
  },
  rowPress: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },
  rowTitle: {
    color: tokens.foreground,
    flex: 1,
    fontSize: 14,
  },
  rowTime: {
    color: tokens.foregroundMuted,
    fontSize: 12,
    marginLeft: 8,
  },
  searchWrap: {
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  serverLabel: {
    color: tokens.foregroundMuted,
    flex: 1,
    fontSize: 12,
    textAlign: "right",
  },
  sidebar: {
    backgroundColor: tokens.sidebar,
    height: "100%",
  },
});

function ProjectAvatar({ project }: { readonly project: OrchestrationProjectShell }) {
  return (
    <View style={[styles.avatar, { backgroundColor: projectAccent(project.id) }]}>
      <AppText style={styles.avatarLetter}>{project.title.slice(0, 1).toUpperCase()}</AppText>
    </View>
  );
}

function ProjectHeader({ project }: { readonly project: OrchestrationProjectShell }) {
  return (
    <View style={styles.headerRow}>
      <ProjectAvatar project={project} />
      <AppText style={styles.headerTitle}>{project.title}</AppText>
    </View>
  );
}

const ThreadRow = memo(function ThreadRow(props: {
  readonly thread: OrchestrationThreadShell;
  readonly isHighlighted: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (threadId: string) => void;
}) {
  // Hover resets when the row is recycled onto another thread.
  const [hovered, setHovered] = useState(false);
  const highlighted = props.isHighlighted || hovered;
  return (
    <View
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={[
        styles.row,
        highlighted ? styles.rowHighlighted : null,
        props.isSelected ? styles.rowSelected : null,
      ]}
    >
      <Pressable
        accessibilityLabel={`Select thread ${props.thread.title}`}
        accessibilityRole="button"
        onPress={() => props.onSelect(props.thread.id)}
        style={styles.rowPress}
      >
        <AppText numberOfLines={1} style={styles.rowTitle}>
          {props.thread.title}
        </AppText>
        {hovered ? (
          <View style={styles.hoverActions}>
            <AppText style={styles.hoverAction}>Snooze</AppText>
            <AppText style={styles.hoverAction}>Settle</AppText>
          </View>
        ) : (
          <AppText style={styles.rowTime}>
            {formatRelativeTime(props.thread.updatedAt, NOW)}
          </AppText>
        )}
      </Pressable>
      {props.isSelected ? <View style={styles.rowSelectedBar} /> : null}
    </View>
  );
});

export function Sidebar(props: {
  readonly width: number;
  readonly items: ReadonlyArray<ShellListItem>;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly highlightedId: string | null;
  readonly selectedId: string | null;
  readonly onSelectThread: (threadId: string) => void;
  readonly serverLabel: string | null;
}) {
  const renderItem = useCallback(
    ({ item }: { readonly item: ShellListItem }) =>
      item.type === "header" ? (
        <ProjectHeader project={item.project} />
      ) : (
        <ThreadRow
          thread={item.thread}
          isHighlighted={item.thread.id === props.highlightedId}
          isSelected={item.thread.id === props.selectedId}
          onSelect={props.onSelectThread}
        />
      ),
    [props.highlightedId, props.onSelectThread, props.selectedId],
  );

  return (
    <View style={[styles.sidebar, { width: props.width }]}>
      <View style={styles.brandRow}>
        <View style={styles.brandBox}>
          <AppText style={styles.avatarLetter}>T3</AppText>
        </View>
        <AppText style={styles.brandTitle}>T3 Code</AppText>
        <AppText style={styles.bottomItem}>Nightly</AppText>
      </View>
      <View style={styles.searchWrap}>
        <AppTextInput
          accessibilityLabel="Search threads"
          onChangeText={props.onQueryChange}
          placeholder="Search threads"
          value={props.query}
        />
      </View>
      <ScrollView contentContainerStyle={listContentStyle} style={listStyle}>
        {props.items.map((item) => (
          <View key={item.key}>{renderItem({ item })}</View>
        ))}
      </ScrollView>
      <View style={styles.bottomBar}>
        <AppText style={styles.bottomItem}>Settings</AppText>
        <AppText style={styles.bottomItem}>Pull Requests</AppText>
        <AppText style={styles.bottomItem}>Usage</AppText>
        {props.serverLabel ? (
          <AppText numberOfLines={1} style={styles.serverLabel}>
            {props.serverLabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
