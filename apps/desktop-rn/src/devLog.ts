// @effect-diagnostics globalConsole:off
// React-side diagnostic logging for the sidecar connection screen. Effect.log
// is not reachable from the plain callbacks React owns, and the stage lines
// must reach the process log for the U-007 verification evidence.
export const devLog = (line: string): void => {
  console.log(line);
};
