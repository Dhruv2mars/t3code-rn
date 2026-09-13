import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  type TextProps as RNTextProps,
} from "react-native";

import type { Ref } from "react";

export type AppTextProps = RNTextProps & { readonly className?: string };

/** Joins truthy class strings; desktop-rn keeps the mobile AppText shape
 * without the tailwind-merge dependency (all classes are unit-local). */
export function cx(...classes: ReadonlyArray<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Thin wrapper around RN Text with default foreground color.
 * Uses Uniwind className — no manual style parsing.
 */
export function AppText({ className, ...props }: AppTextProps) {
  return <RNText className={cx("text-foreground", className)} {...props} />;
}

export type AppTextInputProps = Omit<RNTextInputProps, "placeholderTextColor"> & {
  readonly className?: string;
  readonly ref?: Ref<RNTextInput>;
};

/**
 * Thin wrapper around RN TextInput with default input styling.
 * Uses Uniwind className — no manual style parsing.
 */
export function AppTextInput({ className, ref, ...props }: AppTextInputProps) {
  return (
    <RNTextInput
      ref={ref}
      className={cx(
        "min-h-9 rounded-lg border border-input-border bg-input px-3 py-2 text-sm text-foreground",
        className,
      )}
      placeholderTextColorClassName="accent-placeholder"
      {...props}
    />
  );
}
