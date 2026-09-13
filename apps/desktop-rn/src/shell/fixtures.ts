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
 */

const projectId = Schema.decodeSync(ProjectId);
const threadId = Schema.decodeSync(ThreadId);
const turnId = Schema.decodeSync(TurnId);
const providerInstanceId = Schema.decodeSync(ProviderInstanceId);

const MODEL_SELECTION = {
  instanceId: providerInstanceId("local"),
  model: "Muse Spark 1.3 Contributor",
} as const;

const BASE_TIME = "2026-09-13T09:00:00.000Z";

interface FixtureThreadInput {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  /** ISO timestamp; drives list ordering and the relative-time label. */
  readonly updatedAt: string;
  readonly turnState?: OrchestrationLatestTurn["state"];
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
  settledOverride: null,
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
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  },
  {
    id: projectId("prj_t3code"),
    title: "t3code",
    workspaceRoot: "/Users/dhruv2mars/dev/github/t3code-rn",
    defaultModelSelection: null,
    scripts: [],
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  },
];

export const FIXTURE_THREADS: ReadonlyArray<OrchestrationThreadShell> = [
  fixtureThread({
    id: "thr_react-native-desktop-shell",
    projectId: "prj_t3code",
    title: "Port the desktop shell to React Native: sidebar, content pane, and keyboard navigation",
    updatedAt: "2026-09-13T08:24:00.000Z",
    turnState: "running",
  }),
  fixtureThread({
    id: "thr_sidecar-connection",
    projectId: "prj_t3code",
    title: "Wire the macOS sidecar spawner and WebSocket connection pipeline",
    updatedAt: "2026-09-13T06:02:00.000Z",
    turnState: "completed",
  }),
  fixtureThread({
    id: "thr_uniwind-tokens",
    projectId: "prj_t3code",
    title: "Decide the styling pipeline for desktop-rn",
    updatedAt: "2026-09-12T21:40:00.000Z",
  }),
  fixtureThread({
    id: "thr_github-legend-list",
    projectId: "prj_github",
    title:
      "legend-apps/list: recycling rows lose hover state when the mouse never leaves the viewport during fast scrolls",
    updatedAt: "2026-09-13T07:11:00.000Z",
    turnState: "completed",
  }),
  fixtureThread({
    id: "thr_github-rn-macos-keyboard",
    projectId: "prj_github",
    title:
      "react-native-macos: keyDownEvents on a focusable View swallow Tab presses when a TextInput sibling holds first responder",
    updatedAt: "2026-09-13T00:45:00.000Z",
    turnState: "interrupted",
  }),
  fixtureThread({
    id: "thr_github-pan-resizer",
    projectId: "prj_github",
    title: "PanResponder drag deltas jitter on 120Hz trackpads",
    updatedAt: "2026-09-12T18:30:00.000Z",
  }),
  fixtureThread({
    id: "thr_github-effect-schema-brands",
    projectId: "prj_github",
    title:
      "effect/Schema: branded entity ids round-trip through Struct keys without losing their brand",
    updatedAt: "2026-09-11T14:05:00.000Z",
    turnState: "error",
  }),
  fixtureThread({
    id: "thr_github-metro-pnpm-store",
    projectId: "prj_github",
    title:
      "Metro watchFolders must include the pnpm content-addressed store at the workspace root or out-of-tree forks fail to resolve",
    updatedAt: "2026-09-10T10:20:00.000Z",
  }),
];
