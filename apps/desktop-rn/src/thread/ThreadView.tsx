import { useCallback, useEffect, useMemo, type JSX } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, tokens } from "../components/AppText";
import { Composer } from "../composer/Composer";
import type { ModelEntry } from "../composer/modelDisplay";
import { seedMarkdownFixture } from "../markdown/fixture";
import { buildStreamListItems } from "./listModel";
import { MessageStream } from "./MessageStream";
import { useShellState, useThreadStreamState } from "./stores";
import type { ThreadSession } from "./session";

const styles = StyleSheet.create({
  emptyWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyCard: {
    borderColor: tokens.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    width: 560,
  },
  emptyPrompt: {
    color: tokens.foreground,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  syncingNote: {
    color: tokens.foregroundMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  syncingWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  paneBody: {
    flex: 1,
    minHeight: 0,
  },
});

const COMPOSER_PLACEHOLDER = "Ask anything, @tag files/folders, $use skills, or / for commands";

/**
 * Local visual-verification flag for the stop state. The session surface
 * this unit may read (thread stream state) only exposes per-message
 * streaming flags, which the server settles before the client sees them,
 * so a live running turn cannot be derived in scope today. Flip to true to
 * render the stop state for the parity screenshots; ships false.
 */
const MOCK_WORKING = false;

const modelEntryKey = (instanceId: string, model: string): string => `${instanceId}/${model}`;

/** Real model selections seen on this server (current thread first, then the shell history). */
const collectModelEntries = (
  current: { instanceId: string; model: string } | null,
  threads: ReadonlyArray<{ modelSelection: { instanceId: string; model: string } }>,
): ReadonlyArray<ModelEntry> => {
  const entries = new Map<string, ModelEntry>();
  if (current !== null) {
    entries.set(modelEntryKey(current.instanceId, current.model), {
      instanceId: current.instanceId,
      model: current.model,
    });
  }
  for (const thread of threads) {
    const { instanceId, model } = thread.modelSelection;
    const key = modelEntryKey(instanceId, model);
    if (!entries.has(key)) entries.set(key, { instanceId, model });
  }
  return [...entries.values()];
};

/**
 * Main pane for one thread: live message stream plus composer, or the
 * captured new-thread empty state (prompt + floating composer) when nothing
 * is selected.
 */
export function ThreadView(props: {
  readonly session: ThreadSession;
  readonly threadId: string | null;
  readonly projectTitle: string;
  readonly onThreadCreated: (threadId: string) => void;
}): JSX.Element {
  const stream = useThreadStreamState(props.session.threadStore);
  const shell = useShellState(props.session.shellStore);
  const items = useMemo(() => buildStreamListItems(stream.thread, stream.notice), [stream]);

  // U-024 dev fixture: renders the markdown showcase thread when the fixture
  // flag is set at launch and nothing (or the fixture row) is selected.
  useEffect(() => {
    seedMarkdownFixture(props.session.threadStore, props.threadId);
  }, [props.session.threadStore, props.threadId]);

  const handleSend = useCallback(
    (text: string) =>
      props.session.sendUserMessage(text).then(() => {
        const created = props.session.selectedThreadId();
        if (created !== null) props.onThreadCreated(created);
      }),
    [props],
  );

  const composerProps = {
    availableModels: collectModelEntries(stream.thread?.modelSelection ?? null, shell.threads),
    interactionMode: stream.thread?.interactionMode ?? null,
    model: stream.thread?.modelSelection ?? null,
    onSend: handleSend,
    placeholder: COMPOSER_PLACEHOLDER,
    runtimeMode: stream.thread?.runtimeMode ?? null,
    // The thread event stream carries per-message streaming flags; the
    // latestTurn snapshot only refreshes on coarser server updates.
    working: MOCK_WORKING || stream.thread?.latestTurn?.state === "running",
  };

  if (props.threadId === null && stream.thread === null) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <AppText style={styles.emptyPrompt}>
            {`What should we build in ${props.projectTitle}?`}
          </AppText>
          <Composer {...composerProps} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.paneBody}>
      {stream.status !== "live" && stream.thread === null ? (
        <View style={styles.syncingWrap}>
          <AppText style={styles.syncingNote}>Syncing thread…</AppText>
        </View>
      ) : null}
      <MessageStream items={items} />
      <Composer {...composerProps} />
    </View>
  );
}
