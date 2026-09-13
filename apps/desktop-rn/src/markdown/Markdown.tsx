import { memo, type JSX, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { tokens } from "../components/AppText";
import { tokenize, type BlockToken, type InlineToken } from "./tokenize";

/** Paragraph metrics shared by markdown blocks and plain user messages. */
export const messageBody = { color: "#d0d0d5", fontSize: 15, lineHeight: 23 } as const;

const styles = StyleSheet.create({
  blocks: {
    gap: 14,
  },
  paragraph: { ...messageBody },
  heading1: {
    color: "#f2f2f5",
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 28,
  },
  heading2: {
    color: "#f2f2f5",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 24,
  },
  heading3: {
    color: "#e8e8ee",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  strong: {
    fontWeight: "700",
  },
  emphasis: {
    fontStyle: "italic",
  },
  inlineCode: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 4,
    color: "#e6e6ec",
    fontFamily: "Menlo",
    fontSize: 14,
  },
  link: {
    color: tokens.accent,
    textDecorationLine: "underline",
  },
  codePanel: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: tokens.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  codeHeader: {
    borderBottomColor: tokens.border,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  codeLanguage: {
    color: tokens.foregroundMuted,
    fontFamily: "Menlo",
    fontSize: 11,
  },
  codeText: {
    color: "#d6d6dd",
    fontFamily: "Menlo",
    fontSize: 13,
    lineHeight: 19,
    padding: 12,
  },
  quote: {
    borderLeftColor: "rgba(255, 255, 255, 0.14)",
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
  listRow: {
    flexDirection: "row",
  },
  listMarker: {
    ...messageBody,
    width: 24,
  },
  listBody: {
    flex: 1,
  },
  rule: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    height: 1,
  },
  caret: {
    color: tokens.accent,
    fontWeight: "700",
  },
});

const caretNode = <Text style={styles.caret}> ▍</Text>;

const openLink = (url: string): void => {
  void Linking.openURL(url).catch(() => undefined);
};

const renderInline = (
  inlines: ReadonlyArray<InlineToken>,
  keyPrefix: string,
): ReadonlyArray<ReactNode> =>
  inlines.map((inline, index) => {
    const key = `${keyPrefix}:${index}`;
    switch (inline.type) {
      case "text":
        return <Text key={key}>{inline.text}</Text>;
      case "code":
        return (
          <Text key={key} style={styles.inlineCode}>
            {inline.code}
          </Text>
        );
      case "bold":
        return (
          <Text key={key} style={styles.strong}>
            {renderInline(inline.children, key)}
          </Text>
        );
      case "italic":
        return (
          <Text key={key} style={styles.emphasis}>
            {renderInline(inline.children, key)}
          </Text>
        );
      case "link":
        return (
          <Text key={key} onPress={() => openLink(inline.url)} style={styles.link}>
            {renderInline(inline.children, key)}
          </Text>
        );
    }
  });

const ListBlock = ({
  block,
  keyPrefix,
  tail,
}: {
  readonly block: Extract<BlockToken, { type: "list" }>;
  readonly keyPrefix: string;
  readonly tail: ReactNode | null;
}): JSX.Element => (
  <View style={styles.blocks}>
    {block.items.map((item, index) => {
      const marker = block.ordered ? `${block.start + index}.` : "•";
      const hostsTail = tail !== null && index === block.items.length - 1;
      return (
        <View key={`${keyPrefix}:item:${index}`} style={styles.listRow}>
          <Text style={styles.listMarker}>{marker}</Text>
          <Text style={styles.listBody}>
            {renderInline(item, `${keyPrefix}:item:${index}`)}
            {hostsTail ? tail : null}
          </Text>
        </View>
      );
    })}
  </View>
);

// Block types that can host the streaming caret inline at their tail.
const CARET_HOSTS = new Set(["paragraph", "heading", "list", "blockquote"]);

const lastHostIndex = (blocks: ReadonlyArray<BlockToken>): number => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (CARET_HOSTS.has(blocks[index]!.type)) return index;
  }
  return -1;
};

const renderBlocks = (
  blocks: ReadonlyArray<BlockToken>,
  keyPrefix: string,
  tail: ReactNode | null,
): ReadonlyArray<ReactNode> => {
  const hostIndex = tail === null ? -1 : lastHostIndex(blocks);
  return blocks.map((block, index) => {
    const key = `${keyPrefix}:${index}`;
    const blockTail = tail !== null && index === hostIndex ? tail : null;
    switch (block.type) {
      case "paragraph":
        return (
          <Text key={key} style={styles.paragraph}>
            {renderInline(block.inlines, key)}
            {blockTail}
          </Text>
        );
      case "heading": {
        const style =
          block.level === 1
            ? styles.heading1
            : block.level === 2
              ? styles.heading2
              : styles.heading3;
        return (
          <Text key={key} style={style}>
            {renderInline(block.inlines, key)}
            {blockTail}
          </Text>
        );
      }
      case "code":
        return (
          <View key={key} style={styles.codePanel}>
            {block.language !== null ? (
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>{block.language}</Text>
              </View>
            ) : null}
            <Text style={styles.codeText}>{block.code}</Text>
          </View>
        );
      case "list":
        return <ListBlock block={block} key={key} keyPrefix={key} tail={blockTail} />;
      case "blockquote":
        return (
          <View key={key} style={styles.quote}>
            <View style={styles.blocks}>{renderBlocks(block.blocks, key, blockTail)}</View>
          </View>
        );
      case "rule":
        return <View key={key} style={styles.rule} />;
    }
  });
};

/**
 * Message markdown renderer. Memoized on its primitive props so an assistant
 * message re-parses only when its text (or streaming flag) actually changes.
 * While streaming, the caret hosts inside the last inline-bearing block so it
 * tracks the growing tail instead of jumping to its own line.
 */
export const MarkdownView = (props: {
  readonly text: string;
  readonly streaming: boolean;
}): JSX.Element => (
  <View style={styles.blocks}>
    {renderBlocks(tokenize(props.text), "b", props.streaming ? caretNode : null)}
  </View>
);

export const Markdown = memo(MarkdownView);
