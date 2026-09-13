import { describe, expect, it } from "vite-plus/test";

import {
  buildShellListItems,
  formatRelativeTime,
  groupThreadsByProject,
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

  it("emits a header before each project's threads with stable keys", () => {
    const items = buildShellListItems(groups, "");
    const first = items[0];
    if (!first) throw new Error("expected at least one item");
    expect(first.type).toBe("header");
    expect(first.key).toBe("header:prj_github");
    expect(items.filter((item) => item.type === "thread")).toHaveLength(FIXTURE_THREADS.length);
    for (const item of items) {
      expect(item.key.length).toBeGreaterThan(0);
    }
  });

  it("keeps only matching threads when searching and drops empty groups", () => {
    const items = buildShellListItems(groups, "metro watch");
    expect(items.map((item) => item.type)).toEqual(["header", "thread"]);
    const threadItem = items[1];
    if (!threadItem) throw new Error("expected a matching thread item");
    if (threadItem.type !== "thread") throw new Error("expected a thread item");
    expect(threadItem.thread.title).toContain("Metro watchFolders");
  });
});

describe("listThreadIds + stepThreadId", () => {
  it("steps through thread ids in list order, skipping headers, clamped at the ends", () => {
    const ids = listThreadIds(
      buildShellListItems(groupThreadsByProject(FIXTURE_PROJECTS, FIXTURE_THREADS), ""),
    );
    expect(ids).toHaveLength(FIXTURE_THREADS.length);
    const [first, second] = ids;
    const last = ids[ids.length - 1];
    if (!first || !second || !last) throw new Error("expected at least two thread ids");
    expect(stepThreadId(ids, null, 1)).toBe(first);
    expect(stepThreadId(ids, first, 1)).toBe(second);
    expect(stepThreadId(ids, first, -1)).toBe(first);
    expect(stepThreadId(ids, last, 1)).toBe(last);
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
