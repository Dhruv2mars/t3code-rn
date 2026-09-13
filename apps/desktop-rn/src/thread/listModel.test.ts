import { describe, expect, it } from "vite-plus/test";

import { buildStreamListItems, titleFromMessage } from "./listModel";

const thread = (messages: { id: string; text: string; streaming: boolean }[]) =>
  ({
    id: "thread-1",
    messages: messages.map((message, index) => ({
      id: message.id,
      role: index === 0 ? ("user" as const) : ("assistant" as const),
      text: message.text,
      streaming: message.streaming,
      turnId: null,
      createdAt: "2026-09-13T09:00:00.000Z",
      updatedAt: "2026-09-13T09:00:00.000Z",
    })),
  }) as never;

describe("buildStreamListItems", () => {
  it("keys rows by message id and marks streaming rows", () => {
    const items = buildStreamListItems(
      thread([
        { id: "m1", text: "hello", streaming: false },
        { id: "m2", text: "wor", streaming: true },
      ]),
      null,
    );
    expect(items).toEqual([
      { type: "message", key: "m1", role: "user", text: "hello", streaming: false },
      { type: "message", key: "m2", role: "assistant", text: "wor", streaming: true },
    ]);
  });

  it("drops empty settled messages but keeps a streaming one", () => {
    const items = buildStreamListItems(
      thread([
        { id: "m1", text: "", streaming: false },
        { id: "m2", text: "", streaming: true },
      ]),
      null,
    );
    expect(items.map((item) => item.key)).toEqual(["m2"]);
  });

  it("appends the notice after the messages", () => {
    const items = buildStreamListItems(thread([{ id: "m1", text: "hi", streaming: false }]), {
      text: "provider unavailable",
      tone: "error",
    });
    expect(items[1]).toEqual({ type: "notice", key: "notice:1", text: "provider unavailable" });
  });

  it("renders the notice alone when no thread is loaded", () => {
    const items = buildStreamListItems(null, { text: "dispatch rejected", tone: "error" });
    expect(items).toEqual([{ type: "notice", key: "notice:0", text: "dispatch rejected" }]);
  });
});

describe("titleFromMessage", () => {
  it("clips the first line to 60 characters", () => {
    expect(titleFromMessage("fix the bug\nsecond line")).toBe("fix the bug");
    expect(titleFromMessage("x".repeat(80)).length).toBe(60);
    expect(titleFromMessage("   ")).toBe("New thread");
  });
});
