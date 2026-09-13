import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type JSX,
} from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import type { KeyEvent } from "react-native/Libraries/Types/CoreEventTypes";

import type { EnvironmentSnapshot } from "../connection/connect";
import { devLog } from "../devLog";
import type { ThreadSession } from "../thread/session";
import { useShellState } from "../thread/stores";
import { ContentPane, KEYBOARD_EVENTS } from "./ContentPane";
import { sidebarColors } from "./colors";
import { FIXTURE_PROJECTS, FIXTURE_THREADS } from "./fixtures";
import { Sidebar } from "./Sidebar";
import {
  buildShellListItems,
  groupThreadsByProject,
  listThreadIds,
  stepThreadId,
} from "./listModel";

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 230;

const clampSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

const styles = StyleSheet.create({
  handle: {
    width: 6,
  },
  root: {
    backgroundColor: sidebarColors.sidebarBg,
    flexDirection: "row",
    height: "100%",
    width: "100%",
  },
});

/**
 * Desktop shell (U-008/U-011/U-025): parity sidebar over the live shell
 * subscription merged with the fixture threads, and the content pane running
 * the live thread view. All state lives here because the keyboard track, the
 * sidebar resize, and both panes consume it.
 */
export function DesktopShell({
  snapshot,
  session,
}: {
  readonly snapshot: EnvironmentSnapshot;
  readonly session: ThreadSession;
}): JSX.Element {
  const shell = useShellState(session.shellStore);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [query, setQuery] = useState("");
  const [settledExpanded, setSettledExpanded] = useState(false);
  // On macOS the window never hands keyboard focus to a React view on its
  // own (no view is first responder until something claims it), so the shell
  // root claims first responder on mount; keyDownEvents route from there.
  const rootRef = useRef<ComponentRef<typeof View> | null>(null);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);
  const projects = useMemo(() => {
    const liveIds = new Set(shell.projects.map((project) => project.id));
    return [...shell.projects, ...FIXTURE_PROJECTS.filter((project) => !liveIds.has(project.id))];
  }, [shell.projects]);
  const threads = useMemo(() => {
    const liveIds = new Set(shell.threads.map((thread) => thread.id));
    return [...shell.threads, ...FIXTURE_THREADS.filter((thread) => !liveIds.has(thread.id))];
  }, [shell.threads]);
  const [items, threadIds] = useMemo(() => {
    const nextItems = buildShellListItems(
      groupThreadsByProject(projects, threads),
      query,
      settledExpanded,
    );
    return [nextItems, listThreadIds(nextItems)] as const;
  }, [projects, query, settledExpanded, threads]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fixture rows have no server thread behind them; selecting one stays
  // visual so the live thread subscription never sees a synthetic id.
  const fixtureThreadIds = useMemo(
    () => new Set<string>(FIXTURE_THREADS.map((thread) => thread.id)),
    [],
  );

  const selectThread = useCallback(
    (threadId: string | null) => {
      setSelectedId(threadId);
      if (threadId !== null && fixtureThreadIds.has(threadId)) return;
      session.selectThread(threadId);
    },
    [fixtureThreadIds, session],
  );

  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const dragStartRef = useRef<{ pageX: number; width: number } | null>(null);
  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        dragStartRef.current = {
          pageX: event.nativeEvent.pageX,
          width: sidebarWidthRef.current,
        };
      },
      onPanResponderMove: (event) => {
        const start = dragStartRef.current;
        if (!start) return;
        const next = clampSidebarWidth(start.width + (event.nativeEvent.pageX - start.pageX));
        sidebarWidthRef.current = next;
        setSidebarWidth(next);
      },
      onPanResponderRelease: () => {
        dragStartRef.current = null;
        devLog(`[u008] sidebar width ${sidebarWidthRef.current}`);
      },
    }),
  ).current;

  const handleKeyDown = useCallback(
    (event: KeyEvent) => {
      const key = event.nativeEvent.key;
      if (key === "ArrowUp" || key === "ArrowDown") {
        const next = stepThreadId(threadIds, highlightedId, key === "ArrowDown" ? 1 : -1);
        if (next !== null && next !== highlightedId) {
          setHighlightedId(next);
          devLog(`[u008] highlight ${next}`);
        }
      } else if (key === "Enter" && highlightedId !== null) {
        selectThread(highlightedId);
        devLog(`[u008] select ${highlightedId}`);
      }
    },
    [highlightedId, selectThread, threadIds],
  );

  const handleSelectThread = useCallback(
    (threadId: string) => {
      setHighlightedId(threadId);
      selectThread(threadId);
      devLog(`[u008] select ${threadId}`);
    },
    [selectThread],
  );

  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
  }, []);

  const handleToggleSettled = useCallback(() => {
    setSettledExpanded((expanded) => !expanded);
  }, []);

  const selectedThread =
    selectedId === null ? undefined : threads.find((thread) => thread.id === selectedId);
  const highlightedThread =
    highlightedId === null ? undefined : threads.find((thread) => thread.id === highlightedId);
  const selectedProject =
    selectedThread === undefined
      ? undefined
      : projects.find((project) => project.id === selectedThread.projectId);

  return (
    <View
      ref={rootRef}
      focusable
      keyDownEvents={KEYBOARD_EVENTS}
      onKeyDown={handleKeyDown}
      style={styles.root}
    >
      <Sidebar
        highlightedId={highlightedId}
        items={items}
        onQueryChange={handleQueryChange}
        onSelectThread={handleSelectThread}
        onToggleSettled={handleToggleSettled}
        query={query}
        selectedId={selectedId}
        settledExpanded={settledExpanded}
        width={sidebarWidth}
      />
      <View {...resizeResponder.panHandlers} style={styles.handle} />
      <ContentPane
        highlightedTitle={highlightedThread?.title ?? "none"}
        onKeyDown={handleKeyDown}
        onThreadCreated={handleSelectThread}
        projectTitle={selectedProject?.title ?? snapshot.label}
        selectedTitle={selectedThread?.title ?? "New thread"}
        session={session}
        threadId={selectedId}
      />
    </View>
  );
}
