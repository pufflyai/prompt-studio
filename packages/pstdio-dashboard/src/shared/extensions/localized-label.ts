import { isLocalizedString, type Localizable } from "@pstdio/sdk/extensions";

// Extension contributions may localize their labels; the dashboard renders plain
// strings, so collapse a localizable label to its default text (falling back to the key).
export function resolveLabel(label: Localizable<string>): string;
export function resolveLabel(label: Localizable<string> | undefined): string | undefined;
export function resolveLabel(label: Localizable<string> | undefined) {
  if (label === undefined) return undefined;
  return isLocalizedString(label) ? (label.default ?? label.$l10n) : label;
}

// Webview descriptors carry their own localizable title; resolve it for dashboard consumers.
export const resolveWebviewTitle = <T extends { title?: Localizable<string> }>(webview: T) => ({
  ...webview,
  title: resolveLabel(webview.title),
});
