// @effect-diagnostics globalTimers:off -- The streaming screenshot hold is a dev-fixture timer, not Effect-managed retry work.
import * as Schema from "effect/Schema";
import {
  MessageId,
  OrchestrationThread,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationMessage,
} from "@t3tools/contracts";

import { T3SidecarSpawner } from "../sidecar/spawner";
import type { ThreadStreamStore } from "../thread/stores";

/**
 * Dev-only markdown fixture (U-024 verification): selecting the sidebar
 * fixture row "Build an Effect-TS CLI" seeds this thread through the real
 * ThreadStreamStore path when T3CODE_RN_MARKDOWN_FIXTURE is set. No provider
 * is ever contacted — the fixture text is static and the "stream" mode only
 * replays snapshots with growing text.
 *
 * Modes: T3CODE_RN_MARKDOWN_FIXTURE=1 settled showcase.
 *        T3CODE_RN_MARKDOWN_FIXTURE=stream showcase + a streaming message
 *        held mid-fence for ~6s so partial rendering can be screenshotted.
 */

export const MARKDOWN_FIXTURE_ENV = "T3CODE_RN_MARKDOWN_FIXTURE";

// Matches the shell fixture row id in src/shell/fixtures.ts ("Build an
// Effect-TS CLI"); this module must stay out of src/shell (scope).
export const MARKDOWN_FIXTURE_THREAD_ID = "thr_github-effect-ts-cli";

const ISO = "2026-09-13T09:00:00.000Z";

const decodeThreadId = Schema.decodeSync(ThreadId);
const decodeProjectId = Schema.decodeSync(ProjectId);
const decodeMessageId = Schema.decodeSync(MessageId);
const decodeProviderInstanceId = Schema.decodeSync(ProviderInstanceId);
const decodeThread = Schema.decodeSync(OrchestrationThread);

const SHOWCASE = [
  "Markdown rendering parity check. This paragraph covers **bold**, *italic*, `inline code`, and a [link to Effect](https://effect.website) — the blocks below prove the rest of the subset.",
  "",
  "## What renders natively",
  "",
  "- Paragraphs at 15px with comfortable leading",
  "- Headings, rules, and nested emphasis like ***this***",
  "",
  "1. Tokenize blocks",
  "2. Parse inline runs",
  "3. Render native Text views",
  "",
  "> Blockquotes stay calm: a left rule, the same type size, no border box.",
  "",
  "---",
  "",
  "```ts",
  "const session = yield* openThreadSession({",
  '  nodeBin: process.env.NODE_BIN ?? "node",',
  '  hostCjs: "../desktop-rn-host/dist/host.cjs",',
  "});",
  "```",
  "",
  "Closing paragraph after the rule.",
].join("\n");

// Cumulative text of the streaming message; each boundary is a snapshot.
const STREAM_PARTS = [
  "Streaming check: this paragraph is arriving **mid-token and the fence below is intentionally unterminated while the stream is live.",
  "\n\n```ts\nconst pipeline = Effect.gen(function* () {\n  const snap = yield* subscribeThread;",
  "\n  yield* render(snap);\n});\n```",
  "\n\nThe fence closed and the turn completed.",
] as const;

const message = (
  id: string,
  role: "user" | "assistant",
  text: string,
  streaming: boolean,
): OrchestrationMessage => ({
  id: decodeMessageId(id),
  role,
  text,
  turnId: null,
  streaming,
  createdAt: ISO,
  updatedAt: ISO,
});

const fixtureThread = (messages: ReadonlyArray<OrchestrationMessage>) =>
  decodeThread({
    id: decodeThreadId(MARKDOWN_FIXTURE_THREAD_ID),
    projectId: decodeProjectId("prj_github"),
    title: "Build an Effect-TS CLI",
    modelSelection: {
      instanceId: decodeProviderInstanceId("local"),
      model: "Muse Spark 1.3 Contributor",
    },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: "main",
    worktreePath: null,
    latestTurn: null,
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    messages: [...messages],
    activities: [],
    checkpoints: [],
    session: null,
  });

const settledThread = () =>
  fixtureThread([
    message("msg_markdown-user", "user", "Screenshot the full markdown subset.", false),
    message("msg_markdown-showcase", "assistant", SHOWCASE, false),
  ]);

const streamingThread = (text: string, streaming: boolean) =>
  fixtureThread([
    ...settledThread().messages,
    message("msg_markdown-stream", "assistant", text, streaming),
  ]);

let pendingTimers: ReadonlyArray<ReturnType<typeof setTimeout>> = [];

let snapshotSequence = 0;

const snapshotItem = (thread: ReturnType<typeof fixtureThread>) => ({
  snapshotSequence: (snapshotSequence += 1),
  thread,
});

const clearPending = (): void => {
  for (const timer of pendingTimers) clearTimeout(timer);
  pendingTimers = [];
};

const schedule = (store: ThreadStreamStore, delayMs: number, apply: () => void): void => {
  pendingTimers = [...pendingTimers, setTimeout(() => apply(), delayMs)];
};

/**
 * Called from ThreadView on selection. Inert unless the selected thread is the
 * markdown fixture row and the launch env carries the fixture flag, so the
 * production path (and the live thread subscription) never sees it.
 */
export const seedMarkdownFixture = (store: ThreadStreamStore, threadId: string | null): void => {
  if (threadId !== MARKDOWN_FIXTURE_THREAD_ID) return;
  void T3SidecarSpawner?.launchEnvironment()
    .then((env) => {
      const mode = env[MARKDOWN_FIXTURE_ENV];
      if (mode !== "1" && mode !== "stream") return;
      clearPending();
      if (mode === "1") {
        store.apply({ kind: "snapshot", snapshot: snapshotItem(settledThread()) });
        return;
      }
      store.apply({
        kind: "snapshot",
        snapshot: snapshotItem(streamingThread(STREAM_PARTS[0]!, true)),
      });
      schedule(store, 6000, () =>
        store.apply({
          kind: "snapshot",
          snapshot: snapshotItem(streamingThread(STREAM_PARTS[0]! + STREAM_PARTS[1]!, true)),
        }),
      );
      schedule(store, 12000, () =>
        store.apply({
          kind: "snapshot",
          snapshot: snapshotItem(
            streamingThread(STREAM_PARTS[0]! + STREAM_PARTS[1]! + STREAM_PARTS[2]!, true),
          ),
        }),
      );
      schedule(store, 18000, () =>
        store.apply({
          kind: "snapshot",
          snapshot: snapshotItem(streamingThread(STREAM_PARTS.join(""), false)),
        }),
      );
    })
    .catch(() => undefined);
};
