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
import { tokens } from "../components/AppText";
import { ContentPane, KEYBOARD_EVENTS } from "./ContentPane";
import { Sidebar } from "./Sidebar";
import { FIXTURE_PROJECTS, FIXTURE_THREADS } from "./fixtures";
import {
  buildShellListItems,
  groupThreadsByProject,
  listThreadIds,
  stepThreadId,
} from "./listModel";

const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 400;
const SIDEBAR_DEFAULT_WIDTH = 230;

const byId = new Map<string, (typeof FIXTURE_THREADS)[number]>(
  FIXTURE_THREADS.map((thread) => [thread.id, thread]),
);
const projectById = new Map<string, (typeof FIXTURE_PROJECTS)[number]>(
  FIXTURE_PROJECTS.map((project) => [project.id, project]),
);

const clampSidebarWidth = (width: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

const styles = StyleSheet.create({
  handle: {
    alignItems: "center",
    justifyContent: "center",
    width: 6,
  },
  handleBar: {
    backgroundColor: tokens.subtleStrong,
    borderRadius: 2,
    height: 64,
    width: 2,
  },
  root: {
    backgroundColor: tokens.screen,
    flexDirection: "row",
    height: "100%",
    width: "100%",
  },
});

/**
 * Desktop shell (U-008): sidebar with grouped fixture threads + content pane.
 * Mounted behind the U-007 connected state. All state lives here because the
 * keyboard track, the sidebar resize, and both panes consume it.
 */
export function DesktopShell({
  snapshot,
}: {
  readonly snapshot: EnvironmentSnapshot;
}): JSX.Element {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [query, setQuery] = useState("");
  // On macOS the window never hands keyboard focus to a React view on its
  // own (no view is first responder until something claims it), so the shell
  // root claims first responder on mount; keyDownEvents route from there.
  const rootRef = useRef<ComponentRef<typeof View> | null>(null);
  useEffect(() => {
    rootRef.current?.focus();
  }, []);
  const [items, threadIds] = useMemo(() => {
    const nextItems = buildShellListItems(
      groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS),
      query,
    );
    return [nextItems, listThreadIds(nextItems)] as const;
  }, [query]);
  const [highlightedId, setHighlightedId] = useState<string | null>(() => threadIds[0] ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(() => threadIds[0] ?? null);

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
        setSelectedId(highlightedId);
        devLog(`[u008] select ${highlightedId}`);
      }
    },
    [highlightedId, threadIds],
  );

  const handleSelectThread = useCallback((threadId: string) => {
    setHighlightedId(threadId);
    setSelectedId(threadId);
    devLog(`[u008] select ${threadId}`);
  }, []);

  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
  }, []);

  const selectedThread = selectedId === null ? undefined : byId.get(selectedId);
  const highlightedThread = highlightedId === null ? undefined : byId.get(highlightedId);
  const selectedProject = selectedThread ? projectById.get(selectedThread.projectId) : undefined;

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
        onSelectThread={handleSelectThread}
        query={query}
        onQueryChange={handleQueryChange}
        selectedId={selectedId}
        serverLabel={`${snapshot.label} · server ${snapshot.serverVersion}`}
        width={sidebarWidth}
      />
      <View {...resizeResponder.panHandlers} style={styles.handle}>
        <View style={styles.handleBar} />
      </View>
      <ContentPane
        highlightedTitle={highlightedThread?.title ?? "none"}
        onKeyDown={handleKeyDown}
        projectTitle={selectedProject?.title ?? "no project"}
        selectedTitle={selectedThread?.title ?? "Select a thread"}
      />
    </View>
  );
}
