import { useCallback, useState, type JSX } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, AppTextInput, tokens } from "../components/AppText";
import { devLog } from "../devLog";

const styles = StyleSheet.create({
  composerWrap: {
    borderTopColor: tokens.border,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  composerCard: {
    backgroundColor: tokens.input,
    borderColor: tokens.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  input: {
    borderWidth: 0,
    fontSize: 14,
    maxHeight: 160,
    minHeight: 40,
    paddingHorizontal: 4,
    textAlignVertical: "top",
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    backgroundColor: tokens.subtle,
    borderColor: tokens.border,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipLabel: {
    color: tokens.foregroundSecondary,
    fontSize: 12,
  },
  attachLabel: {
    color: tokens.foregroundSecondary,
    fontSize: 12,
  },
  spacer: {
    flex: 1,
  },
  sendButton: {
    backgroundColor: tokens.accent,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sendDisabled: {
    backgroundColor: tokens.subtleStrong,
  },
  sendLabel: {
    color: tokens.white,
    fontSize: 13,
    fontWeight: "600",
  },
  sendLabelDisabled: {
    color: tokens.foregroundMuted,
  },
});

/**
 * Composer per the captured parity anatomy: multiline textarea, attach
 * placeholder, model/effort/runtime picker chips (visual placeholders this
 * unit), and a send action disabled while the input is empty.
 */
export function Composer(props: {
  readonly placeholder: string;
  readonly modelLabel: string;
  readonly runtimeLabel: string;
  readonly onSend: (text: string) => Promise<void>;
}): JSX.Element {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || sending) return;
    setSending(true);
    props
      .onSend(trimmed)
      .then(() => {
        setText("");
      })
      .catch((cause: unknown) => {
        devLog(`[u011] send failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        setSending(false);
      });
  }, [props, sending, text]);

  return (
    <View style={styles.composerWrap}>
      <View style={styles.composerCard}>
        <AppTextInput
          blurOnSubmit={false}
          multiline
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={props.placeholder}
          style={styles.input}
          value={text}
        />
        <View style={styles.toolbar}>
          <View style={styles.chip}>
            <AppText style={styles.attachLabel}>Attach files</AppText>
          </View>
          <View style={styles.chip}>
            <AppText style={styles.chipLabel}>{props.modelLabel}</AppText>
          </View>
          <View style={styles.chip}>
            <AppText style={styles.chipLabel}>{props.runtimeLabel}</AppText>
          </View>
          <View style={styles.spacer} />
          <Pressable
            disabled={text.trim().length === 0 || sending}
            onPress={send}
            style={[
              styles.sendButton,
              text.trim().length === 0 || sending ? styles.sendDisabled : null,
            ]}
          >
            <AppText
              style={[
                styles.sendLabel,
                text.trim().length === 0 || sending ? styles.sendLabelDisabled : null,
              ]}
            >
              {sending ? "Sending…" : "Send message"}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
