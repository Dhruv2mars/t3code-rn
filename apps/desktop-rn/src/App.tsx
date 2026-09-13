import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { devLog } from "./devLog";

import {
  type ConnectEvent,
  type ConnectStage,
  type EnvironmentSnapshot,
} from "./connection/connect";
import { T3SidecarSpawner } from "./sidecar/spawner";
import { openThreadSession, type ThreadSession } from "./thread/session";
import { DesktopShell } from "./shell/DesktopShell";

type Phase =
  | { readonly tag: "connecting"; readonly stage: ConnectStage }
  | {
      readonly tag: "connected";
      readonly snapshot: EnvironmentSnapshot;
      readonly session: ThreadSession;
    }
  | { readonly tag: "failed"; readonly stage: ConnectStage; readonly message: string };

const stageHeading = (stage: ConnectStage): string => {
  switch (stage) {
    case "spawn":
      return "Spawning sidecar";
    case "handshake":
      return "Reading handshake";
    case "exchange":
      return "Exchanging bootstrap token";
    case "ticket":
      return "Minting WebSocket ticket";
    case "ws":
      return "Opening WebSocket";
    case "rpc":
      return "Waiting for first snapshot";
  }
};

function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ tag: "connecting", stage: "spawn" });
  const [log, setLog] = useState<readonly string[]>([]);
  const logRef = useRef<readonly string[]>([]);
  const appendLog = (line: string): void => {
    logRef.current = [...logRef.current, line].slice(-12);
    setLog(logRef.current);
  };

  useEffect(() => {
    if (T3SidecarSpawner === undefined) {
      setPhase({
        tag: "failed",
        stage: "spawn",
        message: "T3SidecarSpawner native module is not linked into the app",
      });
      return;
    }
    let cancelled = false;
    let lastStage: ConnectStage = "spawn";
    T3SidecarSpawner.launchEnvironment()
      .then((env) => {
        const nodeBin = env.T3CODE_RN_NODE_BIN ?? "";
        const hostCjs = env.T3CODE_RN_HOST_CJS ?? "";
        if (nodeBin.length === 0 || hostCjs.length === 0) {
          devLog("[u007] missing launch env: set T3CODE_RN_NODE_BIN and T3CODE_RN_HOST_CJS");
          setPhase({
            tag: "failed",
            stage: "spawn",
            message:
              "missing T3CODE_RN_NODE_BIN / T3CODE_RN_HOST_CJS in the app environment (dev launch)",
          });
          return;
        }
        openThreadSession({
          nodeBin,
          hostCjs,
          onEvent: (event: ConnectEvent) => {
            if (cancelled) return;
            switch (event.tag) {
              case "stage":
                lastStage = event.stage;
                setPhase({ tag: "connecting", stage: event.stage });
                break;
              case "sidecarSpawned":
                appendLog(`sidecar spawned (pid ${event.pid})`);
                break;
              case "handshake":
                appendLog(`handshake ok (port ${event.port})`);
                break;
              case "bearerSession":
                appendLog("bootstrap token exchanged for bearer session");
                break;
              case "wsTicket":
                appendLog("WebSocket ticket issued");
                break;
              case "debug":
                appendLog(event.detail);
                break;
              case "sidecarExit":
                appendLog(`sidecar exited (code ${event.code})`);
                setPhase((current) =>
                  current.tag === "connecting"
                    ? {
                        tag: "failed",
                        stage: lastStage,
                        message: `sidecar exited (code ${event.code})`,
                      }
                    : current,
                );
                break;
            }
          },
          onReady: (session, snapshot) => {
            if (cancelled) return;
            devLog(
              `[u011] live session ready: ${snapshot.label} · ${snapshot.os}/${snapshot.arch} · server ${snapshot.serverVersion} · cwd ${snapshot.cwd}`,
            );
            setPhase({ tag: "connected", snapshot, session });
          },
          onFatal: (stage, message) => {
            if (cancelled) return;
            devLog(`[u011] session failed at ${stage}: ${message}`);
            setPhase({ tag: "failed", stage, message });
          },
        });
      })
      .catch((cause: unknown) => {
        setPhase({ tag: "failed", stage: "spawn", message: String(cause) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The desktop shell owns the whole window once connected; the diagnostic
  // view below stays as the fallback for connecting/failed states.
  if (phase.tag === "connected") {
    return <DesktopShell session={phase.session} snapshot={phase.snapshot} />;
  }

  return (
    <View style={styles.container}>
      {phase.tag === "connecting" ? (
        <Text style={styles.title}>{`Connecting — ${stageHeading(phase.stage)}…`}</Text>
      ) : null}
      {phase.tag === "failed" ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>{`Failed at stage: ${phase.stage}`}</Text>
          <Text style={styles.bannerMessage}>{phase.message}</Text>
        </View>
      ) : null}
      <ScrollView style={styles.log}>
        {log.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#101014",
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  connected: {
    color: "#4ade80",
  },
  banner: {
    backgroundColor: "#7f1d1d",
    borderColor: "#ef4444",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
  },
  bannerTitle: {
    color: "#fecaca",
    fontSize: 16,
    fontWeight: "700",
  },
  bannerMessage: {
    color: "#fecaca",
    fontSize: 13,
    marginTop: 6,
  },
  log: {
    marginTop: 24,
    maxHeight: 220,
    width: "100%",
  },
  logLine: {
    color: "#8a8a93",
    fontFamily: "Menlo",
    fontSize: 12,
    paddingVertical: 2,
  },
});

export default App;
