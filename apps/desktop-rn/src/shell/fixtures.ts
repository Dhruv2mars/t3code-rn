// @effect-diagnostics globalDate:off -- Fixture timestamps anchor to launch time so the relative labels and the working pill match the live sidebar.
import * as Schema from "effect/Schema";
import {
  type OrchestrationLatestTurn,
  type OrchestrationProjectShell,
  type OrchestrationThreadShell,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";

/**
 * Static shell fixtures shaped exactly like the wire contracts:
 * `OrchestrationProjectShell` + `OrchestrationThreadShell` from
 * @t3tools/contracts. Branded ids are produced through the real schema
 * decoders so the fixture data cannot drift from the contract shapes.
 * Timestamps are offsets from launch so the sidebar shows the reference
 * cadence: one working pill at 21s, a "1d" row, and a settled section.
 */

const projectId = Schema.decodeSync(ProjectId);
const threadId = Schema.decodeSync(ThreadId);
const turnId = Schema.decodeSync(TurnId);
const providerInstanceId = Schema.decodeSync(ProviderInstanceId);

const MODEL_SELECTION = {
  instanceId: providerInstanceId("local"),
  model: "Muse Spark 1.3 Contributor",
} as const;

const NOW_MS = Date.now();
const isoFromNow = (deltaSeconds: number): string =>
  new Date(NOW_MS + deltaSeconds * 1000).toISOString();

const HOUR = 3600;
const DAY = 24 * HOUR;

interface FixtureThreadInput {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  /** ISO timestamp; drives list ordering and the relative-time label. */
  readonly updatedAt: string;
  readonly turnState?: OrchestrationLatestTurn["state"];
  readonly settled?: boolean;
}

const fixtureThread = (input: FixtureThreadInput): OrchestrationThreadShell => ({
  id: threadId(input.id),
  projectId: projectId(input.projectId),
  title: input.title,
  modelSelection: MODEL_SELECTION,
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: "main",
  worktreePath: null,
  pullRequests: [],
  latestTurn: input.turnState
    ? {
        turnId: turnId(`turn-${input.id}`),
        state: input.turnState,
        requestedAt: input.updatedAt,
        startedAt: input.updatedAt,
        completedAt: input.turnState === "running" ? null : input.updatedAt,
        assistantMessageId: null,
      }
    : null,
  createdAt: input.updatedAt,
  updatedAt: input.updatedAt,
  archivedAt: null,
  settledOverride: input.settled === true ? "settled" : null,
  settledAt: null,
  latestUserMessageAt: input.updatedAt,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  hasActionableProposedPlan: false,
  session: null,
});

export const FIXTURE_PROJECTS: ReadonlyArray<OrchestrationProjectShell> = [
  {
    id: projectId("prj_github"),
    title: "github",
    workspaceRoot: "/Users/dhruv2mars/dev/github",
    defaultModelSelection: null,
    scripts: [],
    createdAt: isoFromNow(-30 * DAY),
    updatedAt: isoFromNow(-30 * DAY),
  },
  {
    id: projectId("prj_t3code"),
    title: "t3code",
    workspaceRoot: "/Users/dhruv2mars/dev/github/t3code-rn",
    defaultModelSelection: null,
    scripts: [],
    createdAt: isoFromNow(-30 * DAY),
    updatedAt: isoFromNow(-30 * DAY),
  },
];

export const FIXTURE_THREADS: ReadonlyArray<OrchestrationThreadShell> = [
  fixtureThread({
    id: "thr_github-effect-ts-cli",
    projectId: "prj_github",
    title: "Build an Effect-TS CLI",
    updatedAt: isoFromNow(-21),
    turnState: "running",
  }),
  fixtureThread({
    id: "thr_github-openai-symphony",
    projectId: "prj_github",
    title: "OpenAI Symphony Explained",
    updatedAt: isoFromNow(-26 * HOUR),
  }),
  fixtureThread({
    id: "thr_react-native-desktop-shell",
    projectId: "prj_t3code",
    title: "Port the desktop shell to React Native: sidebar, content pane, and keyboard navigation",
    updatedAt: isoFromNow(-3 * HOUR),
    turnState: "completed",
  }),
  fixtureThread({
    id: "thr_sidecar-connection",
    projectId: "prj_t3code",
    title: "Wire the macOS sidecar spawner and WebSocket connection pipeline",
    updatedAt: isoFromNow(-30 * HOUR),
    turnState: "completed",
  }),
  fixtureThread({
    id: "thr_github-pan-resizer",
    projectId: "prj_github",
    title: "PanResponder drag deltas jitter on 120Hz trackpads",
    updatedAt: isoFromNow(-2 * DAY),
  }),
  fixtureThread({
    id: "thr_github-rn-macos-keyboard",
    projectId: "prj_github",
    title:
      "react-native-macos: keyDownEvents on a focusable View swallow Tab presses when a TextInput sibling holds first responder",
    updatedAt: isoFromNow(-3 * DAY),
    turnState: "interrupted",
  }),
  fixtureThread({
    id: "thr_uniwind-tokens",
    projectId: "prj_t3code",
    title: "Decide the styling pipeline for desktop-rn",
    updatedAt: isoFromNow(-3 * DAY),
    settled: true,
  }),
  fixtureThread({
    id: "thr_github-effect-schema-brands",
    projectId: "prj_github",
    title:
      "effect/Schema: branded entity ids round-trip through Struct keys without losing their brand",
    updatedAt: isoFromNow(-4 * DAY),
    turnState: "error",
    settled: true,
  }),
  fixtureThread({
    id: "thr_github-legend-list",
    projectId: "prj_github",
    title:
      "legend-apps/list: recycling rows lose hover state when the mouse never leaves the viewport during fast scrolls",
    updatedAt: isoFromNow(-5 * DAY),
    turnState: "completed",
    settled: true,
  }),
  fixtureThread({
    id: "thr_github-metro-pnpm-store",
    projectId: "prj_github",
    title:
      "Metro watchFolders must include the pnpm content-addressed store at the workspace root or out-of-tree forks fail to resolve",
    updatedAt: isoFromNow(-6 * DAY),
    settled: true,
  }),
];
