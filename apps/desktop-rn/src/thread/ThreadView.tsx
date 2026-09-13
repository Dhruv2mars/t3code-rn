import { useCallback, useEffect, useMemo, type JSX } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, tokens } from "../components/AppText";
import { seedMarkdownFixture } from "../markdown/fixture";
import { buildStreamListItems } from "./listModel";
import { Composer } from "./Composer";
import { MessageStream } from "./MessageStream";
import { useThreadStreamState, type ThreadStreamState } from "./stores";
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

const composerLabels = (state: ThreadStreamState): { model: string; runtime: string } => ({
  model: state.thread?.modelSelection.model ?? "Model",
  runtime: state.thread?.runtimeMode ?? "Full access",
});

const COMPOSER_PLACEHOLDER = "Ask for changes, send follow-ups, or attach images";

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
  const items = useMemo(() => buildStreamListItems(stream.thread, stream.notice), [stream]);
  const labels = composerLabels(stream);

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

  if (props.threadId === null && stream.thread === null) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyCard}>
          <AppText style={styles.emptyPrompt}>
            {`What should we build in ${props.projectTitle}?`}
          </AppText>
          <Composer
            modelLabel={labels.model}
            onSend={handleSend}
            placeholder={COMPOSER_PLACEHOLDER}
            runtimeLabel={labels.runtime}
          />
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
      <Composer
        modelLabel={labels.model}
        onSend={handleSend}
        placeholder={COMPOSER_PLACEHOLDER}
        runtimeLabel={labels.runtime}
      />
    </View>
  );
}
