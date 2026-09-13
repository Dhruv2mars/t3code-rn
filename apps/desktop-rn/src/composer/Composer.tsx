import { useCallback, useMemo, useState, type JSX } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import type { ModelSelection, ProviderInteractionMode, RuntimeMode } from "@t3tools/contracts";

import { AppText } from "../components/AppText";
import { devLog } from "../devLog";
import {
  EFFORT_OPTIONS,
  RUNTIME_MODE_OPTIONS,
  effortLabel,
  effortOf,
  interactionModeLabel,
  modelDisplayName,
  modelEntryLabel,
  runtimeModeLabel,
  type EffortOption,
  type ModelEntry,
} from "./modelDisplay";
import { PickerMenu } from "./PickerMenu";

/** Colors sampled from reference/composer.png (see PR color table). */
const colors = {
  card: "#0f0f0f",
  cardBorder: "#1b1b1b",
  pill: "#212121",
  pillText: "#f5f5f5",
  placeholder: "#616161",
  inputText: "#f5f5f5",
  rowLabel: "#8f8f96",
  icon: "#9a9aa2",
  stopRed: "#e33a42",
  accent: "#6366f1",
  sendDimmed: "rgba(255, 255, 255, 0.10)",
  glyphDimmed: "#6f6f76",
} as const;

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
    width: "100%",
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 768,
    paddingBottom: 10,
    paddingHorizontal: 22,
    paddingTop: 16,
    width: "100%",
  },
  input: {
    color: colors.inputText,
    fontSize: 15,
    minHeight: 44,
    padding: 0,
    textAlignVertical: "top",
  },
  modelPillWrap: {
    alignItems: "center",
    marginTop: 2,
  },
  modelPill: {
    alignItems: "center",
    backgroundColor: colors.pill,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 25,
    paddingHorizontal: 14,
  },
  modelPillTail: {
    backgroundColor: colors.pill,
    height: 9,
    marginTop: -4,
    transform: [{ rotate: "45deg" }],
    width: 9,
  },
  modelPillLabel: {
    color: colors.pillText,
    fontSize: 13,
    fontWeight: "500",
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 8,
  },
  leftCluster: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 2,
  },
  chip: {
    alignItems: "center",
    borderRadius: 7,
    flexDirection: "row",
    minHeight: 28,
    paddingHorizontal: 8,
  },
  chipLabel: {
    color: colors.rowLabel,
    fontSize: 12.5,
  },
  chipChevron: {
    color: colors.rowLabel,
    fontSize: 11,
    marginLeft: 3,
    marginTop: 1,
  },
  rightCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  attachButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 28,
  },
  clipOuter: {
    borderColor: colors.icon,
    borderRadius: 8,
    borderWidth: 1.6,
    height: 18,
    transform: [{ rotate: "45deg" }],
    width: 11,
  },
  clipInner: {
    borderColor: colors.icon,
    borderRadius: 3.5,
    borderWidth: 1.6,
    height: 10,
    marginLeft: 2.2,
    marginTop: 2.2,
    width: 4.6,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stopSquare: {
    backgroundColor: "#ffffff",
    borderRadius: 2.5,
    height: 11,
    width: 11,
  },
  sendGlyph: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    marginTop: -1,
  },
});

const PaperclipIcon = (): JSX.Element => (
  <View style={styles.clipOuter}>
    <View style={styles.clipInner} />
  </View>
);

type OpenMenu = "model" | "effort" | "runtime" | null;

/**
 * The T3 Code composer card: multiline prompt, floating model pill, and the
 * bottom row (effort + runtime pickers left, attach and send/stop right).
 * Send behavior lives in the onSend callback provided by the thread view.
 */
export function Composer(props: {
  readonly placeholder: string;
  readonly model: ModelSelection | null;
  readonly runtimeMode: RuntimeMode | null;
  readonly interactionMode: ProviderInteractionMode | null;
  readonly working: boolean;
  readonly availableModels: ReadonlyArray<ModelEntry>;
  readonly onSend: (text: string) => Promise<void>;
}): JSX.Element {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [effort, setEffort] = useState<EffortOption>(() => {
    const current = effortOf(props.model);
    return (EFFORT_OPTIONS as readonly string[]).includes(current)
      ? (current as EffortOption)
      : "xhigh";
  });
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(props.runtimeMode ?? "full-access");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const interaction = props.interactionMode ?? "default";

  const modelLabel = props.model
    ? modelDisplayName(props.model.instanceId, props.model.model)
    : "Model";
  const effortChipLabel = `${effortLabel(effort)} · ${interactionModeLabel(interaction)}`;

  const modelItems = useMemo(
    () =>
      props.availableModels.map((entry) => ({
        label: modelEntryLabel(entry),
        checked:
          props.model !== null &&
          entry.instanceId === props.model.instanceId &&
          entry.model === props.model.model,
      })),
    [props.availableModels, props.model],
  );

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
        devLog(`[u023] send failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        setSending(false);
      });
  }, [props, sending, text]);

  const canSend = text.trim().length > 0 && !sending && !props.working;
  const actionBackground = props.working
    ? colors.stopRed
    : canSend
      ? colors.accent
      : colors.sendDimmed;

  const selectModel = (index: number): void => {
    const entry = props.availableModels[index];
    setOpenMenu(null);
    if (entry === undefined) return;
    devLog(`[u023] model selected: ${entry.instanceId}/${entry.model} (display state)`);
  };

  const selectEffort = (index: number): void => {
    setEffort(EFFORT_OPTIONS[index] ?? "xhigh");
    setOpenMenu(null);
  };

  const selectRuntime = (index: number): void => {
    const option = RUNTIME_MODE_OPTIONS[index];
    if (option !== undefined) setRuntimeMode(option.value);
    setOpenMenu(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <TextInput
          blurOnSubmit={false}
          multiline
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder={props.placeholder}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent}
          style={styles.input}
          value={text}
        />
        <View style={styles.modelPillWrap}>
          <Pressable onPress={() => setOpenMenu("model")} style={styles.modelPill}>
            <AppText style={styles.modelPillLabel}>{modelLabel}</AppText>
          </Pressable>
          <View style={styles.modelPillTail} />
        </View>
        <View style={styles.toolbar}>
          <View style={styles.leftCluster}>
            <Pressable onPress={() => setOpenMenu("effort")} style={styles.chip}>
              <AppText style={styles.chipLabel}>{effortChipLabel}</AppText>
              <AppText style={styles.chipChevron}>{"⌄"}</AppText>
            </Pressable>
            <Pressable onPress={() => setOpenMenu("runtime")} style={styles.chip}>
              <AppText style={styles.chipLabel}>{runtimeModeLabel(runtimeMode)}</AppText>
              <AppText style={styles.chipChevron}>{"⌄"}</AppText>
            </Pressable>
          </View>
          <View style={styles.rightCluster}>
            <Pressable
              onPress={() => devLog("[u023] attach: file picking lands with the upload unit")}
              style={styles.attachButton}
            >
              <PaperclipIcon />
            </Pressable>
            <Pressable
              disabled={!canSend}
              onPress={props.working ? undefined : send}
              style={[styles.actionButton, { backgroundColor: actionBackground }]}
            >
              {props.working ? (
                <View style={styles.stopSquare} />
              ) : (
                <AppText style={[styles.sendGlyph, !canSend && { color: colors.glyphDimmed }]}>
                  {"↑"}
                </AppText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
      <PickerMenu
        anchor="center"
        items={modelItems}
        onClose={() => setOpenMenu(null)}
        onSelect={selectModel}
        visible={openMenu === "model"}
      />
      <PickerMenu
        anchor="left"
        items={EFFORT_OPTIONS.map((option) => ({
          label: `${effortLabel(option)} · ${interactionModeLabel(interaction)}`,
          checked: option === effort,
        }))}
        onClose={() => setOpenMenu(null)}
        onSelect={selectEffort}
        visible={openMenu === "effort"}
      />
      <PickerMenu
        anchor="left"
        items={RUNTIME_MODE_OPTIONS.map((option) => ({
          label: option.label,
          checked: option.value === runtimeMode,
        }))}
        onClose={() => setOpenMenu(null)}
        onSelect={selectRuntime}
        visible={openMenu === "runtime"}
      />
    </View>
  );
}
