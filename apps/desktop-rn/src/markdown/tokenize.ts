/**
 * Block + inline tokenizer for the message markdown subset: paragraphs,
 * headings, bold/italic, inline code, fenced code blocks, links, ordered and
 * unordered lists, blockquotes, and rules. Streaming input is safe by design:
 * an unterminated fence or emphasis token closes at the end of the text, so
 * partial output renders exactly like the completed form will.
 */

export type InlineToken =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "bold"; readonly children: ReadonlyArray<InlineToken> }
  | { readonly type: "italic"; readonly children: ReadonlyArray<InlineToken> }
  | { readonly type: "code"; readonly code: string }
  | { readonly type: "link"; readonly url: string; readonly children: ReadonlyArray<InlineToken> };

export type BlockToken =
  | { readonly type: "paragraph"; readonly inlines: ReadonlyArray<InlineToken> }
  | {
      readonly type: "heading";
      readonly level: 1 | 2 | 3;
      readonly inlines: ReadonlyArray<InlineToken>;
    }
  | { readonly type: "code"; readonly language: string | null; readonly code: string }
  | {
      readonly type: "list";
      readonly ordered: boolean;
      readonly start: number;
      readonly items: ReadonlyArray<ReadonlyArray<InlineToken>>;
    }
  | { readonly type: "blockquote"; readonly blocks: ReadonlyArray<BlockToken> }
  | { readonly type: "rule" };

const FENCE_OPEN = /^ {0,3}```\s*(\S*)/;
const FENCE_CLOSE = /^ {0,3}```\s*$/;
const HEADING = /^ {0,3}(#{1,3})\s+(.+)$/;
const RULE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_ITEM = /^ {0,3}(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;
const QUOTE_LINE = /^ {0,3}>\s?(.*)$/;

const parseInlines = (text: string): ReadonlyArray<InlineToken> => {
  const tokens: InlineToken[] = [];
  let plain = "";
  let index = 0;

  const flush = (): void => {
    if (plain.length > 0) {
      tokens.push({ type: "text", text: plain });
      plain = "";
    }
  };

  while (index < text.length) {
    const char = text[index];

    if (char === "`") {
      const close = text.indexOf("`", index + 1);
      if (close > index + 1) {
        flush();
        tokens.push({ type: "code", code: text.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
      plain += char;
      index += 1;
      continue;
    }

    if (char === "[") {
      const labelEnd = text.indexOf("]", index + 1);
      if (labelEnd !== -1 && text[labelEnd + 1] === "(") {
        const urlEnd = text.indexOf(")", labelEnd + 2);
        if (urlEnd !== -1) {
          const label = text.slice(index + 1, labelEnd);
          if (label.length > 0) {
            flush();
            tokens.push({
              type: "link",
              url: text.slice(labelEnd + 2, urlEnd),
              children: parseInlines(label),
            });
            index = urlEnd + 1;
            continue;
          }
        }
      }
      plain += char;
      index += 1;
      continue;
    }

    if (char === "*") {
      if (text.startsWith("**", index)) {
        const close = text.indexOf("**", index + 2);
        const content = close === -1 ? text.slice(index + 2) : text.slice(index + 2, close);
        if (content.length > 0) {
          flush();
          tokens.push({ type: "bold", children: parseInlines(content) });
          index = close === -1 ? text.length : close + 2;
          continue;
        }
      } else {
        let close = text.indexOf("*", index + 1);
        // A close candidate that starts a "**" run belongs to bold, not to
        // this italic span.
        while (close !== -1 && text[close + 1] === "*") {
          close = text.indexOf("*", close + 2);
        }
        if (close > index + 1) {
          flush();
          tokens.push({ type: "italic", children: parseInlines(text.slice(index + 1, close)) });
          index = close + 1;
          continue;
        }
      }
      plain += char;
      index += 1;
      continue;
    }

    plain += char;
    index += 1;
  }

  flush();
  return tokens;
};

const tokenizeLines = (lines: ReadonlyArray<string>): ReadonlyArray<BlockToken> => {
  const blocks: BlockToken[] = [];
  let index = 0;

  const paragraph: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", inlines: parseInlines(paragraph.join("\n")) });
      paragraph.length = 0;
    }
  };

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim().length === 0) {
      flushParagraph();
      index += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence !== null) {
      flushParagraph();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_CLOSE.test(lines[index]!)) {
        body.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: "code",
        language: fence[1] !== undefined && fence[1].length > 0 ? fence[1] : null,
        code: body.join("\n"),
      });
      continue;
    }

    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      flushParagraph();
      const level = heading[1]!.length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, inlines: parseInlines(heading[2] ?? "") });
      index += 1;
      continue;
    }

    const quote = QUOTE_LINE.exec(line);
    if (quote !== null) {
      flushParagraph();
      const quoted: string[] = [];
      while (index < lines.length) {
        const match = QUOTE_LINE.exec(lines[index]!);
        if (match === null) break;
        quoted.push(match[1] ?? "");
        index += 1;
      }
      blocks.push({ type: "blockquote", blocks: tokenizeLines(quoted) });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item !== null) {
      flushParagraph();
      const ordered = item[2] !== undefined;
      const start = ordered ? Number.parseInt(item[2] ?? "1", 10) : 1;
      const texts: string[] = [item[3] ?? ""];
      index += 1;
      while (index < lines.length) {
        const next = LIST_ITEM.exec(lines[index]!);
        if (next !== null) {
          texts.push(next[3] ?? "");
        } else if (/^ {2,}\S/.test(lines[index]!)) {
          texts[texts.length - 1] += `\n${lines[index]!.trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({
        type: "list",
        ordered,
        start,
        items: texts.map((text) => parseInlines(text)),
      });
      continue;
    }

    paragraph.push(line.trimEnd());
    index += 1;
  }

  flushParagraph();
  return blocks;
};

/** Tokenize message markdown into the renderable block tree. */
export const tokenize = (markdown: string): ReadonlyArray<BlockToken> =>
  tokenizeLines(markdown.split("\n"));
