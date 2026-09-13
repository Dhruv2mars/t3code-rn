import { describe, expect, it } from "vite-plus/test";

import { tokenize } from "./tokenize";

describe("tokenize blocks", () => {
  it("parses paragraphs separated by blank lines", () => {
    expect(tokenize("first\n\nsecond")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "first" }] },
      { type: "paragraph", inlines: [{ type: "text", text: "second" }] },
    ]);
  });

  it("parses heading levels and inline runs", () => {
    expect(tokenize("## Ship **fast**")).toEqual([
      {
        type: "heading",
        level: 2,
        inlines: [
          { type: "text", text: "Ship " },
          { type: "bold", children: [{ type: "text", text: "fast" }] },
        ],
      },
    ]);
  });

  it("keeps fenced code verbatim with its language label", () => {
    expect(tokenize("before\n\n```ts\nconst a = 1;\n```\n\nafter")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "before" }] },
      { type: "code", language: "ts", code: "const a = 1;" },
      { type: "paragraph", inlines: [{ type: "text", text: "after" }] },
    ]);
  });

  it("closes an unterminated fence at the end of the text", () => {
    expect(tokenize("```ts\nconst a = 1;\nconst b")).toEqual([
      { type: "code", language: "ts", code: "const a = 1;\nconst b" },
    ]);
  });

  it("renders a fence with no language without a label", () => {
    expect(tokenize("```\nplain\n```")).toEqual([{ type: "code", language: null, code: "plain" }]);
  });

  it("parses unordered and ordered lists", () => {
    expect(tokenize("- alpha\n- beta\n\n1. one\n2. two")).toEqual([
      {
        type: "list",
        ordered: false,
        start: 1,
        items: [[{ type: "text", text: "alpha" }], [{ type: "text", text: "beta" }]],
      },
      {
        type: "list",
        ordered: true,
        start: 1,
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });

  it("keeps an ordered list's starting number", () => {
    expect(tokenize("3. third\n4. fourth")).toEqual([
      {
        type: "list",
        ordered: true,
        start: 3,
        items: [[{ type: "text", text: "third" }], [{ type: "text", text: "fourth" }]],
      },
    ]);
  });

  it("recursively tokenizes blockquote contents", () => {
    expect(tokenize("> quoted **line**\n> more")).toEqual([
      {
        type: "blockquote",
        blocks: [
          {
            type: "paragraph",
            inlines: [
              { type: "text", text: "quoted " },
              { type: "bold", children: [{ type: "text", text: "line" }] },
              { type: "text", text: "\nmore" },
            ],
          },
        ],
      },
    ]);
  });

  it("parses standalone rules", () => {
    expect(tokenize("above\n\n---\n\nbelow")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "above" }] },
      { type: "rule" },
      { type: "paragraph", inlines: [{ type: "text", text: "below" }] },
    ]);
  });

  it("renders unknown syntax as plain text", () => {
    expect(tokenize("| a | b |\n| --- | --- |")).toEqual([
      {
        type: "paragraph",
        inlines: [{ type: "text", text: "| a | b |\n| --- | --- |" }],
      },
    ]);
  });
});

describe("tokenize inlines", () => {
  it("parses bold, italic, and code runs", () => {
    expect(tokenize("**bold** and *em* and `code`")[0]).toEqual({
      type: "paragraph",
      inlines: [
        { type: "bold", children: [{ type: "text", text: "bold" }] },
        { type: "text", text: " and " },
        { type: "italic", children: [{ type: "text", text: "em" }] },
        { type: "text", text: " and " },
        { type: "code", code: "code" },
      ],
    });
  });

  it("closes unterminated emphasis at the tail for streaming", () => {
    expect(tokenize("still **writing")[0]).toEqual({
      type: "paragraph",
      inlines: [
        { type: "text", text: "still " },
        { type: "bold", children: [{ type: "text", text: "writing" }] },
      ],
    });
  });

  it("leaves a lone marker as text", () => {
    expect(tokenize("a * b")[0]).toEqual({
      type: "paragraph",
      inlines: [{ type: "text", text: "a * b" }],
    });
  });

  it("parses links with inline children", () => {
    expect(tokenize("see [the **docs**](https://example.com) now")[0]).toEqual({
      type: "paragraph",
      inlines: [
        { type: "text", text: "see " },
        {
          type: "link",
          url: "https://example.com",
          children: [
            { type: "text", text: "the " },
            { type: "bold", children: [{ type: "text", text: "docs" }] },
          ],
        },
        { type: "text", text: " now" },
      ],
    });
  });

  it("keeps an unclosed bracket as text", () => {
    expect(tokenize("a [b c")[0]).toEqual({
      type: "paragraph",
      inlines: [{ type: "text", text: "a [b c" }],
    });
  });

  it("nests bold inside italic", () => {
    expect(tokenize("*em **strong** end*")[0]).toEqual({
      type: "paragraph",
      inlines: [
        {
          type: "italic",
          children: [
            { type: "text", text: "em " },
            { type: "bold", children: [{ type: "text", text: "strong" }] },
            { type: "text", text: " end" },
          ],
        },
      ],
    });
  });

  it("keeps backticks inside link labels as code", () => {
    expect(tokenize("[`run`](https://example.com)")[0]).toEqual({
      type: "paragraph",
      inlines: [
        {
          type: "link",
          url: "https://example.com",
          children: [{ type: "code", code: "run" }],
        },
      ],
    });
  });
});
