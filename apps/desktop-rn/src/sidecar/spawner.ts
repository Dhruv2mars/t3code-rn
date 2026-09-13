import { NativeEventEmitter, NativeModules } from "react-native";

export interface SidecarSpawnInfo {
  readonly pid: number;
  readonly t3Home: string;
}

export interface SidecarExitInfo {
  readonly code: number;
}

type SidecarEventMap = {
  sidecarStdout: [chunk: string];
  sidecarStderr: [chunk: string];
  sidecarExit: [info: SidecarExitInfo];
};

interface T3SidecarSpawnerNative {
  spawn(
    nodeBin: string,
    args: readonly string[],
    env: Record<string, string> | null,
  ): Promise<SidecarSpawnInfo>;
  terminate(): Promise<boolean>;
  launchEnvironment(): Promise<Record<string, string>>;
}

interface EmitterSubscriptionLike {
  remove(): void;
}

interface SidecarEmitterLike {
  addListener(
    eventName: keyof SidecarEventMap,
    listener: (value: never) => void,
  ): EmitterSubscriptionLike;
}

export const T3SidecarSpawner = NativeModules.T3SidecarSpawner as
  | T3SidecarSpawnerNative
  | undefined;

// Events stream through the legacy bridge, so a non-null emitter exists exactly
// when the native module linked.
export const sidecarEmitter: SidecarEmitterLike | null = T3SidecarSpawner
  ? (new NativeEventEmitter(T3SidecarSpawner as never) as unknown as SidecarEmitterLike)
  : null;

export interface RunningSidecar {
  readonly info: SidecarSpawnInfo;
  readonly onLine: (onLine: (line: string) => void) => void;
  readonly onExit: (onExit: (info: SidecarExitInfo) => void) => void;
  readonly terminate: () => Promise<boolean>;
}

// Listeners attach before spawn() is awaited, so bridge FIFO order guarantees
// no stdout line (the handshake) is emitted before its listener exists.
export async function spawnSidecar(
  nodeBin: string,
  hostCjs: string,
  env?: Record<string, string>,
): Promise<RunningSidecar> {
  if (T3SidecarSpawner === undefined || sidecarEmitter === null) {
    throw new Error("T3SidecarSpawner native module is unavailable");
  }
  const lineListeners = new Set<(line: string) => void>();
  const exitListeners = new Set<(info: SidecarExitInfo) => void>();
  const stdout = new LineSplitter((line) => {
    for (const listener of lineListeners) listener(line);
  });
  const stderr = new LineSplitter((line) => {
    for (const listener of lineListeners) listener(line);
  });
  const subscriptions = [
    sidecarEmitter.addListener("sidecarStdout", (chunk) => stdout.push(chunk)),
    sidecarEmitter.addListener("sidecarStderr", (chunk) => stderr.push(chunk)),
    sidecarEmitter.addListener("sidecarExit", (info) => {
      for (const listener of exitListeners) listener(info);
    }),
  ];
  const info = await T3SidecarSpawner.spawn(nodeBin, [hostCjs], env ?? null);
  return {
    info,
    onLine: (onLine) => {
      lineListeners.add(onLine);
    },
    onExit: (onExit) => {
      exitListeners.add(onExit);
    },
    terminate: () => T3SidecarSpawner!.terminate(),
  };
}

class LineSplitter {
  private buffer: string;
  private readonly onLine: (line: string) => void;

  constructor(onLine: (line: string) => void) {
    this.buffer = "";
    this.onLine = onLine;
  }

  push(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line.length > 0) this.onLine(line);
      newline = this.buffer.indexOf("\n");
    }
  }
}
