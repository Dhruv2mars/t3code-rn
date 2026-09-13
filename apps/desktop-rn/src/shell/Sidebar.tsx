import { memo, useCallback } from "react";
import { LegendList, useRecyclingState } from "@legendapp/list/react-native";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import type { OrchestrationProjectShell, OrchestrationThreadShell } from "@t3tools/contracts";

import { AppText, AppTextInput, cx } from "../components/AppText";
import { formatRelativeTime, type ShellListItem } from "./listModel";

const NOW = "2026-09-13T09:00:00.000Z";

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

const keyExtractor = (item: ShellListItem): string => item.key;
const getItemType = (item: ShellListItem): string => item.type;

function ProjectAvatar({ project }: { readonly project: OrchestrationProjectShell }) {
  return (
    <View
      className="h-4 w-4 items-center justify-center rounded"
      style={{ backgroundColor: projectAccent(project.id) }}
    >
      <AppText className="text-2xs font-bold text-white">
        {project.title.slice(0, 1).toUpperCase()}
      </AppText>
    </View>
  );
}

function ProjectHeader({ project }: { readonly project: OrchestrationProjectShell }) {
  return (
    <View className="flex-row items-center gap-2 px-4 pb-1 pt-3">
      <ProjectAvatar project={project} />
      <AppText className="text-2xs font-semibold uppercase tracking-wide text-foreground-muted">
        {project.title}
      </AppText>
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
  const [hovered, setHovered] = useRecyclingState(false);
  const background = props.isSelected
    ? "bg-subtle-strong"
    : props.isHighlighted || hovered
      ? "bg-subtle"
      : undefined;
  return (
    <View
      className={cx("h-11 flex-row items-center px-4", background)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Pressable
        accessibilityLabel={`Select thread ${props.thread.title}`}
        accessibilityRole="button"
        className="h-full flex-1 flex-row items-center"
        onPress={() => props.onSelect(props.thread.id)}
      >
        <AppText numberOfLines={1} className="flex-1 text-sm text-foreground">
          {props.thread.title}
        </AppText>
        {hovered ? (
          <View className="ml-2 flex-row gap-3">
            <AppText className="text-2xs text-foreground-secondary">Snooze</AppText>
            <AppText className="text-2xs text-foreground-secondary">Settle</AppText>
          </View>
        ) : (
          <AppText className="ml-2 text-2xs text-foreground-muted">
            {formatRelativeTime(props.thread.updatedAt, NOW)}
          </AppText>
        )}
      </Pressable>
      {props.isSelected ? <View className="ml-1 h-4 w-0.5 rounded bg-accent" /> : null}
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
    <View className="h-full flex-col bg-sidebar" style={{ width: props.width }}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <View className="h-6 w-6 items-center justify-center rounded-md bg-accent">
          <AppText className="text-2xs font-bold text-white">T3</AppText>
        </View>
        <AppText className="text-sm font-bold text-foreground">T3 Code</AppText>
        <AppText className="text-2xs text-foreground-muted">Nightly</AppText>
      </View>
      <View className="px-3 pb-2">
        <AppTextInput
          accessibilityLabel="Search threads"
          onChangeText={props.onQueryChange}
          placeholder="Search threads"
          value={props.query}
        />
      </View>
      <LegendList
        contentContainerStyle={listContentStyle}
        data={props.items}
        estimatedItemSize={44}
        extraData={`${props.highlightedId}:${props.selectedId}`}
        getItemType={getItemType}
        keyExtractor={keyExtractor}
        recycleItems
        renderItem={renderItem}
        style={listStyle}
      />
      <View className="flex-row items-center gap-4 border-t border-border px-4 py-2.5">
        <AppText className="text-2xs text-foreground-muted">Settings</AppText>
        <AppText className="text-2xs text-foreground-muted">Pull Requests</AppText>
        <AppText className="text-2xs text-foreground-muted">Usage</AppText>
        {props.serverLabel ? (
          <AppText numberOfLines={1} className="flex-1 text-right text-2xs text-foreground-muted">
            {props.serverLabel}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
