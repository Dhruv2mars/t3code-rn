// @effect-diagnostics globalDate:off -- Command timestamps are ISO strings built in plain async send callbacks outside the Effect runtime.
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import * as Socket from "effect/unstable/socket/Socket";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import {
  CommandId,
  MessageId,
  ORCHESTRATION_WS_METHODS,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  WS_METHODS,
  WsRpcGroup,
  type ClientOrchestrationCommand,
  type ModelSelection,
} from "@t3tools/contracts";

import {
  ConnectFailure,
  connectTransport,
  describeCause,
  snapshotOf,
  type ConnectEvent,
  type ConnectStage,
  type EnvironmentSnapshot,
} from "../connection/connect";
import { ShellStore, ThreadStreamStore } from "./stores";
import { titleFromMessage } from "./listModel";

// Same protocol stack as the U-007 probe (WebSocket + JSON RPC over the real
// WsRpcGroup), but the scope is held open for the app lifetime.
const protocolLayer = (wsUrl: string): Layer.Layer<RpcClient.Protocol> => {
  const hooks = RpcClient.ConnectionHooks.of({
    onConnect: Effect.void,
    onDisconnect: Effect.void,
  });
  const socketLayer = Socket.layerWebSocket(wsUrl, { openTimeout: "15 seconds" }).pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
  );
  return Layer.effect(
    RpcClient.Protocol,
    RpcClient.makeProtocolSocket({
      retryTransientErrors: false,
      retryPolicy: Schedule.recurs(0),
    }),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        socketLayer,
        RpcSerialization.layerJson,
        Layer.succeed(RpcClient.ConnectionHooks, hooks),
      ),
    ),
  );
};

const decodeThreadId = Schema.decodeSync(ThreadId);
const decodeMessageId = Schema.decodeSync(MessageId);
const decodeCommandId = Schema.decodeSync(CommandId);
const decodeProjectId = Schema.decodeSync(ProjectId);
const decodeProviderInstanceId = Schema.decodeSync(ProviderInstanceId);

let idCounter = 0;

const randomId = (): string => {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  } else {
    const stamp = ++idCounter;
    bytes[0] = (stamp >>> 24) & 0xff;
    bytes[1] = (stamp >>> 16) & 0xff;
    bytes[2] = (stamp >>> 8) & 0xff;
    bytes[3] = stamp & 0xff;
    bytes[6] = 0x40;
    bytes[8] = 0x80;
  }
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
};

export interface ThreadSession {
  readonly shellStore: ShellStore;
  readonly threadStore: ThreadStreamStore;
  readonly selectedThreadId: () => string | null;
  readonly selectThread: (threadId: string | null) => void;
  readonly sendUserMessage: (text: string) => Promise<void>;
}

export interface OpenThreadSessionInput {
  readonly nodeBin: string;
  readonly hostCjs: string;
  readonly onEvent: (event: ConnectEvent) => void;
  readonly onReady: (session: ThreadSession, snapshot: EnvironmentSnapshot) => void;
  readonly onFatal: (stage: ConnectStage, message: string) => void;
}

export const openThreadSession = (input: OpenThreadSessionInput): void => {
  void Effect.runPromise(
    Effect.gen(function* () {
      const transport = yield* connectTransport(input);
      input.onEvent({ tag: "stage", stage: "rpc" });
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(WsRpcGroup);
          input.onEvent({ tag: "debug", detail: "rpc client created" });
          const shellStore = new ShellStore();
          const threadStore = new ThreadStreamStore();

          // One-shot config snapshot on the same socket: the U-007 proof that
          // the RPC exchange is live, carried by the session itself. Taken
          // before any long-lived subscription forks.
          const snapshotHead = yield* client[WS_METHODS.subscribeServerConfig]({}).pipe(
            Stream.take(1),
            Stream.runHead,
            Effect.timeout("30 seconds"),
            Effect.mapError(
              (cause) =>
                new ConnectFailure({
                  stage: "rpc",
                  message: `config snapshot: ${describeCause(cause)}`,
                }),
            ),
          );
          input.onEvent({ tag: "debug", detail: "config snapshot frame received" });
          if (Option.isNone(snapshotHead)) {
            return yield* new ConnectFailure({
              stage: "rpc",
              message: "subscribeServerConfig ended without a snapshot event",
            });
          }
          const snapshot = snapshotOf(snapshotHead.value);

          yield* client[ORCHESTRATION_WS_METHODS.subscribeShell]({}).pipe(
            Stream.runForEach((item) =>
              Effect.sync(() => {
                shellStore.apply(item);
              }),
            ),
            Effect.catch((cause) =>
              Effect.sync(() => {
                input.onEvent({
                  tag: "debug",
                  detail: `shell subscription failed: ${describeCause(cause)}`,
                });
              }),
            ),
            Effect.forkScoped,
          );

          let threadFiber: ReturnType<typeof Effect.runFork> | null = null;
          let selectedThreadId: string | null = null;
          const selectThread = (threadId: string | null): void => {
            selectedThreadId = threadId;
            threadFiber?.interruptUnsafe();
            if (threadId === null) {
              threadStore.resetToIdle();
              return;
            }
            threadStore.setSyncing();
            threadFiber = Effect.runFork(
              client[ORCHESTRATION_WS_METHODS.subscribeThread]({
                threadId: decodeThreadId(threadId),
              }).pipe(
                Stream.runForEach((item) =>
                  Effect.sync(() => {
                    threadStore.apply(item);
                  }),
                ),
                Effect.catch((cause) =>
                  Effect.sync(() => {
                    input.onEvent({
                      tag: "debug",
                      detail: `thread subscription failed: ${describeCause(cause)}`,
                    });
                    threadStore.setNotice({ text: describeCause(cause), tone: "error" });
                  }),
                ),
              ),
            );
          };

          const dispatch = (command: ClientOrchestrationCommand): Promise<void> =>
            Effect.runPromise(
              client[ORCHESTRATION_WS_METHODS.dispatchCommand](command).pipe(Effect.asVoid),
            );

          const pickModelSelection = async (): Promise<ModelSelection | null> => {
            const config = await Effect.runPromise(client[WS_METHODS.serverGetConfig]({}));
            for (const provider of config.providers) {
              const model = provider.models.find((entry) => entry.isDefault) ?? provider.models[0];
              if (provider.enabled && model !== undefined) {
                return {
                  instanceId: decodeProviderInstanceId(provider.instanceId),
                  model: model.slug,
                };
              }
            }
            return null;
          };

          const ensureProject = async (): Promise<ProjectId> => {
            const existing = shellStore.getSnapshot().projects[0];
            if (existing) return existing.id;
            const projectId = decodeProjectId(randomId());
            const workspaceRoot = snapshot.cwd;
            const title = workspaceRoot.split("/").filter(Boolean).pop() ?? workspaceRoot;
            await dispatch({
              type: "project.create",
              commandId: decodeCommandId(randomId()),
              projectId,
              title,
              workspaceRoot,
              createWorkspaceRootIfMissing: true,
              createdAt: new Date().toISOString(),
            });
            return projectId;
          };

          const sendUserMessage = async (text: string): Promise<void> => {
            const createdAt = new Date().toISOString();
            try {
              // Turn start only needs the thread id; the detail snapshot may
              // still be syncing on a freshly selected thread.
              const selectedId = selectedThreadId;
              const activeThread = threadStore.getSnapshot().thread;
              if (selectedId !== null) {
                await dispatch({
                  type: "thread.turn.start",
                  commandId: decodeCommandId(randomId()),
                  threadId: decodeThreadId(selectedId),
                  message: {
                    messageId: decodeMessageId(randomId()),
                    role: "user",
                    text,
                    attachments: [],
                  },
                  runtimeMode: activeThread?.runtimeMode ?? "full-access",
                  interactionMode: activeThread?.interactionMode ?? "default",
                  createdAt,
                });
                return;
              }
              const projectId = await ensureProject();
              const threadId = decodeThreadId(randomId());
              const modelSelection = await pickModelSelection();
              if (modelSelection === null) {
                throw new Error("no enabled provider instance is configured on this server");
              }
              await dispatch({
                type: "thread.create",
                commandId: decodeCommandId(randomId()),
                threadId,
                projectId,
                title: titleFromMessage(text),
                modelSelection,
                runtimeMode: "full-access",
                interactionMode: "default",
                branch: null,
                worktreePath: null,
                createdAt,
              });
              await dispatch({
                type: "thread.turn.start",
                commandId: decodeCommandId(randomId()),
                threadId,
                message: {
                  messageId: decodeMessageId(randomId()),
                  role: "user",
                  text,
                  attachments: [],
                },
                modelSelection,
                titleSeed: titleFromMessage(text),
                runtimeMode: "full-access",
                interactionMode: "default",
                createdAt,
              });
              selectThread(threadId);
            } catch (cause) {
              threadStore.setNotice({ text: describeCause(cause), tone: "error" });
              throw cause;
            }
          };

          input.onReady(
            {
              shellStore,
              threadStore,
              selectedThreadId: () => selectedThreadId,
              selectThread,
              sendUserMessage,
            },
            snapshot,
          );
          return yield* Effect.never;
        }).pipe(Effect.provide(protocolLayer(transport.wsUrl))),
      );
    }).pipe(
      Effect.catch((cause) =>
        Effect.sync(() => {
          const failure = cause as { stage?: ConnectStage; message?: string };
          input.onFatal(failure.stage ?? "rpc", failure.message ?? describeCause(cause));
        }),
      ),
    ),
  );
};
