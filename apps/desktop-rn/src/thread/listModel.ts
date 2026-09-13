import type { OrchestrationThread } from "@t3tools/contracts";

import type { ThreadNotice } from "./stores";

/**
 * Keyed list items for the message stream, LegendList-shaped (stable keys,
 * typed rows) so the ScrollView rendering can stay dumb.
 */
export type StreamListItem =
  | {
      readonly type: "message";
      readonly key: string;
      readonly role: "user" | "assistant" | "system";
      readonly text: string;
      readonly streaming: boolean;
    }
  | { readonly type: "notice"; readonly key: string; readonly text: string };

export function buildStreamListItems(
  thread: OrchestrationThread | null,
  notice: ThreadNotice | null,
): StreamListItem[] {
  const items: StreamListItem[] = [];
  if (thread !== null) {
    for (const message of thread.messages) {
      if (message.text.trim().length === 0 && !message.streaming) continue;
      items.push({
        type: "message",
        key: message.id,
        role: message.role,
        text: message.text,
        streaming: message.streaming,
      });
    }
  }
  if (notice !== null) {
    items.push({ type: "notice", key: `notice:${items.length}`, text: notice.text });
  }
  return items;
}

export function titleFromMessage(text: string): string {
  const firstLine = text.trim().split("\n")[0]?.trim() ?? "";
  const clipped = firstLine.slice(0, 60);
  return clipped.length > 0 ? clipped : "New thread";
}
