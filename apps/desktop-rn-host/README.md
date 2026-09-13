# @t3tools/desktop-rn-host

The T3 local environment server packaged as a standalone Node sidecar for the
React Native desktop app. `t3-rn-host` starts the server on 127.0.0.1, prints a
one-line JSON handshake (`{"pid":<pid>,"port":<port>,"token":"<hex>"}`) to
stdout once HTTP readiness is confirmed, and stays alive until SIGTERM/SIGINT.

## Layer composition

The sidecar wraps `apps/server` in-process; it does not rewrite or re-merge
server layers. Findings from reading the Electron host:

- The server child already runs the full `runServer` graph
  (`Layer.launch(makeServerLayer)` in `apps/server/src/server.ts`). Everything
  the desktop app merges beyond that (`DesktopServerExposure`,
  `DesktopLocalEnvironmentAuth`, window/IPC/WSL layers in
  `apps/desktop/src/main.ts`) lives in the desktop process, not in the server
  child. The sidecar needs none of them.
- The only server-side input the desktop contributes is `ServerConfig` with a
  minted `desktopBootstrapToken` (normally delivered via the fd3 bootstrap
  envelope; here injected into the resolved config). `PairingGrantStore`
  (`apps/server/src/auth/PairingGrantStore.ts`) seeds that token as a
  `desktop-bootstrap` grant with administrative scopes, a 24h TTL, and
  unbounded uses.
- The sidecar therefore calls `resolveServerConfig` (the same function the
  `t3 serve` CLI command uses) with loopback desktop flags, injects the token,
  and launches `runServer`.

## Auth boundary

Full Clerk-free local auth is reachable without touching `packages/*`. The
smoke test replays the desktop's own client path:

1. `POST /oauth/token` with the handshake token as a bootstrap credential
   (`bootstrapRemoteBearerSession` from `@t3tools/client-runtime/authorization`)
   returns a bearer access token.
2. `POST /api/auth/websocket-ticket` with that bearer returns a `wsTicket`
   (`resolveRemoteWebSocketConnectionUrl`).
3. The client connects to `ws://127.0.0.1:<port>/ws?wsTicket=<ticket>` and runs
   the real Effect RPC session protocol (`RpcClient.make(WsRpcGroup)` over
   `Socket.layerWebSocket` + `RpcSerialization.layerJson`). The first
   `subscribeServerConfig` event (`{version:1,type:"snapshot",config:{...}}`)
   is the session-ready frame client-runtime waits on.

A `/ws` upgrade with an invalid ticket must be rejected; the test asserts that
too.

## Build and test

```sh
pnpm --filter @t3tools/desktop-rn-host build   # esbuild -> dist/host.cjs (node 24, CJS)
pnpm --filter @t3tools/desktop-rn-host test    # spawns dist/host.cjs, full auth + WS session
```

The bundle keeps `@t3tools/*` workspace packages inline. Runtime externals
mirror `scripts/lib/cli-external-packages.ts` (node-pty, msgpackr-extract,
@ff-labs/fff-node, ...) and are declared as dependencies so Node resolves them
from this package's `node_modules`. Bun-only effect platform packages stay
external: the server only imports them behind `typeof Bun !== "undefined"`
guards that Node never takes.
