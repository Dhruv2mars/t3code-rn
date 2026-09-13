// @effect-diagnostics globalTimers:off
// Temporary U-007 diagnostic: opens the exact URL effect's socket layer uses
// through a raw WebSocket so a split verdict localizes the open failure.
export const rawWebSocketProbe = (socketUrl: string): Promise<string> =>
  new Promise<string>((resolve) => {
    try {
      const ws = new globalThis.WebSocket(socketUrl);
      ws.onopen = () => {
        resolve("raw-open");
        ws.close();
      };
      ws.onerror = () => resolve("raw-error");
      ws.onclose = (e) => resolve(`raw-close code=${e.code}`);
      setTimeout(() => resolve("raw-timeout"), 8000);
    } catch (e) {
      resolve(`raw-throw ${String(e)}`);
    }
  });
