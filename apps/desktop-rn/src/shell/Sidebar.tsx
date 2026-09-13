// @effect-diagnostics globalDate:off
// @effect-diagnostics globalTimers:off -- The relative-time label anchors to wall-clock now at launch and the working pill ticks with setInterval.
import { memo, useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import type { OrchestrationThreadShell } from "@t3tools/contracts";

import { AppText } from "../components/AppText";
import { sidebarColors } from "./colors";
import {
  BarChartIcon,
  ChevronDownIcon,
  ComposeIcon,
  DraftIcon,
  FolderIcon,
  FolderPlusIcon,
  GearIcon,
  GitPullRequestIcon,
  PanelLeftIcon,
  RefreshIcon,
  SearchIcon,
  WorkingSpinner,
} from "./icons";
import { formatRelativeTime, formatWorkingElapsed, type ShellListItem } from "./listModel";

const NOW = new Date().toISOString();

const listStyle: StyleProp<ViewStyle> = { flex: 1 };
const listContentStyle: StyleProp<ViewStyle> = { paddingBottom: 8 };

const styles = StyleSheet.create({
  bottomBar: {
    alignItems: "center",
    columnGap: 20,
    flexDirection: "row",
    height: 50,
    paddingLeft: 18,
    paddingRight: 18,
  },
  bottomButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    alignItems: "center",
    columnGap: 10,
    flexDirection: "row",
    height: 24,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  brandTitle: {
    color: sidebarColors.brandText,
    fontSize: 15,
    fontWeight: "600",
  },
  chevronBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  chevronExpanded: {
    transform: [{ rotate: "180deg" }],
  },
  chipIcon: {
    color: sidebarColors.chipIconBlue,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    width: 24,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 16,
  },
  chipTitle: {
    color: sidebarColors.titleMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 16,
    marginLeft: 4,
  },
  draftBox: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 16,
    justifyContent: "flex-end",
    marginTop: 0,
  },
  listItem: {
    marginBottom: 12,
    marginHorizontal: 10,
  },
  nightlyPill: {
    backgroundColor: sidebarColors.pillBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  nightlyText: {
    color: sidebarColors.pillText,
    fontSize: 11,
    lineHeight: 13,
  },
  rowCard: {
    backgroundColor: sidebarColors.rowCardBg,
    borderRadius: 10,
  },
  rowHighlight: {
    backgroundColor: sidebarColors.rowHighlightBg,
    borderRadius: 10,
  },
  rowHover: {
    backgroundColor: sidebarColors.rowHoverBg,
    borderRadius: 10,
  },
  rowPress: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  rowTime: {
    color: sidebarColors.titleMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  rowTitle: {
    color: sidebarColors.titleMuted,
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 8,
  },
  rowTitleSelected: {
    color: sidebarColors.titleSelected,
  },
  searchAction: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 30,
  },
  searchActions: {
    backgroundColor: sidebarColors.buttonGroupBg,
    borderRadius: 8,
    flexDirection: "row",
  },
  searchInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    color: sidebarColors.titleSelected,
    flex: 1,
    fontSize: 15,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  searchRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 32,
    marginBottom: 13,
    marginHorizontal: 10,
    marginTop: 22,
  },
  searchRowIcon: {
    marginLeft: 12,
  },
  settledHeader: {
    alignItems: "center",
    flexDirection: "row",
    height: 20,
    marginHorizontal: 10,
    paddingHorizontal: 6,
  },
  settledRule: {
    backgroundColor: sidebarColors.hairline,
    flex: 1,
    height: 1,
    marginHorizontal: 10,
  },
  settledText: {
    color: sidebarColors.settledText,
    fontSize: 13,
  },
  sidebar: {
    backgroundColor: sidebarColors.sidebarBg,
    borderRightColor: sidebarColors.sidebarEdge,
    borderRightWidth: 1,
    height: "100%",
  },
  workingPill: {
    alignItems: "center",
    columnGap: 5,
    flexDirection: "row",
  },
  workingText: {
    color: sidebarColors.workingBlue,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 16,
  },
});

/** Ticking working pill; the 1s interval lives here so only running rows re-render. */
const WorkingPill = memo(function WorkingPill(props: { readonly startedAt: string }) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.workingPill}>
      <WorkingSpinner color={sidebarColors.workingBlue} />
      <AppText style={styles.workingText}>
        {`Working ${formatWorkingElapsed(props.startedAt, now)}`}
      </AppText>
    </View>
  );
});

const SettledHeader = memo(function SettledHeader(props: {
  readonly count: number;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Toggle settled threads"
      accessibilityRole="button"
      onPress={props.onToggle}
      style={styles.settledHeader}
    >
      <AppText style={styles.settledText}>{`Settled (${props.count})`}</AppText>
      <View style={styles.settledRule} />
      <View style={[styles.chevronBox, props.expanded ? styles.chevronExpanded : null]}>
        <ChevronDownIcon color={sidebarColors.iconMid} />
      </View>
    </Pressable>
  );
});

const ThreadRow = memo(function ThreadRow(props: {
  readonly thread: OrchestrationThreadShell;
  readonly projectTitle: string;
  readonly isHighlighted: boolean;
  readonly isSelected: boolean;
  readonly onSelect: (threadId: string) => void;
}) {
  // Hover resets when the row is recycled onto another thread.
  const [hovered, setHovered] = useState(false);
  const working = props.thread.latestTurn?.state === "running";
  const startedAt = props.thread.latestTurn?.startedAt ?? props.thread.latestTurn?.requestedAt;
  const background = props.isSelected
    ? styles.rowCard
    : props.isHighlighted
      ? styles.rowHighlight
      : hovered
        ? styles.rowHover
        : null;
  return (
    <View
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={[styles.listItem, background]}
    >
      <Pressable
        accessibilityLabel={`Select thread ${props.thread.title}`}
        accessibilityRole="button"
        onPress={() => props.onSelect(props.thread.id)}
        style={styles.rowPress}
      >
        <View style={styles.chipRow}>
          <AppText style={styles.chipIcon}>{"</>"}</AppText>
          <AppText numberOfLines={1} style={styles.chipTitle}>
            {props.projectTitle}
          </AppText>
          {working && startedAt ? (
            <WorkingPill startedAt={startedAt} />
          ) : (
            <AppText style={styles.rowTime}>
              {formatRelativeTime(props.thread.updatedAt, NOW)}
            </AppText>
          )}
        </View>
        <AppText
          numberOfLines={1}
          style={[styles.rowTitle, props.isSelected ? styles.rowTitleSelected : null]}
        >
          {props.thread.title}
        </AppText>
        <View style={styles.draftBox}>
          <DraftIcon ring={sidebarColors.draftRing} core={sidebarColors.draftCore} />
        </View>
      </Pressable>
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
  readonly settledExpanded: boolean;
  readonly onToggleSettled: () => void;
}) {
  const renderItem = useCallback(
    ({ item }: { readonly item: ShellListItem }) =>
      item.type === "settled-header" ? (
        <SettledHeader
          count={item.count}
          expanded={props.settledExpanded}
          onToggle={props.onToggleSettled}
        />
      ) : (
        <ThreadRow
          isHighlighted={item.thread.id === props.highlightedId}
          isSelected={item.thread.id === props.selectedId}
          projectTitle={item.projectTitle}
          thread={item.thread}
          onSelect={props.onSelectThread}
        />
      ),
    [
      props.highlightedId,
      props.onSelectThread,
      props.onToggleSettled,
      props.selectedId,
      props.settledExpanded,
    ],
  );

  return (
    <View style={[styles.sidebar, { width: props.width }]}>
      <View style={styles.brandRow}>
        <PanelLeftIcon color={sidebarColors.iconBright} />
        <AppText style={styles.brandTitle}>T3 Code</AppText>
        <View style={styles.nightlyPill}>
          <AppText style={styles.nightlyText}>Nightly</AppText>
        </View>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchRowIcon}>
          <SearchIcon color={sidebarColors.searchDim} />
        </View>
        <RNTextInput
          accessibilityLabel="Search threads"
          autoCorrect={false}
          onChangeText={props.onQueryChange}
          placeholder="Search"
          placeholderTextColor={sidebarColors.searchDim}
          style={styles.searchInput}
          value={props.query}
        />
        <View style={styles.searchActions}>
          <Pressable
            accessibilityLabel="Open project"
            accessibilityRole="button"
            style={styles.searchAction}
          >
            <FolderIcon color={sidebarColors.searchDim} />
          </Pressable>
          <Pressable
            accessibilityLabel="New project"
            accessibilityRole="button"
            style={styles.searchAction}
          >
            <FolderPlusIcon color={sidebarColors.searchDim} />
          </Pressable>
          <Pressable
            accessibilityLabel="New draft"
            accessibilityRole="button"
            style={styles.searchAction}
          >
            <ComposeIcon color={sidebarColors.searchDim} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={listContentStyle} style={listStyle}>
        {props.items.map((item) => (
          <View key={item.key}>{renderItem({ item })}</View>
        ))}
      </ScrollView>
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityLabel="Settings"
          accessibilityRole="button"
          style={styles.bottomButton}
        >
          <GearIcon color={sidebarColors.iconDim} holeColor={sidebarColors.sidebarBg} />
        </Pressable>
        <Pressable
          accessibilityLabel="Pull Requests"
          accessibilityRole="button"
          style={styles.bottomButton}
        >
          <GitPullRequestIcon color={sidebarColors.iconDim} />
        </Pressable>
        <Pressable
          accessibilityLabel="Usage"
          accessibilityRole="button"
          style={styles.bottomButton}
        >
          <BarChartIcon color={sidebarColors.iconDim} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityLabel="Refresh"
          accessibilityRole="button"
          style={styles.bottomButton}
        >
          <RefreshIcon color={sidebarColors.iconDim} />
        </Pressable>
      </View>
    </View>
  );
}
