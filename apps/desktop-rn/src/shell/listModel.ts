import type { OrchestrationProjectShell, OrchestrationThreadShell } from "@t3tools/contracts";

/** Threads of one project, most recently updated first. */
export interface ShellThreadGroup {
  readonly project: OrchestrationProjectShell;
  readonly threads: ReadonlyArray<OrchestrationThreadShell>;
}

/**
 * Flat sidebar list items. Every rendered row carries its project title for
 * the chip line; settled threads collapse behind one header item.
 */
export type ShellListItem =
  | {
      readonly type: "thread";
      readonly key: string;
      readonly projectTitle: string;
      readonly thread: OrchestrationThreadShell;
    }
  | { readonly type: "settled-header"; readonly key: "settled"; readonly count: number };

export function isThreadSettled(thread: OrchestrationThreadShell): boolean {
  return thread.settledAt !== null || thread.settledOverride === "settled";
}

export function groupThreadsByProject(
  projects: ReadonlyArray<OrchestrationProjectShell>,
  threads: ReadonlyArray<OrchestrationThreadShell>,
): ShellThreadGroup[] {
  const byProject = new Map<string, OrchestrationThreadShell[]>();
  for (const thread of threads) {
    const group = byProject.get(thread.projectId);
    if (group) {
      group.push(thread);
    } else {
      byProject.set(thread.projectId, [thread]);
    }
  }
  return [...projects]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((project) => ({
      project,
      threads: (byProject.get(project.id) ?? []).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    }));
}

export function buildShellListItems(
  groups: ReadonlyArray<ShellThreadGroup>,
  query: string,
  settledExpanded: boolean,
): ShellListItem[] {
  const needle = query.trim().toLowerCase();
  const matches = (thread: OrchestrationThreadShell): boolean =>
    needle.length === 0 || thread.title.toLowerCase().includes(needle);
  const items: ShellListItem[] = [];
  const settled: OrchestrationThreadShell[] = [];
  for (const group of groups) {
    for (const thread of group.threads) {
      if (!matches(thread)) continue;
      if (isThreadSettled(thread)) {
        settled.push(thread);
      } else {
        items.push({
          type: "thread",
          key: `thread:${thread.id}`,
          projectTitle: group.project.title,
          thread,
        });
      }
    }
  }
  if (settled.length > 0) {
    items.push({ type: "settled-header", key: "settled", count: settled.length });
    if (settledExpanded) {
      for (const thread of settled) {
        items.push({
          type: "thread",
          key: `thread:${thread.id}`,
          projectTitle: settledProjectTitle(groups, thread.projectId),
          thread,
        });
      }
    }
  }
  return items;
}

const settledProjectTitle = (groups: ReadonlyArray<ShellThreadGroup>, projectId: string): string =>
  groups.find((group) => group.project.id === projectId)?.project.title ?? projectId;

/** Thread ids in list order; the keyboard navigation track. */
export function listThreadIds(items: ReadonlyArray<ShellListItem>): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.type === "thread") {
      ids.push(item.thread.id);
    }
  }
  return ids;
}

export function stepThreadId(
  threadIds: ReadonlyArray<string>,
  currentId: string | null,
  delta: 1 | -1,
): string | null {
  if (threadIds.length === 0) return null;
  const index = currentId === null ? -1 : threadIds.indexOf(currentId);
  if (index === -1) return threadIds[0] ?? null;
  return threadIds[Math.min(threadIds.length - 1, Math.max(0, index + delta))] ?? null;
}

/** "9h" style relative label from the parity reference. */
export function formatRelativeTime(iso: string, nowIso: string): string {
  const seconds = Math.max(0, (Date.parse(nowIso) - Date.parse(iso)) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Ticking "21s" label of the working pill, compact like the reference. */
export function formatWorkingElapsed(startedAtIso: string, nowIso: string): string {
  const seconds = Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(startedAtIso)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
