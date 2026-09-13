import { useSyncExternalStore } from "react";
import type {
  OrchestrationEvent,
  OrchestrationProjectShell,
  OrchestrationShellStreamItem,
  OrchestrationThread,
  OrchestrationThreadShell,
  OrchestrationThreadStreamItem,
} from "@t3tools/contracts";

/**
 * Observable stores fed exclusively by the live session's stream fibers.
 * Components read through useSyncExternalStore; the snapshot identity only
 * changes when the fold produces a real update, so unchanged subtrees keep
 * their references.
 */

export interface ShellState {
  readonly projects: ReadonlyArray<OrchestrationProjectShell>;
  readonly threads: ReadonlyArray<OrchestrationThreadShell>;
  readonly synchronized: boolean;
}

const EMPTY_SHELL: ShellState = { projects: [], threads: [], synchronized: false };

export function foldShellItem(state: ShellState, item: OrchestrationShellStreamItem): ShellState {
  switch (item.kind) {
    case "synchronized":
      return state.synchronized ? state : { ...state, synchronized: true };
    case "snapshot":
      return {
        projects: item.snapshot.projects,
        threads: item.snapshot.threads,
        synchronized: true,
      };
    case "project-upserted": {
      const projects = new Map(state.projects.map((project) => [project.id, project]));
      projects.set(item.project.id, item.project);
      return { ...state, projects: [...projects.values()] };
    }
    case "project-removed": {
      const projects = state.projects.filter((project) => project.id !== item.projectId);
      return projects.length === state.projects.length ? state : { ...state, projects };
    }
    case "thread-upserted": {
      const threads = new Map(state.threads.map((thread) => [thread.id, thread]));
      threads.set(item.thread.id, item.thread);
      return { ...state, threads: [...threads.values()] };
    }
    case "thread-removed": {
      const threads = state.threads.filter((thread) => thread.id !== item.threadId);
      return threads.length === state.threads.length ? state : { ...state, threads };
    }
  }
}

export class ShellStore {
  private state: ShellState = EMPTY_SHELL;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ShellState => this.state;

  apply = (item: OrchestrationShellStreamItem): void => {
    const next = foldShellItem(this.state, item);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  };
}

export interface ThreadNotice {
  readonly text: string;
  readonly tone: "error" | "info";
}

export interface ThreadStreamState {
  readonly status: "idle" | "syncing" | "live" | "error";
  readonly thread: OrchestrationThread | null;
  readonly notice: ThreadNotice | null;
}

const IDLE_STREAM: ThreadStreamState = { status: "idle", thread: null, notice: null };

/**
 * Mirror of the server-side message semantics in client-runtime's
 * threadReducer: a streaming message-sent concatenates onto the stored
 * message, a completed one replaces the text.
 */
const mergeMessage = (
  thread: OrchestrationThread,
  incoming: OrchestrationThread["messages"][number],
): OrchestrationThread => {
  let found = false;
  const messages = thread.messages.map((entry) => {
    if (entry.id !== incoming.id) return entry;
    found = true;
    return {
      ...entry,
      text: incoming.streaming
        ? `${entry.text}${incoming.text}`
        : incoming.text.length > 0
          ? incoming.text
          : entry.text,
      streaming: incoming.streaming,
      updatedAt: incoming.updatedAt,
    };
  });
  if (!found) messages.push(incoming);
  return { ...thread, messages };
};

export function foldThreadEvent(
  state: ThreadStreamState,
  event: OrchestrationEvent,
): ThreadStreamState {
  if (state.thread === null) return state;
  switch (event.type) {
    case "thread.message-sent": {
      if (event.payload.threadId !== state.thread.id) return state;
      return {
        ...state,
        thread: mergeMessage(state.thread, {
          id: event.payload.messageId,
          role: event.payload.role,
          text: event.payload.text,
          turnId: event.payload.turnId,
          streaming: event.payload.streaming,
          createdAt: event.payload.createdAt,
          updatedAt: event.payload.updatedAt,
        }),
      };
    }
    case "thread.activity-appended": {
      if (event.payload.threadId !== state.thread.id) return state;
      const { activity } = event.payload;
      if (activity.tone !== "error") return state;
      return { ...state, notice: { text: activity.summary, tone: "error" } };
    }
    default:
      return state;
  }
}

export function foldThreadItem(
  state: ThreadStreamState,
  item: OrchestrationThreadStreamItem,
): ThreadStreamState {
  switch (item.kind) {
    case "synchronized":
      return state.status === "live" ? state : { ...state, status: "live" };
    case "snapshot":
      return { status: "live", thread: item.snapshot.thread, notice: null };
    case "event":
      return foldThreadEvent(state, item.event);
  }
}

export class ThreadStreamStore {
  private state: ThreadStreamState = IDLE_STREAM;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ThreadStreamState => this.state;

  apply = (item: OrchestrationThreadStreamItem): void => {
    const next = foldThreadItem(this.state, item);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  };

  setSyncing = (): void => {
    this.state = { status: "syncing", thread: null, notice: null };
    for (const listener of this.listeners) listener();
  };

  resetToIdle = (): void => {
    this.state = IDLE_STREAM;
    for (const listener of this.listeners) listener();
  };

  setNotice = (notice: ThreadNotice | null): void => {
    this.state = { ...this.state, notice };
    for (const listener of this.listeners) listener();
  };
}

export const useShellState = (store: ShellStore): ShellState =>
  useSyncExternalStore(store.subscribe, store.getSnapshot);

export const useThreadStreamState = (store: ThreadStreamStore): ThreadStreamState =>
  useSyncExternalStore(store.subscribe, store.getSnapshot);
