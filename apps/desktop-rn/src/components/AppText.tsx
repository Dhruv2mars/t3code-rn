import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  type TextProps as RNTextProps,
} from "react-native";

import type { Ref } from "react";

/** Desktop shell tokens — values from the T3 desktop visual language captured
 * in orchestrate/t3code-rn/parity-reference.md. Dark-only for now. */
export const tokens = {
  screen: "#101014",
  sidebar: "#0c0c10",
  foreground: "#f5f5f5",
  foregroundSecondary: "#a3a3a3",
  foregroundMuted: "#8e8e93",
  border: "rgba(255, 255, 255, 0.06)",
  subtle: "rgba(255, 255, 255, 0.04)",
  subtleStrong: "rgba(255, 255, 255, 0.08)",
  input: "#141419",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  placeholder: "#8e8e93",
  accent: "#6366f1",
  white: "#ffffff",
} as const;

const styles = StyleSheet.create({
  input: {
    backgroundColor: tokens.input,
    borderColor: tokens.inputBorder,
    borderRadius: 8,
    borderWidth: 1,
    color: tokens.foreground,
    fontSize: 14,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: tokens.foreground,
  },
});

export type AppTextProps = RNTextProps & { readonly style?: RNTextProps["style"] };

/** Thin wrapper around RN Text with the default foreground color. */
export function AppText({ style, ...props }: AppTextProps) {
  return <RNText style={[styles.text, style]} {...props} />;
}

export type AppTextInputProps = Omit<RNTextInputProps, "placeholderTextColor"> & {
  readonly ref?: Ref<RNTextInput>;
};

/** Thin wrapper around RN TextInput with the default input styling. */
export function AppTextInput({ style, ...props }: AppTextInputProps) {
  return (
    <RNTextInput
      placeholderTextColor={tokens.placeholder}
      style={[styles.input, style]}
      {...props}
    />
  );
}
