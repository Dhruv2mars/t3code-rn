import type { ModelSelection, ProviderInteractionMode, RuntimeMode } from "@t3tools/contracts";

/** Display strings and option lists for the composer pickers. */

export interface ModelEntry {
  readonly instanceId: string;
  readonly model: string;
}

export const EFFORT_OPTIONS = ["medium", "high", "xhigh"] as const;
export type EffortOption = (typeof EFFORT_OPTIONS)[number];

export const RUNTIME_MODE_OPTIONS: ReadonlyArray<{
  readonly value: RuntimeMode;
  readonly label: string;
}> = [
  { value: "approval-required", label: "Approval required" },
  { value: "auto-accept-edits", label: "Auto-accept edits" },
  { value: "auto", label: "Auto" },
  { value: "full-access", label: "Full access" },
];

export const runtimeModeLabel = (mode: RuntimeMode): string =>
  RUNTIME_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;

export const interactionModeLabel = (mode: ProviderInteractionMode): string =>
  mode === "plan" ? "Plan" : "Build";

/** "xhigh" -> "Xhigh"; used for the reasoning-effort half of the effort chip. */
export const effortLabel = (effort: string): string =>
  effort.length === 0 ? effort : effort[0]!.toUpperCase() + effort.slice(1);

const capitalize = (segment: string): string =>
  segment.length === 0 ? segment : segment[0]!.toUpperCase() + segment.slice(1);

const prettifySlug = (slug: string): string =>
  slug
    .split(/[-_.]/)
    .map((segment) =>
      segment === "gpt" || segment === "ai" || segment === "llm"
        ? segment.toUpperCase()
        : /^\d/.test(segment)
          ? segment
          : capitalize(segment),
    )
    .join(" ");

/**
 * The server exposes instance and model slugs only (the provider catalog
 * itself is not part of the client-facing shell state), so the ChatGPT
 * instance renders as its product name and other slugs are prettified.
 */
export const modelDisplayName = (instanceId: string, model: string): string => {
  if (instanceId.toLowerCase().includes("chatgpt")) return "ChatGPT";
  return prettifySlug(model);
};

export const modelEntryLabel = (entry: ModelEntry): string =>
  `${modelDisplayName(entry.instanceId, entry.model)}`;

/** Reasoning effort carried on the thread's model selection, if any. */
export const effortOf = (selection: ModelSelection | null): string => {
  const options = selection?.options ?? [];
  for (const option of options) {
    if (option.id === "reasoningEffort" && typeof option.value === "string") return option.value;
  }
  return "xhigh";
};
