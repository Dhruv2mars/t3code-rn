import {
  bootstrapRemoteBearerSession,
  resolveRemoteWebSocketConnectionUrl,
} from "@t3tools/client-runtime/authorization";
import { remoteHttpClientLayer } from "@t3tools/client-runtime/rpc";
import { WS_METHODS, WsRpcGroup } from "@t3tools/contracts";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";
import * as Socket from "effect/unstable/socket/Socket";
import * as Stream from "effect/Stream";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import { spawnSidecar, type RunningSidecar } from "../sidecar/spawner";

export const CONNECT_STAGES = ["spawn", "handshake", "exchange", "ticket", "ws", "rpc"] as const;

export type ConnectStage = (typeof CONNECT_STAGES)[number];

export interface EnvironmentSnapshot {
  readonly label: string;
  readonly os: string;
  readonly arch: string;
  readonly serverVersion: string;
  readonly cwd: string;
}

export class ConnectFailure extends Data.TaggedError("ConnectFailure")<{
  readonly stage: ConnectStage;
  readonly message: string;
}> {}

interface HostHandshake {
  readonly pid: number;
  readonly port: number;
  readonly token: string;
}

const isHandshake = (value: unknown): value is HostHandshake =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as HostHandshake).pid === "number" &&
  typeof (value as HostHandshake).port === "number" &&
  typeof (value as HostHandshake).token === "string";

const describeCause = (cause: unknown): string => {
  if (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    typeof (cause as { message: unknown }).message === "string" &&
    (cause as { message: string }).message.length > 0
  ) {
    return (cause as { message: string }).message;
  }
  return String(cause);
};

const HANDSHAKE_TIMEOUT = "30 seconds";
const SESSION_READY_TIMEOUT = "15 seconds";

// The smoke test's protocol stack: WebSocket socket layer, JSON RPC
// serialization, and the socket protocol client over the real WsRpcGroup.
const firstServerConfigSnapshot = (
  socketUrl: string,
): Effect.Effect<EnvironmentSnapshot, ConnectFailure, Scope.Scope> => {
  const hooks = RpcClient.ConnectionHooks.of({
    onConnect: Effect.void,
    onDisconnect: Effect.void,
  });
  const socketLayer = Socket.layerWebSocket(socketUrl, {
    openTimeout: SESSION_READY_TIMEOUT,
  }).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal));
  const protocolLayer = Layer.effect(
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
  return RpcClient.make(WsRpcGroup).pipe(
    Effect.flatMap((client) =>
      client[WS_METHODS.subscribeServerConfig]({}).pipe(
        Stream.take(1),
        Stream.runHead,
        Effect.flatMap((head) =>
          Option.isNone(head)
            ? Effect.fail(
                new ConnectFailure({
                  stage: "rpc",
                  message: "subscribeServerConfig ended without a snapshot event",
                }),
              )
            : Effect.succeed(snapshotOf(head.value)),
        ),
      ),
    ),
    Effect.provide(protocolLayer),
    Effect.timeout(SESSION_READY_TIMEOUT),
    Effect.mapError((cause) => new ConnectFailure({ stage: "rpc", message: describeCause(cause) })),
  );
};

const snapshotOf = (event: unknown): EnvironmentSnapshot => {
  if (
    typeof event !== "object" ||
    event === null ||
    (event as { type?: unknown }).type !== "snapshot"
  ) {
    throw new Error(`expected a snapshot frame, got ${JSON.stringify(event)?.slice(0, 200)}`);
  }
  const config = (event as { config?: unknown }).config;
  if (typeof config !== "object" || config === null) {
    throw new Error("snapshot frame carried no config");
  }
  const environment = (config as { environment?: unknown }).environment;
  if (typeof environment !== "object" || environment === null) {
    throw new Error("snapshot config carried no environment");
  }
  const env = environment as {
    label?: unknown;
    serverVersion?: unknown;
    platform?: { os?: unknown; arch?: unknown } | null;
  };
  const platform = env.platform ?? {};
  const field = (value: unknown, name: string): string => {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`snapshot environment.${name} missing`);
    }
    return value;
  };
  return {
    label: field(env.label, "label"),
    os: field(platform.os, "platform.os"),
    arch: field(platform.arch, "platform.arch"),
    serverVersion: field(env.serverVersion, "serverVersion"),
    cwd: field((config as { cwd?: unknown }).cwd, "cwd"),
  };
};

const handshakeFromLines = (
  sidecar: RunningSidecar,
): Effect.Effect<HostHandshake, ConnectFailure> =>
  Effect.callback<HostHandshake, ConnectFailure>((resume) => {
    let settled = false;
    sidecar.onLine((line) => {
      if (settled) return;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isHandshake(parsed)) {
          settled = true;
          resume(Effect.succeed(parsed));
        }
      } catch {
        // Non-JSON stdout lines before the handshake are ignored, matching the
        // smoke test's parseJsonLine behavior.
      }
    });
    return Effect.sync(() => {
      settled = true;
    });
  }).pipe(
    Effect.timeout(HANDSHAKE_TIMEOUT),
    Effect.mapError(
      (cause) =>
        new ConnectFailure({
          stage: "handshake",
          message: `no {pid,port,token} handshake on sidecar stdout: ${describeCause(cause)}`,
        }),
    ),
  );

export type ConnectEvent =
  | { readonly tag: "stage"; readonly stage: ConnectStage }
  | { readonly tag: "sidecarSpawned"; readonly pid: number }
  | { readonly tag: "handshake"; readonly port: number }
  | { readonly tag: "bearerSession"; readonly expiresIn: number }
  | { readonly tag: "wsTicket" }
  | { readonly tag: "sidecarExit"; readonly code: number };

export interface ConnectPipelineInput {
  readonly nodeBin: string;
  readonly hostCjs: string;
  readonly onEvent: (event: ConnectEvent) => void;
}

export const runConnectionPipeline = (
  input: ConnectPipelineInput,
): Effect.Effect<EnvironmentSnapshot, ConnectFailure> =>
  Effect.gen(function* () {
    input.onEvent({ tag: "stage", stage: "spawn" });
    const sidecar = yield* Effect.tryPromise({
      try: () => spawnSidecar(input.nodeBin, input.hostCjs),
      catch: (cause) => new ConnectFailure({ stage: "spawn", message: describeCause(cause) }),
    });
    sidecar.onExit((info) => input.onEvent({ tag: "sidecarExit", code: info.code }));
    input.onEvent({ tag: "sidecarSpawned", pid: sidecar.info.pid });

    input.onEvent({ tag: "stage", stage: "handshake" });
    const handshake = yield* handshakeFromLines(sidecar);
    input.onEvent({ tag: "handshake", port: handshake.port });

    const httpBaseUrl = `http://127.0.0.1:${handshake.port}`;
    const wsBaseUrl = `ws://127.0.0.1:${handshake.port}`;

    input.onEvent({ tag: "stage", stage: "exchange" });
    const session = yield* bootstrapRemoteBearerSession({
      httpBaseUrl,
      credential: handshake.token,
      clientMetadata: { label: "T3 Code RN", deviceType: "desktop" },
    }).pipe(
      Effect.mapError(
        (cause) =>
          new ConnectFailure({
            stage: "exchange",
            message: `POST /oauth/token failed: ${describeCause(cause)}`,
          }),
      ),
    );
    input.onEvent({ tag: "bearerSession", expiresIn: session.expires_in });

    input.onEvent({ tag: "stage", stage: "ticket" });
    const wsUrl = yield* resolveRemoteWebSocketConnectionUrl({
      wsBaseUrl,
      httpBaseUrl,
      bearerToken: session.access_token,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new ConnectFailure({
            stage: "ticket",
            message: `POST /api/auth/websocket-ticket failed: ${describeCause(cause)}`,
          }),
      ),
    );
    input.onEvent({ tag: "wsTicket" });

    input.onEvent({ tag: "stage", stage: "ws" });
    input.onEvent({ tag: "stage", stage: "rpc" });
    return yield* Effect.scoped(firstServerConfigSnapshot(wsUrl));
  }).pipe(Effect.provide(remoteHttpClientLayer(globalThis.fetch)));
