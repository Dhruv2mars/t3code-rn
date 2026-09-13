import type { OrchestrationProjectShell, OrchestrationThreadShell } from "@t3tools/contracts";

/** Threads of one project, most recently updated first. */
export interface ShellThreadGroup {
  readonly project: OrchestrationProjectShell;
  readonly threads: ReadonlyArray<OrchestrationThreadShell>;
}

/** Flat sidebar list items: one header per project followed by its threads. */
export type ShellListItem =
  | { readonly type: "header"; readonly key: string; readonly project: OrchestrationProjectShell }
  | { readonly type: "thread"; readonly key: string; readonly thread: OrchestrationThreadShell };

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
): ShellListItem[] {
  const needle = query.trim().toLowerCase();
  const items: ShellListItem[] = [];
  for (const group of groups) {
    const visible =
      needle.length === 0
        ? group.threads
        : group.threads.filter((thread) => thread.title.toLowerCase().includes(needle));
    if (visible.length === 0) continue;
    items.push({ type: "header", key: `header:${group.project.id}`, project: group.project });
    for (const thread of visible) {
      items.push({ type: "thread", key: `thread:${thread.id}`, thread });
    }
  }
  return items;
}

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
