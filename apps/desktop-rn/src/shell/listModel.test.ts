import { describe, expect, it } from "vite-plus/test";

import {
  buildShellListItems,
  formatRelativeTime,
  formatWorkingElapsed,
  groupThreadsByProject,
  isThreadSettled,
  listThreadIds,
  stepThreadId,
} from "./listModel";
import { FIXTURE_PROJECTS, FIXTURE_THREADS } from "./fixtures";

describe("groupThreadsByProject", () => {
  it("sorts projects by title and threads by recency", () => {
    const groups = groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS);
    expect(groups.map((group) => group.project.title)).toEqual(["github", "t3code"]);
    const githubGroup = groups.find((group) => group.project.title === "github");
    if (!githubGroup) throw new Error("missing github group");
    const recency = githubGroup.threads.map((thread) => thread.updatedAt);
    expect([...recency].sort().reverse()).toEqual(recency);
  });

  it("places threads under their own project only", () => {
    const groups = groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS);
    expect(groups.flatMap((group) => group.threads)).toHaveLength(FIXTURE_THREADS.length);
  });
});

describe("buildShellListItems", () => {
  const groups = groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS);
  const settledFixtures = FIXTURE_THREADS.filter(isThreadSettled);
  const activeFixtures = FIXTURE_THREADS.filter((thread) => !isThreadSettled(thread));
  expect(settledFixtures.length).toBeGreaterThan(0);

  it("emits active rows plus one settled header, with stable keys", () => {
    const items = buildShellListItems(groups, "", false);
    const header = items.find((item) => item.type === "settled-header");
    if (!header || header.type !== "settled-header") throw new Error("expected settled header");
    expect(header.count).toBe(settledFixtures.length);
    const rows = items.filter((item) => item.type === "thread");
    expect(rows).toHaveLength(activeFixtures.length);
    for (const item of items) {
      expect(item.key.length).toBeGreaterThan(0);
    }
    const last = items[items.length - 1];
    if (!last) throw new Error("expected a trailing item");
    expect(last.type).toBe("settled-header");
  });

  it("keeps every rendered row connected to its project title", () => {
    const items = buildShellListItems(groups, "", false);
    for (const item of items) {
      if (item.type !== "thread") continue;
      const project = FIXTURE_PROJECTS.find((entry) => entry.id === item.thread.projectId);
      expect(item.projectTitle).toBe(project?.title);
    }
  });

  it("appends settled rows in list order when expanded", () => {
    const collapsed = buildShellListItems(groups, "", false);
    const expanded = buildShellListItems(groups, "", true);
    expect(expanded).toHaveLength(collapsed.length + settledFixtures.length);
    const expandedIds = expanded
      .filter((item) => item.type === "thread")
      .map((item) => (item.type === "thread" ? item.thread.id : ""));
    expect(expandedIds).toHaveLength(FIXTURE_THREADS.length);
    for (const settled of settledFixtures) {
      expect(expandedIds).toContain(settled.id);
    }
  });

  it("keeps only matching threads when searching, including settled matches", () => {
    const active = buildShellListItems(groups, "OpenAI", false);
    expect(active.map((item) => item.type)).toEqual(["thread"]);

    const settledOnly = buildShellListItems(groups, "metro watch", false);
    expect(settledOnly.map((item) => item.type)).toEqual(["settled-header"]);
    const header = settledOnly[0];
    if (!header || header.type !== "settled-header") throw new Error("expected settled header");
    expect(header.count).toBe(1);

    const expandedMatch = buildShellListItems(groups, "metro watch", true);
    expect(expandedMatch.map((item) => item.type)).toEqual(["settled-header", "thread"]);
  });
});

describe("listThreadIds + stepThreadId", () => {
  const groups = groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS);
  const settledFixtures = FIXTURE_THREADS.filter(isThreadSettled);

  it("steps through active thread ids in list order while settled is collapsed", () => {
    const ids = listThreadIds(buildShellListItems(groups, "", false));
    expect(ids).toHaveLength(FIXTURE_THREADS.length - settledFixtures.length);
    const [first, second] = ids;
    const last = ids[ids.length - 1];
    if (!first || !second || !last) throw new Error("expected at least two thread ids");
    expect(stepThreadId(ids, null, 1)).toBe(first);
    expect(stepThreadId(ids, first, 1)).toBe(second);
    expect(stepThreadId(ids, first, -1)).toBe(first);
    expect(stepThreadId(ids, last, 1)).toBe(last);
  });

  it("adds settled threads to the keyboard track when expanded", () => {
    const expanded = listThreadIds(buildShellListItems(groups, "", true));
    expect(expanded).toHaveLength(FIXTURE_THREADS.length);
    for (const settled of settledFixtures) {
      expect(expanded).toContain(settled.id);
    }
  });
});

describe("formatRelativeTime", () => {
  const now = "2026-09-13T09:00:00.000Z";

  it("renders the parity-reference style labels", () => {
    expect(formatRelativeTime("2026-09-13T09:00:30.000Z", now)).toBe("now");
    expect(formatRelativeTime("2026-09-13T08:30:00.000Z", now)).toBe("30m");
    expect(formatRelativeTime("2026-09-13T00:00:00.000Z", now)).toBe("9h");
    expect(formatRelativeTime("2026-09-11T09:00:00.000Z", now)).toBe("2d");
  });
});

describe("formatWorkingElapsed", () => {
  const now = "2026-09-13T09:00:00.000Z";

  it("ticks the working pill label", () => {
    expect(formatWorkingElapsed("2026-09-13T08:59:39.000Z", now)).toBe("21s");
    expect(formatWorkingElapsed("2026-09-13T08:58:30.000Z", now)).toBe("1m");
    expect(formatWorkingElapsed("2026-09-13T07:58:30.000Z", now)).toBe("1h 1m");
  });
});
