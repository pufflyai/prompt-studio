import type { LocalizableString } from "@pstdio/sdk/api";
import { isLocalizedString, type Localizable } from "@pstdio/sdk/extensions";

export const text = (value: Localizable<string> | LocalizableString | undefined, fallback = "") => {
  if (value === undefined) return fallback;
  if (!isLocalizedString(value)) return value;
  return value.default ?? value.$l10n;
};
