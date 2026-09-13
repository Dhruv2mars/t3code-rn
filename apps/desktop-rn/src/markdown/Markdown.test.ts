import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  Linking: { openURL: () => Promise.resolve() },
}));

import { MarkdownView } from "./Markdown";

type Element = { type: unknown; props: Record<string, unknown> };

const toTree = (node: unknown): unknown => {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(toTree);
  const { type, props } = node as Element;
  if (typeof type === "function") return toTree((type as (p: unknown) => unknown)(props));
  const next: Record<string, unknown> = { ...props };
  delete next.key;
  delete next.onPress;
  if ("children" in next) next.children = toTree(next.children);
  return { type, props: next };
};

// paragraph Text children = [runs array, tail]; pull the runs array out.
const inlineRuns = (view: Element): Element[] =>
  ((view.props.children as Element[])[0]!.props.children as Element[])[0] as unknown as Element[];

const render = (text: string, streaming = false): unknown =>
  toTree(MarkdownView({ text, streaming }));

// A paragraph Text hosts the inline runs as a nested array followed by the
// streaming tail (null when settled).
const paragraph = (runs: unknown, tail: unknown = null): unknown => ({
  type: "Text",
  props: {
    style: { color: "#d0d0d5", fontSize: 15, lineHeight: 23 },
    children: [runs, tail],
  },
});

const textRun = (text: string): unknown => ({ type: "Text", props: { children: text } });

const BLOCKS = { gap: 14 };

describe("MarkdownView", () => {
  it("renders a paragraph with the shared message body metrics", () => {
    expect(render("hello world")).toEqual({
      type: "View",
      props: { style: BLOCKS, children: [paragraph([textRun("hello world")])] },
    });
  });

  it("renders heading levels with distinct styles", () => {
    expect(render("# one\n\n## two\n\n### three")).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          {
            type: "Text",
            props: {
              style: { color: "#f2f2f5", fontSize: 21, fontWeight: "700", lineHeight: 28 },
              children: [[textRun("one")], null],
            },
          },
          {
            type: "Text",
            props: {
              style: { color: "#f2f2f5", fontSize: 17, fontWeight: "600", lineHeight: 24 },
              children: [[textRun("two")], null],
            },
          },
          {
            type: "Text",
            props: {
              style: { color: "#e8e8ee", fontSize: 15, fontWeight: "600", lineHeight: 22 },
              children: [[textRun("three")], null],
            },
          },
        ],
      },
    });
  });

  it("wraps fenced code in a panel with a language label row", () => {
    expect(render("```ts\nconst a = 1;\n```")).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          {
            type: "View",
            props: {
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: 8,
                borderWidth: 1,
                overflow: "hidden",
              },
              children: [
                {
                  type: "View",
                  props: {
                    style: {
                      borderBottomColor: "rgba(255, 255, 255, 0.06)",
                      borderBottomWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    },
                    children: {
                      type: "Text",
                      props: {
                        style: { color: "#8e8e93", fontFamily: "Menlo", fontSize: 11 },
                        children: "ts",
                      },
                    },
                  },
                },
                {
                  type: "Text",
                  props: {
                    style: {
                      color: "#d6d6dd",
                      fontFamily: "Menlo",
                      fontSize: 13,
                      lineHeight: 19,
                      padding: 12,
                    },
                    children: "const a = 1;",
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });

  it("renders inline emphasis, code, and a tappable link", () => {
    const view = MarkdownView({
      text: "**b** *i* `c` [l](https://example.com)",
      streaming: false,
    });
    const runs = inlineRuns(
      MarkdownView({ text: "**b** *i* `c` [l](https://example.com)", streaming: false }),
    );
    expect(toTree(runs[0])).toEqual({
      type: "Text",
      props: {
        style: { fontWeight: "700" },
        children: [textRun("b")],
      },
    });
    expect(toTree(runs[2])).toEqual({
      type: "Text",
      props: {
        style: { fontStyle: "italic" },
        children: [textRun("i")],
      },
    });
    expect(toTree(runs[4])).toEqual({
      type: "Text",
      props: {
        style: {
          backgroundColor: "rgba(255, 255, 255, 0.07)",
          borderRadius: 4,
          color: "#e6e6ec",
          fontFamily: "Menlo",
          fontSize: 14,
        },
        children: "c",
      },
    });
    expect(typeof runs[6]!.props.onPress).toBe("function");
    expect(toTree(runs[6])).toEqual({
      type: "Text",
      props: {
        style: { color: "#6366f1", textDecorationLine: "underline" },
        children: [textRun("l")],
      },
    });
  });

  it("renders list rows with markers and bodies", () => {
    expect(render("- alpha\n\n2. beta")).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          {
            type: "View",
            props: {
              style: BLOCKS,
              children: [
                {
                  type: "View",
                  props: {
                    style: { flexDirection: "row" },
                    children: [
                      {
                        type: "Text",
                        props: {
                          style: { color: "#d0d0d5", fontSize: 15, lineHeight: 23, width: 24 },
                          children: "•",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          style: { flex: 1 },
                          children: [[textRun("alpha")], null],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            type: "View",
            props: {
              style: BLOCKS,
              children: [
                {
                  type: "View",
                  props: {
                    style: { flexDirection: "row" },
                    children: [
                      {
                        type: "Text",
                        props: {
                          style: { color: "#d0d0d5", fontSize: 15, lineHeight: 23, width: 24 },
                          children: "2.",
                        },
                      },
                      {
                        type: "Text",
                        props: {
                          style: { flex: 1 },
                          children: [[textRun("beta")], null],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });

  it("hosts the streaming caret inside the last inline-bearing block", () => {
    const caret = {
      type: "Text",
      props: { style: { color: "#6366f1", fontWeight: "700" }, children: " ▍" },
    };
    expect(render("first\n\n```ts\nconst", true)).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          paragraph([textRun("first")], caret),
          {
            type: "View",
            props: {
              style: {
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                borderColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: 8,
                borderWidth: 1,
                overflow: "hidden",
              },
              children: [
                {
                  type: "View",
                  props: {
                    style: {
                      borderBottomColor: "rgba(255, 255, 255, 0.06)",
                      borderBottomWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    },
                    children: {
                      type: "Text",
                      props: {
                        style: { color: "#8e8e93", fontFamily: "Menlo", fontSize: 11 },
                        children: "ts",
                      },
                    },
                  },
                },
                {
                  type: "Text",
                  props: {
                    style: {
                      color: "#d6d6dd",
                      fontFamily: "Menlo",
                      fontSize: 13,
                      lineHeight: 19,
                      padding: 12,
                    },
                    children: "const",
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });

  it("renders a blockquote with the left rule and nested content", () => {
    expect(render("> quoted")).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          {
            type: "View",
            props: {
              style: {
                borderLeftColor: "rgba(255, 255, 255, 0.14)",
                borderLeftWidth: 3,
                paddingLeft: 12,
              },
              children: {
                type: "View",
                props: {
                  style: BLOCKS,
                  children: [paragraph([textRun("quoted")])],
                },
              },
            },
          },
        ],
      },
    });
  });

  it("renders a rule as a hairline view", () => {
    expect(render("---")).toEqual({
      type: "View",
      props: {
        style: BLOCKS,
        children: [
          {
            type: "View",
            props: { style: { backgroundColor: "rgba(255, 255, 255, 0.12)", height: 1 } },
          },
        ],
      },
    });
  });
});
