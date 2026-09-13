// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics anyUnknownInErrorContext:off
// The rc RpcClient types leak `any` into the effect context; suppressing the
// heuristic here keeps the typecheck useful for the assertions that matter.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";
import * as NodeURL from "node:url";

import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Socket from "effect/unstable/socket/Socket";
import * as Stream from "effect/Stream";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import {
  bootstrapRemoteBearerSession,
  resolveRemoteWebSocketConnectionUrl,
} from "@t3tools/client-runtime/authorization";
import { WS_METHODS, WsRpcGroup } from "@t3tools/contracts";

const HOST_ENTRY = NodeURL.fileURLToPath(new URL("../dist/host.cjs", import.meta.url));
const HANDSHAKE_TIMEOUT = "150 seconds";
const SESSION_READY_TIMEOUT = "10 seconds";

class HostSmokeError extends Schema.TaggedError<HostSmokeError>()("HostSmokeError", {
  message: Schema.String,
}) {}

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

const decodeUnknownJson = Schema.decodeSync(Schema.fromJsonString(Schema.Unknown));

const parseJsonLine = (line: string): unknown => {
  try {
    return decodeUnknownJson(line);
  } catch {
    return null;
  }
};

// CI spawns the sidecar without a controlling terminal, so the login-shell
// PATH probe in the server's boot (fixPath -> `bash -ilc`) prints bash
// job-control noise on the inherited stderr before the handshake. These
// lines are benign; any other pre-handshake stderr still fails the smoke.
const BENIGN_STDERR_LINES: ReadonlyArray<RegExp> = [
  /^bash: cannot set terminal process group \(\d+\): Inappropriate ioctl for device$/,
  /^bash: no job control in this shell$/,
];

const nonBenignStderrLines = (stderr: string): ReadonlyArray<string> =>
  stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !BENIGN_STDERR_LINES.some((pattern) => pattern.test(line)));

interface SpawnSpec {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
}

const spawnHostProcess = (spec: SpawnSpec) =>
  Effect.gen(function* () {
    const baseDir = yield* Effect.sync(() =>
      NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-rn-host-smoke-")),
    );
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("T3CODE_")) continue;
      if (value !== undefined) env[key] = value;
    }
    env.T3CODE_HOME = baseDir;

    const child = yield* Effect.sync(() =>
      NodeChildProcess.spawn(spec.command, [...spec.args], {
        env,
        cwd: NodeOS.tmpdir(),
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );

    const handshake = Effect.callback<HostHandshake, HostSmokeError>((resume) => {
      let buffer = "";
      let stderrBuffer = "";
      const onData = (chunk: Buffer | string) => {
        buffer += chunk.toString("utf8");
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          const parsed = parseJsonLine(line);
          if (isHandshake(parsed)) {
            cleanup();
            resume(Effect.succeed(parsed));
            return;
          }
          newlineIndex = buffer.indexOf("\n");
        }
      };
      const onStderr = (chunk: Buffer | string) => {
        stderrBuffer += String(chunk);
        // Only judge complete lines so a benign line split across chunks
        // cannot masquerade as a real error.
        const lastNewline = stderrBuffer.lastIndexOf("\n");
        if (lastNewline === -1) return;
        const residue = nonBenignStderrLines(stderrBuffer.slice(0, lastNewline + 1));
        if (residue.length === 0) return;
        cleanup();
        resume(
          Effect.fail(
            new HostSmokeError({
              message: `t3-rn-host wrote to stderr before the handshake: ${residue.join("\n")}`,
            }),
          ),
        );
      };
      const onExit = (code: number | null, signal: string | null) => {
        cleanup();
        resume(
          Effect.fail(
            new HostSmokeError({
              message: `t3-rn-host exited before the handshake (code=${code} signal=${signal})`,
            }),
          ),
        );
      };
      const cleanup = () => {
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onStderr);
        child.off("exit", onExit);
      };
      child.stdout?.on("data", onData);
      child.stderr?.on("data", onStderr);
      child.on("exit", onExit);
      return Effect.sync(cleanup);
    }).pipe(Effect.timeout(HANDSHAKE_TIMEOUT));

    const exit = (signal: NodeJS.Signals) =>
      Effect.callback<{ code: number | null; signal: string | null }, HostSmokeError>((resume) => {
        child.once("exit", (code, exitSignal) =>
          resume(Effect.succeed({ code, signal: exitSignal })),
        );
        child.kill(signal);
        return Effect.sync(() => {
          child.off("exit", resume);
        });
      }).pipe(Effect.timeout("15 seconds"));

    return { child, handshake, exit };
  });

// The exact protocol stack client-runtime/src/rpc/session.ts builds: a
// WebSocket socket layer, JSON RPC serialization, and the socket protocol
// client over the real WsRpcGroup.
const subscribeServerConfigSnapshot = (socketUrl: string) => {
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
      client[WS_METHODS.subscribeServerConfig]({}).pipe(Stream.take(1), Stream.runHead),
    ),
    Effect.provide(protocolLayer),
    Effect.timeout(SESSION_READY_TIMEOUT),
  );
};

describe("t3-rn-host", () => {
  it.effect("serves 127.0.0.1, mints a bootstrap token, and completes a real WS RPC session", () =>
    Effect.gen(function* () {
      const host = yield* spawnHostProcess({
        command: process.execPath,
        args: [HOST_ENTRY],
      });

      const handshake = yield* host.handshake;
      assert.equal(
        handshake.pid,
        host.child.pid,
        `handshake pid must be the spawned process: ${NodeUtil.inspect(handshake)}`,
      );
      assert.match(
        handshake.token,
        /^[0-9a-f]{48}$/,
        `handshake token must be 24 bytes of hex: ${NodeUtil.inspect(handshake)}`,
      );
      yield* Effect.sync(() => {
        process.stdout.write(`\n[smoke] handshake line: ${NodeUtil.inspect(handshake)}\n`);
      });

      const httpBaseUrl = `http://127.0.0.1:${handshake.port}`;

      // The desktop's own local auth path: exchange the bootstrap credential
      // for a bearer session, then mint a WebSocket ticket.
      const session = yield* bootstrapRemoteBearerSession({
        httpBaseUrl,
        credential: handshake.token,
        clientMetadata: { label: "t3-rn-host smoke", deviceType: "desktop" },
      });
      assert.equal(
        session.token_type,
        "Bearer",
        `token exchange response: ${NodeUtil.inspect(session)}`,
      );
      assert.ok(
        typeof session.access_token === "string" && session.access_token.length > 0,
        `token exchange response: ${NodeUtil.inspect(session)}`,
      );
      assert.ok(
        typeof session.scope === "string" && session.scope.length > 0,
        `token exchange response: ${NodeUtil.inspect(session)}`,
      );
      assert.ok(session.expires_in > 0, `token exchange response: ${NodeUtil.inspect(session)}`);
      yield* Effect.sync(() => {
        process.stdout.write(
          `[smoke] POST /oauth/token: ${NodeUtil.inspect(
            { ...session, access_token: `<redacted:${session.access_token.length} chars>` },
            { depth: 3 },
          )}\n`,
        );
      });

      const wsUrl = yield* resolveRemoteWebSocketConnectionUrl({
        wsBaseUrl: `ws://127.0.0.1:${handshake.port}`,
        httpBaseUrl,
        bearerToken: session.access_token,
      });
      assert.ok(wsUrl.includes("/ws?wsTicket="), `resolved WS URL: ${wsUrl}`);

      // A bogus ticket must not open an authenticated session.
      const bogusRejected = yield* Effect.callback<boolean>((resume) => {
        const ws = new WebSocket(`ws://127.0.0.1:${handshake.port}/ws?wsTicket=bogus`);
        ws.addEventListener("open", () => {
          ws.close();
          resume(Effect.succeed(false));
        });
        ws.addEventListener("error", () => resume(Effect.succeed(true)));
        ws.addEventListener("close", () => resume(Effect.succeed(true)));
      }).pipe(Effect.timeout(SESSION_READY_TIMEOUT));
      assert.isTrue(bogusRejected, "the server must reject a /ws upgrade with an invalid wsTicket");

      // Real session handshake: subscribe to server config and expect the
      // snapshot event the client runtime treats as session-ready.
      const head = yield* subscribeServerConfigSnapshot(wsUrl);
      const firstEvent = Option.getOrThrowWith(
        head,
        () =>
          new HostSmokeError({
            message: "subscribeServerConfig ended without a snapshot event",
          }),
      );
      const frame = NodeUtil.inspect(firstEvent, { depth: 6 });
      yield* Effect.sync(() => {
        process.stdout.write(`[smoke] first server frame: ${frame}\n`);
      });
      assert.equal(firstEvent.version, 1, `first server frame: ${frame}`);
      if (firstEvent.type !== "snapshot") {
        return yield* new HostSmokeError({
          message: `expected a snapshot frame, got ${firstEvent.type}: ${frame}`,
        });
      }
      assert.ok(typeof firstEvent.config.cwd === "string", `first server frame: ${frame}`);
      assert.ok(
        typeof firstEvent.config.environment === "object" && firstEvent.config.environment !== null,
        `first server frame: ${frame}`,
      );

      // SIGTERM must end the sidecar.
      const exited = yield* host.exit("SIGTERM");
      assert.ok(
        exited.code === 0 || exited.signal === "SIGTERM",
        `exit after SIGTERM: ${NodeUtil.inspect(exited)}`,
      );
    }).pipe(Effect.provide(NodeHttpClient.layerUndici)),
  );

  it.effect("still fails on real pre-handshake stderr from a bogus sidecar", () =>
    Effect.gen(function* () {
      const host = yield* spawnHostProcess({
        command: process.execPath,
        args: [
          "-e",
          `process.stderr.write("boom: fake boot failure\\n"); setTimeout(() => {}, 60000);`,
        ],
      });
      const error = yield* Effect.flip(host.handshake);
      assert.equal(
        error._tag,
        "HostSmokeError",
        `expected HostSmokeError, got: ${NodeUtil.inspect(error)}`,
      );
      assert.match(error.message, /boom: fake boot failure/, `error message: ${error.message}`);
      yield* Effect.sync(() => {
        host.child.kill("SIGKILL");
      });
    }),
  );
});
