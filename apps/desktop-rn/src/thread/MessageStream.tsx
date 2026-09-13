import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AppText, tokens } from "../components/AppText";
import { Markdown, messageBody } from "../markdown/Markdown";
import type { StreamListItem } from "./listModel";

const NEAR_BOTTOM_PX = 80;

const styles = StyleSheet.create({
  stream: {
    backgroundColor: tokens.screen,
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  row: {
    paddingVertical: 6,
  },
  roleLabel: {
    color: tokens.foregroundMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  roleUser: {
    color: tokens.accent,
  },
  body: {
    ...messageBody,
  },
  caret: {
    color: tokens.accent,
    fontWeight: "700",
  },
  noticeText: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jumpPill: {
    backgroundColor: tokens.subtleStrong,
    borderColor: tokens.border,
    borderRadius: 999,
    borderWidth: 1,
    bottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    position: "absolute",
    alignSelf: "center",
  },
  jumpLabel: {
    color: tokens.foregroundSecondary,
    fontSize: 12,
  },
});

function MessageRow({ item }: { readonly item: Extract<StreamListItem, { type: "message" }> }) {
  return (
    <View style={styles.row}>
      <AppText
        style={item.role === "user" ? [styles.roleLabel, styles.roleUser] : styles.roleLabel}
      >
        {item.role}
      </AppText>
      {item.role === "user" ? (
        <AppText style={styles.body}>
          {item.text}
          {item.streaming ? <AppText style={styles.caret}> ▍</AppText> : null}
        </AppText>
      ) : (
        <Markdown streaming={item.streaming} text={item.text} />
      )}
    </View>
  );
}

function NoticeRow({ item }: { readonly item: Extract<StreamListItem, { type: "notice" }> }) {
  return (
    <View style={styles.notice}>
      <AppText style={styles.noticeText}>{item.text}</AppText>
    </View>
  );
}

function StreamRow({ item }: { readonly item: StreamListItem }) {
  return item.type === "message" ? <MessageRow item={item} /> : <NoticeRow item={item} />;
}

/**
 * Keyed message list on a ScrollView (LegendList-shaped items, stable keys,
 * typed rows). Bottom-anchored while the user is near the end; scrolling up
 * stops the follow and offers the "Scroll to end" pill, matching chat
 * anchoring rules.
 */
export function MessageStream({ items }: { readonly items: ReadonlyArray<StreamListItem> }) {
  const listRef = useRef<ScrollView | null>(null);
  const nearBottomRef = useRef(true);
  const [showJumpPill, setShowJumpPill] = useState(false);

  const handleScroll = useCallback(
    (event: {
      nativeEvent: {
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      };
    }) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distance = contentSize.height - contentOffset.y - layoutMeasurement.height;
      const nearBottom = distance < NEAR_BOTTOM_PX;
      nearBottomRef.current = nearBottom;
      setShowJumpPill(!nearBottom);
    },
    [],
  );

  useEffect(() => {
    if (nearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, [items]);

  const jumpToEnd = useCallback(() => {
    nearBottomRef.current = true;
    setShowJumpPill(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <View style={styles.stream}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        ref={listRef}
        scrollEventThrottle={16}
      >
        {items.map((item) => (
          <StreamRow item={item} key={item.key} />
        ))}
      </ScrollView>
      {showJumpPill ? (
        <Pressable onPress={jumpToEnd} style={styles.jumpPill}>
          <AppText style={styles.jumpLabel}>Scroll to end</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
