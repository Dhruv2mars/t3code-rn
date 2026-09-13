// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics globalTimers:off
// The SIGTERM hard-exit guard is deliberate Node-level glue outside Effect.
import * as NodeCrypto from "node:crypto";
import * as NodeTimers from "node:timers";

import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { waitForHttpReady } from "@t3tools/shared/httpReadiness";
import * as NetService from "@t3tools/shared/Net";

import { resolveServerConfig } from "t3/src/cli/config.ts";
import * as ServerConfig from "t3/src/config.ts";
import { runServer } from "t3/src/server.ts";

const SERVER_READY_TIMEOUT_MS = 60_000;
const SHUTDOWN_GRACE_MS = 3_000;

export interface HostHandshake {
  readonly pid: number;
  readonly port: number;
  readonly token: string;
}

export const HostHandshakeSchema = Schema.Struct({
  pid: Schema.Finite,
  port: Schema.Finite,
  token: Schema.String,
});

const encodeHostHandshake = Schema.encodeEffect(Schema.fromJsonString(HostHandshakeSchema));

class HostReadinessError extends Schema.TaggedError<HostReadinessError>()("HostReadinessError", {
  detail: Schema.String,
}) {
  override get message(): string {
    return `t3-rn-host server did not become ready: ${this.detail}`;
  }
}

// t3-rn-host: the local environment server as a standalone Node sidecar.
//
// Composition finding (see README): the Electron app's extra layers
// (DesktopServerExposure, DesktopLocalEnvironmentAuth, ...) all live in the
// desktop process, not in the server child. The server child runs
// `runServer` from apps/server with a ServerConfig whose
// `desktopBootstrapToken` is a random credential the desktop minted.
// PairingGrantStore seeds that token as a "desktop-bootstrap" grant with
// administrative scopes, and clients exchange it at POST /oauth/token.
// This sidecar replicates exactly that: resolveServerConfig (the same
// function the `t3 serve` CLI uses) plus the injected token, then
// Layer.launch(makeServerLayer) via runServer.
const program = Effect.gen(function* () {
  const net = yield* NetService.NetService;
  const port = yield* net.findAvailablePort(ServerConfig.DEFAULT_PORT);
  // Same credential shape the Electron desktop mints for its local backend:
  // 24 random bytes, hex encoded, delivered to the server as the
  // desktopBootstrapToken instead of via the fd3 bootstrap envelope.
  const token = NodeCrypto.randomBytes(24).toString("hex");

  const resolved = yield* resolveServerConfig(
    {
      mode: Option.some("desktop" as const),
      port: Option.some(port),
      host: Option.some("127.0.0.1"),
      baseDir: Option.none(),
      cwd: Option.none(),
      devUrl: Option.none(),
      noBrowser: Option.some(true),
      bootstrapFd: Option.none(),
      autoBootstrapProjectFromCwd: Option.some(false),
      logWebSocketEvents: Option.none(),
      tailscaleServeEnabled: Option.some(false),
      tailscaleServePort: Option.none(),
    },
    // Effect v4 log levels are a string union; the server default is "Info".
    Option.some("Info" as const),
  );
  const serverConfig: ServerConfig.ServerConfig["Service"] = {
    ...resolved,
    desktopBootstrapToken: token,
  };

  const serverFiber = yield* Effect.forkScoped(
    runServer.pipe(Effect.provideService(ServerConfig.ServerConfig, serverConfig)),
  );

  // Same readiness probe the desktop backend manager uses against its child.
  yield* waitForHttpReady({
    baseUrl: `http://127.0.0.1:${port}`,
    path: "/.well-known/t3/environment",
    timeoutMs: SERVER_READY_TIMEOUT_MS,
    makeError: ({ cause }) => new HostReadinessError({ detail: String(cause) }),
  });

  const handshake: HostHandshake = { pid: process.pid, port, token };
  const handshakeLine = yield* encodeHostHandshake(handshake);
  yield* Effect.sync(() => {
    process.stdout.write(`${handshakeLine}\n`);
  });

  // Stay alive until the server fiber is interrupted (SIGTERM/SIGINT below).
  yield* Fiber.await(serverFiber);
}).pipe(
  Effect.scoped,
  Effect.provide(Layer.mergeAll(NodeServices.layer, NetService.layer, NodeHttpClient.layerUndici)),
);

const mainFiber = Effect.runFork(program);

let shutdownRequested = false;
const shutdown = () => {
  if (shutdownRequested) return;
  shutdownRequested = true;
  const hardExit = NodeTimers.setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS);
  hardExit.unref();
  void Effect.runPromise(Fiber.interrupt(mainFiber)).then(
    () => process.exit(0),
    () => process.exit(0),
  );
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
