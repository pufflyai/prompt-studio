import type { LocalizableString } from "pstdio-api-contracts";
import { isLocalizedString, type Localizable } from "pstdio-api-contracts/extension-kernel";

export const text = (value: Localizable<string> | LocalizableString | undefined, fallback = "") => {
  if (value === undefined) return fallback;
  if (!isLocalizedString(value)) return value;
  return value.default ?? value.$l10n;
};
