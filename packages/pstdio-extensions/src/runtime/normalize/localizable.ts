import { isLocalizedString, type Localizable, type LocalizedString } from "pstdio-api-contracts/extension-kernel";

export const isLocalizableString = (value: unknown): value is Localizable<string> =>
  typeof value === "string" || isLocalizedString(value);

export const asLocalizableString = (value: unknown): Localizable<string> | undefined =>
  isLocalizableString(value) ? value : undefined;

export const findLocalizedStrings = (value: unknown) => {
  const tokens: LocalizedString[] = [];
  const seen = new Set<object>();

  const visit = (next: unknown) => {
    if (isLocalizedString(next)) {
      tokens.push(next);
      return;
    }
    if (typeof next !== "object" || next === null) return;
    if (seen.has(next)) return;
    seen.add(next);
    if (Array.isArray(next)) {
      for (const item of next) visit(item);
      return;
    }
    for (const item of Object.values(next)) {
      if (typeof item !== "function") visit(item);
    }
  };

  visit(value);
  return tokens;
};
